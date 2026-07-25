import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

import { useAuthStore } from '@/stores/authStore';
import { useMedicationStore } from '@/stores/medicationStore';
import { useLogStore } from '@/stores/logStore';
import {
  registerNotificationCategories,
  requestNotificationPermissions,
  rescheduleAllNotifications,
} from '@/lib/notifications';
import {
  handleMedicationNotificationResponse,
} from '@/lib/notificationActions';
import { supabase } from '@/lib/supabase';
import { appTheme, colors } from '@/theme';

// ---------------------------------------------------------------------------
// Configure Google Sign-In (called once at module load)
// ---------------------------------------------------------------------------

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  scopes: ['profile', 'email'],
});

// ---------------------------------------------------------------------------
// Background task — reschedule notifications & mark missed doses
// ---------------------------------------------------------------------------

const BACKGROUND_TASK = 'lumidose-background-reschedule';

TaskManager.defineTask(BACKGROUND_TASK, async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return BackgroundTask.BackgroundTaskResult.Success;

    const { data: medications } = await supabase
      .from('medications')
      .select('*, schedules:medication_schedules(*)')
      .eq('user_id', session.user.id)
      .eq('is_active', true);

    if (medications) await rescheduleAllNotifications(medications);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const startYesterday = new Date(yesterday);
    startYesterday.setHours(0, 0, 0, 0);
    const endYesterday = new Date(yesterday);
    endYesterday.setHours(23, 59, 59, 999);

    await supabase
      .from('medication_logs')
      .update({ status: 'missed' })
      .eq('user_id', session.user.id)
      .eq('status', 'pending')
      .gte('scheduled_at', startYesterday.toISOString())
      .lte('scheduled_at', endYesterday.toISOString());

    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

// ---------------------------------------------------------------------------
// Root layout
// ---------------------------------------------------------------------------

export default function RootLayout() {
  const { initialized, session, initialize } = useAuthStore();
  const { fetchMedications } = useMedicationStore();
  const { generateTodayLogs } = useLogStore();
  const router = useRouter();
  const segments = useSegments();

  // 1. Bootstrap auth
  useEffect(() => {
    initialize();
  }, []);

  // 2. Route protection
  useEffect(() => {
    if (!initialized) return;
    const inAuth = segments[0] === '(auth)';
    if (!session && !inAuth) {
      router.replace('/(auth)/login');
    } else if (session && inAuth) {
      router.replace('/(tabs)');
    }
  }, [session, initialized]);

  // 3. Load data when signed in
  useEffect(() => {
    if (session?.user) {
      fetchMedications();
      generateTodayLogs(session.user.id);
    }
  }, [session?.user?.id]);

  // 4. Notifications + background task
  useEffect(() => {
    // Request OS permission first; register categories only if granted.
    requestNotificationPermissions().then((granted) => {
      if (granted) {
        registerNotificationCategories();
      }
    });

    BackgroundTask.registerTaskAsync(BACKGROUND_TASK, {
      minimumInterval: 60 * 24, // 24 hours in minutes
    }).catch(() => undefined);

    const processNotificationResponse = async (
      response: Notifications.NotificationResponse
    ) => {
      try {
        await handleMedicationNotificationResponse(response);
        Notifications.clearLastNotificationResponse();
        await useLogStore.getState().fetchTodayLogs();
      } catch (error) {
        console.error('[notification response handler]', error);
      }
    };

    // Actions open Lumidose, so this listener handles responses while the app
    // process is alive.
    const responseSub = Notifications.addNotificationResponseReceivedListener(
      processNotificationResponse
    );

    // If Android launched the app from a killed state, the response may exist
    // before the listener is mounted. Process that cold-start response here.
    if (session?.user) {
      Notifications.getLastNotificationResponseAsync()
        .then((response) => {
          if (response) return processNotificationResponse(response);
        })
        .catch((error) => console.error('[last notification response]', error));
    }

    const appStateSub = AppState.addEventListener(
      'change',
      async (nextState: AppStateStatus) => {
        if (nextState === 'active' && session?.user) {
          await useLogStore.getState().fetchTodayLogs();
          const { data: meds } = await supabase
            .from('medications')
            .select('*, schedules:medication_schedules(*)')
            .eq('user_id', session.user.id)
            .eq('is_active', true);
          if (meds) await rescheduleAllNotifications(meds);
        }
      }
    );

    return () => {
      responseSub.remove();
      appStateSub.remove();
    };
  }, [session?.user?.id]);

  if (!initialized) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={appTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="medications/add"
            options={{
              headerShown: true,
              title: 'Add Medication',
              presentation: 'modal',
              headerTintColor: colors.primary,
            }}
          />
          <Stack.Screen
            name="medications/[id]"
            options={{
              headerShown: true,
              title: 'Edit Medication',
              presentation: 'modal',
              headerTintColor: colors.primary,
            }}
          />
        </Stack>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}

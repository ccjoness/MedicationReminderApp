import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
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
  rescheduleAllNotifications,
  scheduleSnoozeNotification,
  cancelSnoozeNotificationsForDose,
  sendImmediateNotification,
  ACTION_TOOK_IT,
  ACTION_SNOOZE,
} from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import type { NotificationData } from '@/types';

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
    registerNotificationCategories();

    BackgroundTask.registerTaskAsync(BACKGROUND_TASK, {
      minimumInterval: 60 * 24, // 24 hours in minutes
    }).catch(() => undefined);

    const responseSub = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const { actionIdentifier, notification } = response;
        const data = notification.request.content.data as NotificationData;
        if (!data?.medicationId) return;

        const { medicationId, scheduledAt, medicationName, dosage, snoozeIntervalMinutes } = data;
        const snoozeCount = data.snoozeCount ?? 0;

        const { data: log } = await supabase
          .from('medication_logs')
          .select('*')
          .eq('medication_id', medicationId)
          .eq('scheduled_at', scheduledAt)
          .maybeSingle();

        if (actionIdentifier === ACTION_TOOK_IT) {
          if (log) {
            const now = new Date().toISOString();
            await supabase
              .from('medication_logs')
              .update({ status: 'taken', taken_at: now })
              .eq('id', log.id);

            await cancelSnoozeNotificationsForDose(medicationId, scheduledAt);

            const { data: med } = await supabase
              .from('medications')
              .select('refill_count, low_refill_threshold, name')
              .eq('id', medicationId)
              .single();

            if (med?.refill_count !== null && med?.refill_count !== undefined) {
              const newCount = Math.max(0, (med.refill_count as number) - 1);
              await supabase
                .from('medications')
                .update({ refill_count: newCount })
                .eq('id', medicationId);

              if (med.low_refill_threshold !== null && newCount <= (med.low_refill_threshold as number)) {
                await sendImmediateNotification(
                  `Low supply: ${med.name as string}`,
                  `Only ${newCount} pill(s) remaining. Time to refill!`,
                  { type: 'refill_warning', medicationId }
                );
              }
            }
          }
        } else if (actionIdentifier === ACTION_SNOOZE) {
          if (log) {
            await supabase
              .from('medication_logs')
              .update({ status: 'snoozed', snooze_count: snoozeCount + 1 })
              .eq('id', log.id);
          }
          await scheduleSnoozeNotification(
            medicationId, medicationName, dosage ?? '',
            scheduledAt, snoozeIntervalMinutes, snoozeCount + 1
          );
        }
      }
    );

    const appStateSub = AppState.addEventListener(
      'change',
      async (nextState: AppStateStatus) => {
        if (nextState === 'active' && session?.user) {
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
      <PaperProvider theme={MD3LightTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="medications/add"
            options={{
              headerShown: true,
              title: 'Add Medication',
              presentation: 'modal',
              headerTintColor: '#6750A4',
            }}
          />
          <Stack.Screen
            name="medications/[id]"
            options={{
              headerShown: true,
              title: 'Edit Medication',
              presentation: 'modal',
              headerTintColor: '#6750A4',
            }}
          />
        </Stack>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}

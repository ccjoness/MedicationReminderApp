import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useAuthStore } from '@/stores/authStore';
import { useMissionStore } from '@/stores/missionStore';
import { useOccurrenceStore } from '@/stores/occurrenceStore';
import {
  cancelLegacyMedicationNotifications,
  registerNotificationCategories,
  requestNotificationPermissions,
  rescheduleAllNotifications,
} from '@/lib/notifications';
import { handleMissionNotificationResponse } from '@/lib/notificationActions';
import { supabase } from '@/lib/supabase';
import { appTheme, colors } from '@/theme';

GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, scopes: ['profile', 'email'] });

const BACKGROUND_TASK = 'mission-mode-background-reschedule';
const OLD_BACKGROUND_TASK = 'lumidose-background-reschedule';

TaskManager.defineTask(BACKGROUND_TASK, async () => {
  try {
    const userId = (await supabase.auth.getSession()).data.session?.user.id;
    if (!userId) return BackgroundTask.BackgroundTaskResult.Success;
    const { data: missions } = await supabase
      .from('missions')
      .select('*, schedules:mission_schedules(*)')
      .eq('user_id', userId)
      .eq('is_active', true);
    if (missions) await rescheduleAllNotifications(missions);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const start = new Date(yesterday);
    start.setHours(0, 0, 0, 0);
    const end = new Date(yesterday);
    end.setHours(23, 59, 59, 999);
    await supabase
      .from('mission_occurrences')
      .update({ status: 'expired' })
      .eq('user_id', userId)
      .eq('status', 'pending')
      .gte('scheduled_at', start.toISOString())
      .lte('scheduled_at', end.toISOString());
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export default function RootLayout() {
  const { initialized, session, initialize } = useAuthStore();
  const { fetchMissions } = useMissionStore();
  const { generateTodayOccurrences } = useOccurrenceStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => { initialize(); }, []);

  useEffect(() => {
    if (!initialized) return;
    const inAuth = segments[0] === '(auth)';
    if (!session && !inAuth) router.replace('/(auth)/login');
    if (session && inAuth) router.replace('/(tabs)');
  }, [session, initialized]);

  useEffect(() => {
    if (!session?.user) return;
    fetchMissions();
    generateTodayOccurrences(session.user.id);
  }, [session?.user?.id]);

  useEffect(() => {
    cancelLegacyMedicationNotifications().catch(() => undefined);
    requestNotificationPermissions().then((granted) => granted && registerNotificationCategories());
    TaskManager.isTaskRegisteredAsync(OLD_BACKGROUND_TASK).then((registered) => {
      if (registered) BackgroundTask.unregisterTaskAsync(OLD_BACKGROUND_TASK);
    });
    BackgroundTask.registerTaskAsync(BACKGROUND_TASK, { minimumInterval: 60 * 24 }).catch(() => undefined);

    const processResponse = async (response: Notifications.NotificationResponse) => {
      try {
        await handleMissionNotificationResponse(response);
        Notifications.clearLastNotificationResponse();
        await useOccurrenceStore.getState().fetchTodayOccurrences();
      } catch (error) {
        console.error('[mission notification response]', error);
      }
    };
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(processResponse);
    if (session?.user) {
      Notifications.getLastNotificationResponseAsync().then((response) => response && processResponse(response));
    }
    const appStateSubscription = AppState.addEventListener('change', async (state: AppStateStatus) => {
      if (state !== 'active' || !session?.user) return;
      await useOccurrenceStore.getState().fetchTodayOccurrences();
      const { data } = await supabase
        .from('missions')
        .select('*, schedules:mission_schedules(*)')
        .eq('user_id', session.user.id)
        .eq('is_active', true);
      if (data) await rescheduleAllNotifications(data);
    });
    return () => {
      responseSubscription.remove();
      appStateSubscription.remove();
    };
  }, [session?.user?.id]);

  if (!initialized) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={appTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="missions/add" options={{ headerShown: true, title: 'Add Mission', presentation: 'modal', headerTintColor: colors.primary }} />
          <Stack.Screen name="missions/[id]" options={{ headerShown: true, title: 'Edit Mission', presentation: 'modal', headerTintColor: colors.primary }} />
        </Stack>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}

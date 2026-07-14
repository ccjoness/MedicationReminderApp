import { useEffect } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useAuthStore } from '@/stores/authStore';
import { useMedicationStore } from '@/stores/medicationStore';
import { useLogStore } from '@/stores/logStore';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Native-only: background task + notifications
// These modules use native APIs unavailable on web.
// ---------------------------------------------------------------------------

// TaskManager.defineTask must be called at the module top level on native.
// We wrap in a Platform check so the module isn't even imported on web.
if (Platform.OS !== 'web') {
  // Dynamic requires to avoid importing native modules in the web bundle.
  const TaskManager = require('expo-task-manager');
  const BackgroundTask = require('expo-background-task');
  const {
    rescheduleAllNotifications,
  } = require('@/lib/notifications');

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
}

// ---------------------------------------------------------------------------
// Root layout component
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

  // 2. Route protection — redirect based on session
  useEffect(() => {
    if (!initialized) return;
    const inAuth = segments[0] === '(auth)';
    const inCallback = segments[0] === 'auth'; // web OAuth callback
    if (!session && !inAuth && !inCallback) {
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

  // 4. Native-only: notifications + background task
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const {
      registerNotificationCategories,
      rescheduleAllNotifications,
      scheduleSnoozeNotification,
      cancelSnoozeNotificationsForDose,
      sendImmediateNotification,
      ACTION_TOOK_IT,
      ACTION_SNOOZE,
    } = require('@/lib/notifications');

    const Notifications = require('expo-notifications');
    const BackgroundTask = require('expo-background-task');

    const BACKGROUND_TASK = 'lumidose-background-reschedule';

    registerNotificationCategories();

    BackgroundTask.registerTaskAsync(BACKGROUND_TASK, {
      minimumInterval: 60 * 24,
    }).catch(() => undefined);

    const responseSub = Notifications.addNotificationResponseReceivedListener(
      async (response: any) => {
        const { actionIdentifier, notification } = response;
        const data = notification.request.content.data;
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
          <Stack.Screen name="auth/callback" />
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

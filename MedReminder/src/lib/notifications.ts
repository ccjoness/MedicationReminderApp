import * as Notifications from 'expo-notifications';
import type { Medication, MedicationSchedule } from '../types';

// ---------------------------------------------------------------------------
// Category / action identifiers
// ---------------------------------------------------------------------------

export const NOTIFICATION_CATEGORY_ID = 'MEDICATION_REMINDER';
export const ACTION_TOOK_IT = 'TOOK_IT';
export const ACTION_SNOOZE = 'SNOOZE';

// ---------------------------------------------------------------------------
// Global notification display handler
// ---------------------------------------------------------------------------

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ---------------------------------------------------------------------------
// Interactive notification categories
// Register at module load to ensure categories exist before any notifications
// are scheduled. This is critical for action buttons to work on Android.
// ---------------------------------------------------------------------------

Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORY_ID, [
  {
    identifier: ACTION_TOOK_IT,
    buttonTitle: 'Took it',
    options: { opensAppToForeground: true },
  },
  {
    identifier: ACTION_SNOOZE,
    buttonTitle: 'Snooze',
    options: { opensAppToForeground: true },
  },
]).catch((error) => {
  console.error('[notifications] Failed to register notification category:', error);
});

/**
 * Explicitly register notification categories.
 * This is called after permissions are granted to ensure the category is
 * properly registered on all platforms.
 */
export async function registerNotificationCategories(): Promise<void> {
  try {
    await Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORY_ID, [
      {
        identifier: ACTION_TOOK_IT,
        buttonTitle: 'Took it',
        options: { opensAppToForeground: true },
      },
      {
        identifier: ACTION_SNOOZE,
        buttonTitle: 'Snooze',
        options: { opensAppToForeground: true },
      },
    ]);
  } catch (error) {
    console.error('[notifications] Failed to register notification category:', error);
  }
}

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

/**
 * Requests notification permission (POST_NOTIFICATIONS on Android 13+).
 * Returns true when the app can present notifications.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  // 1. Basic notification permission (Android 13+ / iOS)
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let status = existingStatus;

  if (existingStatus !== 'granted') {
    const result = await Notifications.requestPermissionsAsync();
    status = result.status;
  }

  if (status !== 'granted') return false;

  return true;
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

export function getNextOccurrences(schedule: MedicationSchedule, daysAhead = 7): Date[] {
  const now = new Date();
  const [hours, minutes] = schedule.time_of_day.split(':').map(Number);
  const results: Date[] = [];

  for (let i = 0; i < daysAhead; i++) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + i);
    candidate.setHours(hours, minutes, 0, 0);
    if (i === 0 && candidate <= now) continue;
    const dayOfWeek = candidate.getDay();
    const everyDay = schedule.days_of_week.length === 0;
    if (everyDay || schedule.days_of_week.includes(dayOfWeek)) {
      results.push(candidate);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Schedule / cancel helpers
// ---------------------------------------------------------------------------

/**
 * Schedule local notifications for a medication over the next 7 days.
 * Throws a user-friendly error if scheduling fails (e.g. permission denied).
 * Returns the number of notifications successfully scheduled.
 */
export async function scheduleNotificationsForMedication(
  medication: Medication,
  schedules: MedicationSchedule[]
): Promise<number> {
  let count = 0;
  for (const schedule of schedules) {
    const occurrences = getNextOccurrences(schedule, 7);
    for (const scheduledAt of occurrences) {
      try {
        await Notifications.scheduleNotificationAsync({
          identifier: `med_${medication.id}_${schedule.id}_${scheduledAt.toISOString()}`,
          content: {
            title: `Time to take ${medication.name}`,
            body: `${medication.dosage} — tap to respond`,
            categoryIdentifier: NOTIFICATION_CATEGORY_ID,
            data: {
              medicationId: medication.id,
              scheduleId: schedule.id,
              scheduledAt: scheduledAt.toISOString(),
              medicationName: medication.name,
              dosage: medication.dosage,
              snoozeIntervalMinutes: medication.snooze_interval_minutes,
              snoozeCount: 0,
              isSnooze: false,
            },
            sound: true,
          },
          trigger: {
            date: scheduledAt,
            type: Notifications.SchedulableTriggerInputTypes.DATE,
          },
        });
        count++;
      } catch (e) {
        // Surface the real error so it's not silent
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[notifications] scheduleNotificationAsync failed:', msg);
        throw new Error(
          `Could not schedule reminder for ${medication.name} at ${scheduledAt.toLocaleTimeString()}.\n\nPlease ensure Lumidose has notification and alarm permissions in your device settings.`
        );
      }
    }
  }
  return count;
}

export async function cancelNotificationsForMedication(medicationId: string): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = all.filter(
    (n) => (n.content.data as Record<string, unknown>)?.medicationId === medicationId
  );
  await Promise.all(toCancel.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}

export async function cancelSnoozeNotificationsForDose(
  medicationId: string,
  scheduledAt: string
): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = all.filter((n) => {
    const d = n.content.data as Record<string, unknown>;
    return d?.medicationId === medicationId && d?.scheduledAt === scheduledAt && d?.isSnooze === true;
  });
  await Promise.all(toCancel.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}

export async function scheduleSnoozeNotification(
  medicationId: string,
  medicationName: string,
  dosage: string,
  scheduledAt: string,
  snoozeIntervalMinutes: number,
  snoozeCount: number
): Promise<void> {
  const fireAt = new Date(Date.now() + snoozeIntervalMinutes * 60 * 1000);
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: `snooze_${medicationId}_${scheduledAt}_${snoozeCount}`,
      content: {
        title: `Reminder: ${medicationName}`,
        body: `${dosage} — did you take it?`,
        categoryIdentifier: NOTIFICATION_CATEGORY_ID,
        data: {
          medicationId, scheduledAt, medicationName, dosage,
          snoozeIntervalMinutes, snoozeCount, isSnooze: true,
        },
        sound: true,
      },
      trigger: { date: fireAt, type: Notifications.SchedulableTriggerInputTypes.DATE },
    });
  } catch (e) {
    console.error('[notifications] scheduleSnoozeNotification failed:', e);
  }
}

export async function rescheduleAllNotifications(medications: Medication[]): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = all.filter((n) => {
    const d = n.content.data as Record<string, unknown>;
    return d?.medicationId !== undefined && d?.isSnooze !== true;
  });
  await Promise.all(toCancel.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));

  for (const medication of medications) {
    if (medication.is_active && medication.schedules?.length) {
      try {
        await scheduleNotificationsForMedication(medication, medication.schedules);
      } catch (e) {
        console.error(`[notifications] reschedule failed for ${medication.name}:`, e);
      }
    }
  }
}

export async function sendImmediateNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data, sound: true },
      trigger: null,
    });
  } catch (e) {
    console.error('[notifications] sendImmediateNotification failed:', e);
  }
}

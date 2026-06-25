import * as Notifications from 'expo-notifications';
import type { Medication, MedicationSchedule } from '../types';

// ---------------------------------------------------------------------------
// Global notification display handler
// ---------------------------------------------------------------------------

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,  // replaces shouldShowAlert (removed in expo-notifications v0.32)
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ---------------------------------------------------------------------------
// Category / action identifiers
// ---------------------------------------------------------------------------

export const NOTIFICATION_CATEGORY_ID = 'MEDICATION_REMINDER';
export const ACTION_TOOK_IT = 'TOOK_IT';
export const ACTION_SNOOZE = 'SNOOZE';

// ---------------------------------------------------------------------------
// Set up interactive notification categories
// ---------------------------------------------------------------------------

export async function registerNotificationCategories(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORY_ID, [
    {
      identifier: ACTION_TOOK_IT,
      buttonTitle: 'Took it',
      options: { opensAppToForeground: false },
    },
    {
      identifier: ACTION_SNOOZE,
      buttonTitle: 'Snooze',
      options: { opensAppToForeground: false },
    },
  ]);
}

// ---------------------------------------------------------------------------
// Permission helpers
// ---------------------------------------------------------------------------

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/**
 * Returns the next N days (starting today) when the given schedule fires.
 * Occurrences whose time has already passed *today* are excluded.
 */
export function getNextOccurrences(
  schedule: MedicationSchedule,
  daysAhead = 7
): Date[] {
  const now = new Date();
  const [hours, minutes] = schedule.time_of_day.split(':').map(Number);
  const results: Date[] = [];

  for (let i = 0; i < daysAhead; i++) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + i);
    candidate.setHours(hours, minutes, 0, 0);

    // Skip times that have already passed today
    if (i === 0 && candidate <= now) continue;

    const dayOfWeek = candidate.getDay(); // 0 = Sun … 6 = Sat
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
 * Notification identifiers are deterministic so re-scheduling is idempotent.
 */
export async function scheduleNotificationsForMedication(
  medication: Medication,
  schedules: MedicationSchedule[]
): Promise<void> {
  for (const schedule of schedules) {
    const occurrences = getNextOccurrences(schedule, 7);

    for (const scheduledAt of occurrences) {
      const identifier = `med_${medication.id}_${schedule.id}_${scheduledAt.toISOString()}`;

      await Notifications.scheduleNotificationAsync({
        identifier,
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
        trigger: { date: scheduledAt, type: Notifications.SchedulableTriggerInputTypes.DATE },
      });
    }
  }
}

/**
 * Cancel all scheduled notifications that belong to a given medication.
 */
export async function cancelNotificationsForMedication(
  medicationId: string
): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = all.filter(
    (n) => (n.content.data as Record<string, unknown>)?.medicationId === medicationId
  );
  await Promise.all(
    toCancel.map((n) =>
      Notifications.cancelScheduledNotificationAsync(n.identifier)
    )
  );
}

/**
 * Cancel only the snooze follow-up notifications for a specific dose.
 * Used when the user marks a dose as "Took it" after prior snoozes.
 */
export async function cancelSnoozeNotificationsForDose(
  medicationId: string,
  scheduledAt: string
): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = all.filter((n) => {
    const d = n.content.data as Record<string, unknown>;
    return (
      d?.medicationId === medicationId &&
      d?.scheduledAt === scheduledAt &&
      d?.isSnooze === true
    );
  });
  await Promise.all(
    toCancel.map((n) =>
      Notifications.cancelScheduledNotificationAsync(n.identifier)
    )
  );
}

/**
 * Schedule a snooze follow-up notification for a dose.
 */
export async function scheduleSnoozeNotification(
  medicationId: string,
  medicationName: string,
  dosage: string,
  scheduledAt: string,
  snoozeIntervalMinutes: number,
  snoozeCount: number
): Promise<void> {
  const fireAt = new Date(Date.now() + snoozeIntervalMinutes * 60 * 1000);
  const identifier = `snooze_${medicationId}_${scheduledAt}_${snoozeCount}`;

  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: `Reminder: ${medicationName}`,
      body: `${dosage} — did you take it?`,
      categoryIdentifier: NOTIFICATION_CATEGORY_ID,
      data: {
        medicationId,
        scheduledAt,
        medicationName,
        dosage,
        snoozeIntervalMinutes,
        snoozeCount,
        isSnooze: true,
      },
      sound: true,
    },
    trigger: { date: fireAt, type: Notifications.SchedulableTriggerInputTypes.DATE },
  });
}

/**
 * Cancel & reschedule notifications for ALL active medications.
 * Called from the background task and on app foreground.
 */
export async function rescheduleAllNotifications(
  medications: Medication[]
): Promise<void> {
  // Cancel existing medication notifications (not snooze follow-ups)
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = all.filter((n) => {
    const d = n.content.data as Record<string, unknown>;
    return d?.medicationId !== undefined && d?.isSnooze !== true;
  });
  await Promise.all(
    toCancel.map((n) =>
      Notifications.cancelScheduledNotificationAsync(n.identifier)
    )
  );

  // Reschedule
  for (const medication of medications) {
    if (medication.is_active && medication.schedules?.length) {
      await scheduleNotificationsForMedication(medication, medication.schedules);
    }
  }
}

/**
 * Send an immediate local notification (e.g. low-refill warning).
 */
export async function sendImmediateNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data, sound: true },
    trigger: null,
  });
}

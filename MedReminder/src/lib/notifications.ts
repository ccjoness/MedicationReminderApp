import { Platform } from 'react-native';
import type { Medication, MedicationSchedule } from '../types';

// ---------------------------------------------------------------------------
// Notifications are native-only. All exports are safe to call on web —
// they simply no-op so shared code doesn't need Platform guards everywhere.
// ---------------------------------------------------------------------------

// Lazily resolve the expo-notifications module only on native.
function getNative() {
  if (Platform.OS === 'web') return null;
  return require('expo-notifications') as typeof import('expo-notifications');
}

// ---------------------------------------------------------------------------
// Global notification display handler (native only)
// ---------------------------------------------------------------------------

if (Platform.OS !== 'web') {
  const Notifications = getNative()!;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// ---------------------------------------------------------------------------
// Category / action identifiers
// ---------------------------------------------------------------------------

export const NOTIFICATION_CATEGORY_ID = 'MEDICATION_REMINDER';
export const ACTION_TOOK_IT = 'TOOK_IT';
export const ACTION_SNOOZE = 'SNOOZE';

// ---------------------------------------------------------------------------
// Set up interactive notification categories (native only)
// ---------------------------------------------------------------------------

export async function registerNotificationCategories(): Promise<void> {
  const N = getNative();
  if (!N) return;
  await N.setNotificationCategoryAsync(NOTIFICATION_CATEGORY_ID, [
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
  const N = getNative();
  if (!N) return false;
  const { status: existingStatus } = await N.getPermissionsAsync();
  if (existingStatus === 'granted') return true;
  const { status } = await N.requestPermissionsAsync();
  return status === 'granted';
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

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
// Schedule / cancel helpers (all no-op on web)
// ---------------------------------------------------------------------------

export async function scheduleNotificationsForMedication(
  medication: Medication,
  schedules: MedicationSchedule[]
): Promise<void> {
  const N = getNative();
  if (!N) return;

  for (const schedule of schedules) {
    const occurrences = getNextOccurrences(schedule, 7);
    for (const scheduledAt of occurrences) {
      const identifier = `med_${medication.id}_${schedule.id}_${scheduledAt.toISOString()}`;
      await N.scheduleNotificationAsync({
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
        trigger: {
          date: scheduledAt,
          type: N.SchedulableTriggerInputTypes.DATE,
        },
      });
    }
  }
}

export async function cancelNotificationsForMedication(
  medicationId: string
): Promise<void> {
  const N = getNative();
  if (!N) return;
  const all = await N.getAllScheduledNotificationsAsync();
  const toCancel = all.filter(
    (n) => (n.content.data as Record<string, unknown>)?.medicationId === medicationId
  );
  await Promise.all(toCancel.map((n) => N.cancelScheduledNotificationAsync(n.identifier)));
}

export async function cancelSnoozeNotificationsForDose(
  medicationId: string,
  scheduledAt: string
): Promise<void> {
  const N = getNative();
  if (!N) return;
  const all = await N.getAllScheduledNotificationsAsync();
  const toCancel = all.filter((n) => {
    const d = n.content.data as Record<string, unknown>;
    return d?.medicationId === medicationId && d?.scheduledAt === scheduledAt && d?.isSnooze === true;
  });
  await Promise.all(toCancel.map((n) => N.cancelScheduledNotificationAsync(n.identifier)));
}

export async function scheduleSnoozeNotification(
  medicationId: string,
  medicationName: string,
  dosage: string,
  scheduledAt: string,
  snoozeIntervalMinutes: number,
  snoozeCount: number
): Promise<void> {
  const N = getNative();
  if (!N) return;
  const fireAt = new Date(Date.now() + snoozeIntervalMinutes * 60 * 1000);
  await N.scheduleNotificationAsync({
    identifier: `snooze_${medicationId}_${scheduledAt}_${snoozeCount}`,
    content: {
      title: `Reminder: ${medicationName}`,
      body: `${dosage} — did you take it?`,
      categoryIdentifier: NOTIFICATION_CATEGORY_ID,
      data: { medicationId, scheduledAt, medicationName, dosage, snoozeIntervalMinutes, snoozeCount, isSnooze: true },
      sound: true,
    },
    trigger: { date: fireAt, type: N.SchedulableTriggerInputTypes.DATE },
  });
}

export async function rescheduleAllNotifications(
  medications: Medication[]
): Promise<void> {
  const N = getNative();
  if (!N) return;
  const all = await N.getAllScheduledNotificationsAsync();
  const toCancel = all.filter((n) => {
    const d = n.content.data as Record<string, unknown>;
    return d?.medicationId !== undefined && d?.isSnooze !== true;
  });
  await Promise.all(toCancel.map((n) => N.cancelScheduledNotificationAsync(n.identifier)));
  for (const medication of medications) {
    if (medication.is_active && medication.schedules?.length) {
      await scheduleNotificationsForMedication(medication, medication.schedules);
    }
  }
}

export async function sendImmediateNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  const N = getNative();
  if (!N) return;
  await N.scheduleNotificationAsync({
    content: { title, body, data, sound: true },
    trigger: null,
  });
}

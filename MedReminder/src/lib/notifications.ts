import * as Notifications from 'expo-notifications';
import type { Mission, MissionSchedule } from '../types';

export const MISSION_NOTIFICATION_CATEGORY_ID = 'MISSION_REMINDER';
export const ACTION_COMPLETE = 'COMPLETE';
export const ACTION_SNOOZE = 'SNOOZE';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const actions: Notifications.NotificationAction[] = [
  { identifier: ACTION_COMPLETE, buttonTitle: 'Complete', options: { opensAppToForeground: true } },
  { identifier: ACTION_SNOOZE, buttonTitle: 'Snooze', options: { opensAppToForeground: true } },
];

Notifications.setNotificationCategoryAsync(MISSION_NOTIFICATION_CATEGORY_ID, actions).catch(
  (error) => console.error('[notifications] category registration failed', error)
);

export const registerNotificationCategories = () =>
  Notifications.setNotificationCategoryAsync(MISSION_NOTIFICATION_CATEGORY_ID, actions).then(() => undefined);

/** Remove notifications created by pre-mission versions of the app. */
export async function cancelLegacyMedicationNotifications(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((notification) => notification.content.data?.medicationId !== undefined)
      .map((notification) =>
        Notifications.cancelScheduledNotificationAsync(notification.identifier)
      )
  );
  await Notifications.deleteNotificationCategoryAsync('MEDICATION_REMINDER').catch(() => undefined);
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  return (await Notifications.requestPermissionsAsync()).status === 'granted';
}

export function getNextOccurrences(schedule: MissionSchedule, daysAhead = 7): Date[] {
  const now = new Date();
  const [hours, minutes] = schedule.time_of_day.split(':').map(Number);
  const occurrences: Date[] = [];
  for (let offset = 0; offset < daysAhead; offset++) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + offset);
    candidate.setHours(hours, minutes, 0, 0);
    if (offset === 0 && candidate <= now) continue;
    if (!schedule.days_of_week.length || schedule.days_of_week.includes(candidate.getDay())) {
      occurrences.push(candidate);
    }
  }
  return occurrences;
}

export async function scheduleNotificationsForMission(
  mission: Mission,
  schedules: MissionSchedule[]
): Promise<number> {
  let count = 0;
  for (const schedule of schedules) {
    for (const scheduledAt of getNextOccurrences(schedule)) {
      try {
        await Notifications.scheduleNotificationAsync({
          identifier: `mission_${mission.id}_${schedule.id}_${scheduledAt.toISOString()}`,
          content: {
            title: `Mission: ${mission.title}`,
            body: mission.description || 'Ready to complete it?',
            categoryIdentifier: MISSION_NOTIFICATION_CATEGORY_ID,
            data: {
              missionId: mission.id,
              scheduleId: schedule.id,
              scheduledAt: scheduledAt.toISOString(),
              missionTitle: mission.title,
              snoozeIntervalMinutes: mission.snooze_interval_minutes,
              snoozeCount: 0,
              isSnooze: false,
            },
            sound: true,
          },
          trigger: { date: scheduledAt, type: Notifications.SchedulableTriggerInputTypes.DATE },
        });
        count++;
      } catch {
        throw new Error(`Could not schedule “${mission.title}”. Check notification and alarm permissions.`);
      }
    }
  }
  return count;
}

export async function cancelNotificationsForMission(missionId: string): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all
      .filter((notification) => notification.content.data?.missionId === missionId)
      .map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier))
  );
}

export async function cancelSnoozeNotificationsForOccurrence(
  missionId: string,
  scheduledAt: string
): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all
      .filter((notification) => {
        const data = notification.content.data;
        return data?.missionId === missionId && data?.scheduledAt === scheduledAt && data?.isSnooze === true;
      })
      .map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier))
  );
}

export async function scheduleSnoozeNotification(
  missionId: string,
  missionTitle: string,
  description: string | null,
  scheduledAt: string,
  snoozeIntervalMinutes: number,
  snoozeCount: number
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: `mission_snooze_${missionId}_${scheduledAt}_${snoozeCount}`,
    content: {
      title: `Still ready for: ${missionTitle}?`,
      body: description || 'Complete it when ready, or snooze for more time.',
      categoryIdentifier: MISSION_NOTIFICATION_CATEGORY_ID,
      data: { missionId, scheduledAt, missionTitle, snoozeIntervalMinutes, snoozeCount, isSnooze: true },
      sound: true,
    },
    trigger: {
      date: new Date(Date.now() + snoozeIntervalMinutes * 60 * 1000),
      type: Notifications.SchedulableTriggerInputTypes.DATE,
    },
  });
}

export async function rescheduleAllNotifications(missions: Mission[]): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all
      .filter((notification) => notification.content.data?.missionId && notification.content.data?.isSnooze !== true)
      .map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier))
  );
  for (const mission of missions) {
    if (!mission.is_active || !mission.schedules?.length) continue;
    try {
      await scheduleNotificationsForMission(mission, mission.schedules);
    } catch (error) {
      console.error(`[notifications] reschedule failed for ${mission.title}`, error);
    }
  }
}

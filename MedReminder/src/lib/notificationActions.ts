import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';
import {
  ACTION_SNOOZE,
  ACTION_TOOK_IT,
  cancelSnoozeNotificationsForDose,
  scheduleSnoozeNotification,
} from './notifications';
import type { MedicationLog, NotificationData } from '../types';

export const NOTIFICATION_ACTION_TASK = 'lumidose-notification-actions';

const MAX_SNOOZE_COUNT = 10;

async function getOrCreateLog(
  userId: string,
  data: NotificationData
): Promise<MedicationLog> {
  const { data: existing, error: selectError } = await supabase
    .from('medication_logs')
    .select('*')
    .eq('medication_id', data.medicationId)
    .eq('scheduled_at', data.scheduledAt)
    .eq('user_id', userId)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing as MedicationLog;

  const { data: inserted, error: insertError } = await supabase
    .from('medication_logs')
    .insert({
      medication_id: data.medicationId,
      user_id: userId,
      scheduled_at: data.scheduledAt,
      status: 'pending',
      snooze_count: 0,
    })
    .select('*')
    .single();

  if (!insertError && inserted) return inserted as MedicationLog;

  // A concurrent app startup may have inserted the row after our first query.
  const { data: concurrent, error: concurrentError } = await supabase
    .from('medication_logs')
    .select('*')
    .eq('medication_id', data.medicationId)
    .eq('scheduled_at', data.scheduledAt)
    .eq('user_id', userId)
    .single();

  if (concurrentError) throw insertError ?? concurrentError;
  return concurrent as MedicationLog;
}

/**
 * Process a medication notification action in foreground or headless mode.
 * The function reads auth from persisted Supabase state, so it does not depend
 * on the Zustand store being initialized when Android launches a background task.
 */
export async function handleMedicationNotificationResponse(
  response: Notifications.NotificationResponse
): Promise<void> {
  const { actionIdentifier, notification } = response;
  if (actionIdentifier !== ACTION_TOOK_IT && actionIdentifier !== ACTION_SNOOZE) return;

  const data = notification.request.content.data as unknown as NotificationData;
  if (!data?.medicationId || !data?.scheduledAt) return;

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error('Cannot process medication action without a session.');

  // Never trust notification payload IDs without checking ownership.
  const { data: medication, error: medicationError } = await supabase
    .from('medications')
    .select('id, name, dosage, snooze_interval_minutes, is_active')
    .eq('id', data.medicationId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (medicationError) throw medicationError;
  if (!medication) return;

  const log = await getOrCreateLog(userId, data);

  if (actionIdentifier === ACTION_TOOK_IT) {
    // Only the first transition to taken decrements inventory. Replayed actions
    // are harmless and cannot decrement the refill count twice.
    const { data: changed, error } = await supabase
      .from('medication_logs')
      .update({ status: 'taken', taken_at: new Date().toISOString() })
      .eq('id', log.id)
      .eq('user_id', userId)
      .neq('status', 'taken')
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (changed) {
      const { error: decrementError } = await supabase.rpc('decrement_refill_count', {
        med_id: data.medicationId,
      });
      if (decrementError) throw decrementError;
    }

    await cancelSnoozeNotificationsForDose(data.medicationId, data.scheduledAt);
  }

  if (actionIdentifier === ACTION_SNOOZE) {
    const nextSnoozeCount = log.snooze_count + 1;
    if (nextSnoozeCount <= MAX_SNOOZE_COUNT) {
      const { error } = await supabase
        .from('medication_logs')
        .update({ status: 'snoozed', snooze_count: nextSnoozeCount })
        .eq('id', log.id)
        .eq('user_id', userId);

      if (error) throw error;

      await scheduleSnoozeNotification(
        data.medicationId,
        medication.name,
        medication.dosage,
        data.scheduledAt,
        medication.snooze_interval_minutes,
        nextSnoozeCount
      );
    }
  }

  await Notifications.dismissNotificationAsync(notification.request.identifier).catch(() => undefined);
}

import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';
import {
  ACTION_COMPLETE,
  ACTION_SNOOZE,
  cancelSnoozeNotificationsForOccurrence,
  scheduleSnoozeNotification,
} from './notifications';
import type { MissionNotificationData, MissionOccurrence } from '../types';

const MAX_SNOOZE_COUNT = 10;
const processedActionKeys = new Set<string>();

async function getOrCreateOccurrence(userId: string, payload: MissionNotificationData) {
  const { data: existing, error } = await supabase
    .from('mission_occurrences')
    .select('*')
    .eq('mission_id', payload.missionId)
    .eq('scheduled_at', payload.scheduledAt)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing as MissionOccurrence;

  const { data, error: insertError } = await supabase
    .from('mission_occurrences')
    .insert({
      mission_id: payload.missionId,
      user_id: userId,
      scheduled_at: payload.scheduledAt,
      status: 'pending',
      snooze_count: 0,
    })
    .select('*')
    .single();
  if (insertError) throw insertError;
  return data as MissionOccurrence;
}

export async function handleMissionNotificationResponse(response: Notifications.NotificationResponse) {
  const { actionIdentifier, notification } = response;
  if (actionIdentifier !== ACTION_COMPLETE && actionIdentifier !== ACTION_SNOOZE) return;

  const actionKey = `${notification.request.identifier}:${actionIdentifier}`;
  if (processedActionKeys.has(actionKey)) return;
  processedActionKeys.add(actionKey);

  try {
    const payload = notification.request.content.data as unknown as MissionNotificationData;
    if (!payload.missionId || !payload.scheduledAt) return;
    const userId = (await supabase.auth.getSession()).data.session?.user.id;
    if (!userId) throw new Error('Cannot process mission action without a session.');

    const { data: mission, error: missionError } = await supabase
      .from('missions')
      .select('id, title, description, snooze_interval_minutes')
      .eq('id', payload.missionId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();
    if (missionError) throw missionError;
    if (!mission) return;

    const occurrence = await getOrCreateOccurrence(userId, payload);
    if (actionIdentifier === ACTION_COMPLETE) {
      const { error } = await supabase
        .from('mission_occurrences')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', occurrence.id)
        .eq('user_id', userId);
      if (error) throw error;
      await cancelSnoozeNotificationsForOccurrence(payload.missionId, payload.scheduledAt);
    } else {
      const nextCount = occurrence.snooze_count + 1;
      if (nextCount <= MAX_SNOOZE_COUNT) {
        const { error } = await supabase
          .from('mission_occurrences')
          .update({ status: 'snoozed', snooze_count: nextCount })
          .eq('id', occurrence.id)
          .eq('user_id', userId);
        if (error) throw error;
        await scheduleSnoozeNotification(
          payload.missionId,
          mission.title,
          mission.description,
          payload.scheduledAt,
          mission.snooze_interval_minutes,
          nextCount
        );
      }
    }
    await Notifications.dismissNotificationAsync(notification.request.identifier).catch(() => undefined);
  } catch (error) {
    processedActionKeys.delete(actionKey);
    throw error;
  }
}

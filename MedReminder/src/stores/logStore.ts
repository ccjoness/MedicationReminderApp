import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';
import { startOfDay, endOfDay } from '../utils/date';
import {
  sendImmediateNotification,
} from '../lib/notifications';
import type { MedicationLog } from '../types';

interface LogState {
  todayLogs: MedicationLog[];
  loading: boolean;
  // Actions
  fetchTodayLogs: () => Promise<void>;
  generateTodayLogs: (userId: string) => Promise<void>;
  markAsTaken: (logId: string, medicationId: string) => Promise<void>;
  markAsMissed: (logId: string) => Promise<void>;
  upsertSnoozeCount: (logId: string, snoozeCount: number) => Promise<void>;
}

export const useLogStore = create<LogState>((set, get) => ({
  todayLogs: [],
  loading: false,

  fetchTodayLogs: async () => {
    set({ loading: true });
    try {
      const user = useAuthStore.getState().user;
      if (!user) throw new Error('Not authenticated');

      const now = new Date();
      const { data, error } = await supabase
        .from('medication_logs')
        .select(
          `
          *,
          medication:medications(*)
        `
        )
        .eq('user_id', user.id)
        .gte('scheduled_at', startOfDay(now).toISOString())
        .lte('scheduled_at', endOfDay(now).toISOString())
        .order('scheduled_at', { ascending: true });

      if (error) throw error;
      set({ todayLogs: (data as MedicationLog[]) ?? [] });
    } finally {
      set({ loading: false });
    }
  },

  /**
   * Idempotently ensure a medication_log row exists for every schedule that
   * applies today. Safe to call on every app open.
   */
  generateTodayLogs: async (userId) => {
    const { data: medications, error } = await supabase
      .from('medications')
      .select('*, schedules:medication_schedules(*)')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error || !medications) return;

    const today = new Date();
    const dayOfWeek = today.getDay();

    for (const medication of medications) {
      const schedules = (medication.schedules ?? []) as {
        id: string;
        days_of_week: number[];
        time_of_day: string;
      }[];

      for (const schedule of schedules) {
        const everyDay = schedule.days_of_week.length === 0;
        if (!everyDay && !schedule.days_of_week.includes(dayOfWeek)) continue;

        const [hours, minutes] = schedule.time_of_day.split(':').map(Number);
        const scheduledAt = new Date(today);
        scheduledAt.setHours(hours, minutes, 0, 0);

        // Atomic upsert — if a log already exists for this slot, do nothing.
        // ignoreDuplicates:true means concurrent calls can never produce duplicate rows.
        // Requires UNIQUE(medication_id, user_id, scheduled_at) — see schema migration 002.
        await supabase.from('medication_logs').upsert(
          {
            medication_id: medication.id,
            user_id: userId,
            scheduled_at: scheduledAt.toISOString(),
            status: 'pending',
            snooze_count: 0,
          },
          { onConflict: 'medication_id,user_id,scheduled_at', ignoreDuplicates: true }
        );
      }
    }

    await get().fetchTodayLogs();
  },

  markAsTaken: async (logId, medicationId) => {
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('medication_logs')
      .update({ status: 'taken', taken_at: now })
      .eq('id', logId);

    if (error) throw error;

    // Atomic decrement via RPC — prevents TOCTOU race condition from
    // concurrent "Mark as taken" actions (e.g., notification button + in-app button)
    const { data: med } = await supabase
      .from('medications')
      .select('refill_count, low_refill_threshold, name')
      .eq('id', medicationId)
      .single();

    await supabase.rpc('decrement_refill_count', { med_id: medicationId });

    // Check for low supply after decrement and warn user
    if (med?.refill_count !== null && med?.refill_count !== undefined &&
        med?.low_refill_threshold !== null) {
      const newCount = Math.max(0, (med.refill_count as number) - 1);
      if (newCount <= (med.low_refill_threshold as number)) {
        await sendImmediateNotification(
          `Low supply: ${med.name as string}`,
          `Only ${newCount} pill(s) remaining. Time to refill!`,
          { type: 'refill_warning', medicationId }
        );
      }
    }

    set((state) => ({
      todayLogs: state.todayLogs.map((log) =>
        log.id === logId ? { ...log, status: 'taken' as const, taken_at: now } : log
      ),
    }));
  },

  markAsMissed: async (logId) => {
    const { error } = await supabase
      .from('medication_logs')
      .update({ status: 'missed' })
      .eq('id', logId);

    if (error) throw error;

    set((state) => ({
      todayLogs: state.todayLogs.map((log) =>
        log.id === logId ? { ...log, status: 'missed' as const } : log
      ),
    }));
  },

  upsertSnoozeCount: async (logId, snoozeCount) => {
    const { error } = await supabase
      .from('medication_logs')
      .update({ status: 'snoozed', snooze_count: snoozeCount })
      .eq('id', logId);

    if (error) throw error;

    set((state) => ({
      todayLogs: state.todayLogs.map((log) =>
        log.id === logId
          ? { ...log, status: 'snoozed' as const, snooze_count: snoozeCount }
          : log
      ),
    }));
  },
}));

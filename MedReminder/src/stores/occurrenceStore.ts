import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';
import { startOfDay, endOfDay } from '../utils/date';
import type { MissionOccurrence } from '../types';

interface OccurrenceState {
  todayOccurrences: MissionOccurrence[];
  loading: boolean;
  fetchTodayOccurrences: () => Promise<void>;
  generateTodayOccurrences: (userId: string) => Promise<void>;
  markAsCompleted: (occurrenceId: string) => Promise<void>;
}

export const useOccurrenceStore = create<OccurrenceState>((set, get) => ({
  todayOccurrences: [],
  loading: false,

  fetchTodayOccurrences: async () => {
    set({ loading: true });
    try {
      const user = useAuthStore.getState().user;
      if (!user) throw new Error('Not authenticated');
      const now = new Date();
      const { data, error } = await supabase
        .from('mission_occurrences')
        .select('*, mission:missions(*)')
        .eq('user_id', user.id)
        .gte('scheduled_at', startOfDay(now).toISOString())
        .lte('scheduled_at', endOfDay(now).toISOString())
        .order('scheduled_at', { ascending: true });
      if (error) throw error;
      set({ todayOccurrences: (data as MissionOccurrence[]) ?? [] });
    } finally {
      set({ loading: false });
    }
  },

  generateTodayOccurrences: async (userId) => {
    const { data: missions, error } = await supabase
      .from('missions')
      .select('*, schedules:mission_schedules(*)')
      .eq('user_id', userId)
      .eq('is_active', true);
    if (error || !missions) return;

    const today = new Date();
    for (const mission of missions) {
      for (const schedule of mission.schedules ?? []) {
        if (schedule.days_of_week.length && !schedule.days_of_week.includes(today.getDay())) continue;
        const [hours, minutes] = schedule.time_of_day.split(':').map(Number);
        const scheduledAt = new Date(today);
        scheduledAt.setHours(hours, minutes, 0, 0);
        await supabase.from('mission_occurrences').upsert(
          {
            mission_id: mission.id,
            user_id: userId,
            scheduled_at: scheduledAt.toISOString(),
            status: 'pending',
            snooze_count: 0,
          },
          { onConflict: 'mission_id,user_id,scheduled_at', ignoreDuplicates: true }
        );
      }
    }
    await get().fetchTodayOccurrences();
  },

  markAsCompleted: async (occurrenceId) => {
    const completedAt = new Date().toISOString();
    const { error } = await supabase
      .from('mission_occurrences')
      .update({ status: 'completed', completed_at: completedAt })
      .eq('id', occurrenceId);
    if (error) throw error;
    set((state) => ({
      todayOccurrences: state.todayOccurrences.map((occurrence) =>
        occurrence.id === occurrenceId
          ? { ...occurrence, status: 'completed', completed_at: completedAt }
          : occurrence
      ),
    }));
  },
}));

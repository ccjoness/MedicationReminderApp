import { Alert } from 'react-native';
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';
import { cancelNotificationsForMission, scheduleNotificationsForMission } from '../lib/notifications';
import type { Mission, MissionSchedule } from '../types';

type NewMission = Omit<Mission, 'id' | 'user_id' | 'created_at' | 'schedules'>;
type NewSchedule = Omit<MissionSchedule, 'id' | 'mission_id' | 'created_at'>;

interface MissionState {
  missions: Mission[];
  loading: boolean;
  fetchMissions: () => Promise<void>;
  addMission: (mission: NewMission, schedules: NewSchedule[]) => Promise<Mission>;
  updateMission: (id: string, updates: Partial<NewMission>, schedules?: NewSchedule[]) => Promise<void>;
  deleteMission: (id: string) => Promise<void>;
  getMissionById: (id: string) => Mission | undefined;
}

export const useMissionStore = create<MissionState>((set, get) => ({
  missions: [],
  loading: false,

  fetchMissions: async () => {
    set({ loading: true });
    try {
      const user = useAuthStore.getState().user;
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('missions')
        .select('*, schedules:mission_schedules(*)')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      set({ missions: (data as Mission[]) ?? [] });
    } finally {
      set({ loading: false });
    }
  },

  addMission: async (missionData, scheduleData) => {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('Not authenticated');
    const { data: mission, error } = await supabase
      .from('missions')
      .insert({ ...missionData, user_id: user.id })
      .select()
      .single();
    if (error) throw error;

    let schedules: MissionSchedule[] = [];
    if (scheduleData.length) {
      const { data, error: scheduleError } = await supabase
        .from('mission_schedules')
        .insert(scheduleData.map((schedule) => ({ ...schedule, mission_id: mission.id })))
        .select();
      if (scheduleError) throw scheduleError;
      schedules = (data as MissionSchedule[]) ?? [];
    }

    const fullMission = { ...(mission as Mission), schedules };
    set((state) => ({ missions: [fullMission, ...state.missions] }));
    try {
      await scheduleNotificationsForMission(fullMission, schedules);
    } catch (scheduleError) {
      Alert.alert('Reminders Not Scheduled', scheduleError instanceof Error ? scheduleError.message : 'Try again.');
    }
    return fullMission;
  },

  updateMission: async (id, updates, scheduleData) => {
    const { error } = await supabase.from('missions').update(updates).eq('id', id);
    if (error) throw error;

    let schedules: MissionSchedule[] | undefined;
    if (scheduleData !== undefined) {
      await supabase.from('mission_schedules').delete().eq('mission_id', id);
      const result = scheduleData.length
        ? await supabase
            .from('mission_schedules')
            .insert(scheduleData.map((schedule) => ({ ...schedule, mission_id: id })))
            .select()
        : { data: [], error: null };
      if (result.error) throw result.error;
      schedules = (result.data as MissionSchedule[]) ?? [];
    }

    await cancelNotificationsForMission(id);
    const existing = get().missions.find((mission) => mission.id === id);
    const updated = existing
      ? { ...existing, ...updates, schedules: schedules ?? existing.schedules }
      : undefined;
    set((state) => ({
      missions: state.missions.map((mission) => mission.id === id ? (updated ?? mission) : mission),
    }));
    if (updated?.schedules?.length) {
      try {
        await scheduleNotificationsForMission(updated, updated.schedules);
      } catch (scheduleError) {
        Alert.alert('Reminders Not Scheduled', scheduleError instanceof Error ? scheduleError.message : 'Try again.');
      }
    }
  },

  deleteMission: async (id) => {
    const existing = get().missions.find((mission) => mission.id === id);
    const { error } = await supabase.from('missions').update({ is_active: false }).eq('id', id);
    if (error) throw error;
    await cancelNotificationsForMission(id);
    if (existing?.image_url) {
      for (const bucket of ['mission-images', 'medication-photos']) {
        const parts = existing.image_url.split(`/${bucket}/`);
        if (parts.length > 1) {
          await supabase.storage.from(bucket).remove([parts[1].split('?')[0]]);
          break;
        }
      }
    }
    set((state) => ({ missions: state.missions.filter((mission) => mission.id !== id) }));
  },

  getMissionById: (id) => get().missions.find((mission) => mission.id === id),
}));

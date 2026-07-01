import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';
import {
  scheduleNotificationsForMedication,
  cancelNotificationsForMedication,
} from '../lib/notifications';
import type { Medication, MedicationSchedule } from '../types';

type NewMedication = Omit<Medication, 'id' | 'user_id' | 'created_at' | 'schedules'>;
type NewSchedule = Omit<MedicationSchedule, 'id' | 'medication_id' | 'created_at'>;

interface MedicationState {
  medications: Medication[];
  loading: boolean;
  // Actions
  fetchMedications: () => Promise<void>;
  addMedication: (medication: NewMedication, schedules: NewSchedule[]) => Promise<Medication>;
  updateMedication: (
    id: string,
    updates: Partial<NewMedication>,
    schedules?: NewSchedule[]
  ) => Promise<void>;
  deleteMedication: (id: string) => Promise<void>;
  getMedicationById: (id: string) => Medication | undefined;
}

export const useMedicationStore = create<MedicationState>((set, get) => ({
  medications: [],
  loading: false,

  fetchMedications: async () => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('medications')
        .select(
          `
          *,
          schedules:medication_schedules(*)
        `
        )
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ medications: (data as Medication[]) ?? [] });
    } finally {
      set({ loading: false });
    }
  },

  addMedication: async (medicationData, scheduleData) => {
    // Read user from Zustand store — already populated when navigated past login
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('Not authenticated');

    // Insert medication row
    const { data: medication, error } = await supabase
      .from('medications')
      .insert({ ...medicationData, user_id: user.id })
      .select()
      .single();

    if (error) throw error;

    // Insert schedule rows
    let schedules: MedicationSchedule[] = [];
    if (scheduleData.length > 0) {
      const { data: insertedSchedules, error: scheduleError } = await supabase
        .from('medication_schedules')
        .insert(scheduleData.map((s) => ({ ...s, medication_id: medication.id })))
        .select();

      if (scheduleError) throw scheduleError;
      schedules = (insertedSchedules as MedicationSchedule[]) ?? [];
    }

    const fullMedication: Medication = { ...(medication as Medication), schedules };

    // Schedule notifications
    if (schedules.length > 0) {
      await scheduleNotificationsForMedication(fullMedication, schedules);
    }

    set((state) => ({ medications: [fullMedication, ...state.medications] }));
    return fullMedication;
  },

  updateMedication: async (id, updates, scheduleData) => {
    const { error } = await supabase.from('medications').update(updates).eq('id', id);
    if (error) throw error;

    let schedules: MedicationSchedule[] | undefined;

    if (scheduleData !== undefined) {
      // Replace schedules
      await supabase.from('medication_schedules').delete().eq('medication_id', id);

      if (scheduleData.length > 0) {
        const { data, error: scheduleError } = await supabase
          .from('medication_schedules')
          .insert(scheduleData.map((s) => ({ ...s, medication_id: id })))
          .select();

        if (scheduleError) throw scheduleError;
        schedules = (data as MedicationSchedule[]) ?? [];
      } else {
        schedules = [];
      }
    }

    // Cancel old notifications and reschedule
    await cancelNotificationsForMedication(id);

    set((state) => ({
      medications: state.medications.map((med) => {
        if (med.id !== id) return med;
        const updated: Medication = {
          ...med,
          ...updates,
          schedules: schedules !== undefined ? schedules : med.schedules,
        };
        if (updated.is_active && updated.schedules?.length) {
          scheduleNotificationsForMedication(updated, updated.schedules);
        }
        return updated;
      }),
    }));
  },

  deleteMedication: async (id) => {
    // Soft delete
    const { error } = await supabase
      .from('medications')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;

    await cancelNotificationsForMedication(id);

    set((state) => ({
      medications: state.medications.filter((med) => med.id !== id),
    }));
  },

  getMedicationById: (id) => get().medications.find((m) => m.id === id),
}));

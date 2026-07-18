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
      const user = useAuthStore.getState().user;
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('medications')
        .select(
          `
          *,
          schedules:medication_schedules(*)
        `
        )
        .eq('user_id', user.id)
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

    // Update local state — medication is already in the DB regardless of notification outcome
    set((state) => ({ medications: [fullMedication, ...state.medications] }));

    // Schedule notifications — errors are surfaced as alerts but don't block the save
    if (schedules.length > 0) {
      try {
        await scheduleNotificationsForMedication(fullMedication, schedules);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not schedule reminders.';
        // Import Alert lazily to avoid circular deps in the store
        const { Alert } = require('react-native');
        Alert.alert('Reminders Not Scheduled', msg);
      }
    }

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

    // Build the updated medication object before touching state so we can
    // schedule notifications outside the set() callback (set() must be pure).
    const existingMed = get().medications.find((m) => m.id === id);
    const updatedMed: Medication | undefined = existingMed
      ? {
          ...existingMed,
          ...updates,
          schedules: schedules !== undefined ? schedules : existingMed.schedules,
        }
      : undefined;

    set((state) => ({
      medications: state.medications.map((med) => {
        if (med.id !== id) return med;
        return {
          ...med,
          ...updates,
          schedules: schedules !== undefined ? schedules : med.schedules,
        };
      }),
    }));

    // Schedule notifications after state update — errors show as alert but don't block save
    if (updatedMed?.is_active && updatedMed.schedules?.length) {
      try {
        await scheduleNotificationsForMedication(updatedMed, updatedMed.schedules);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not schedule reminders.';
        const { Alert } = require('react-native');
        Alert.alert('Reminders Not Scheduled', msg);
      }
    }
  },

  deleteMedication: async (id) => {
    // Retrieve photo path before soft-deleting so we can clean up storage
    const existing = get().medications.find((m) => m.id === id);

    const { error } = await supabase
      .from('medications')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;

    await cancelNotificationsForMedication(id);

    // Delete the medication photo from storage to avoid orphaned files
    if (existing?.photo_url) {
      const urlParts = existing.photo_url.split('/medication-photos/');
      if (urlParts.length > 1) {
        const storagePath = urlParts[1].split('?')[0]; // strip query string from signed URL
        await supabase.storage.from('medication-photos').remove([storagePath]);
      }
    }

    set((state) => ({
      medications: state.medications.filter((med) => med.id !== id),
    }));
  },

  getMedicationById: (id) => get().medications.find((m) => m.id === id),
}));

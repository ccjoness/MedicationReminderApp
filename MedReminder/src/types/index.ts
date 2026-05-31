export interface Profile {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Medication {
  id: string;
  user_id: string;
  name: string;
  dosage: string;
  notes: string | null;
  photo_url: string | null;
  snooze_interval_minutes: number;
  refill_count: number | null;
  low_refill_threshold: number | null;
  is_active: boolean;
  created_at: string;
  schedules?: MedicationSchedule[];
}

export interface MedicationSchedule {
  id: string;
  medication_id: string;
  /** Day numbers: 0=Sunday … 6=Saturday. Empty array means every day. */
  days_of_week: number[];
  /** 24-hour time string, e.g. "08:00:00" */
  time_of_day: string;
  created_at: string;
}

export type LogStatus = 'pending' | 'taken' | 'missed' | 'snoozed';

export interface MedicationLog {
  id: string;
  medication_id: string;
  user_id: string;
  scheduled_at: string;
  status: LogStatus;
  taken_at: string | null;
  snooze_count: number;
  created_at: string;
  medication?: Medication;
}

export interface TodayMedicationEntry {
  medication: Medication;
  schedule: MedicationSchedule;
  log: MedicationLog | null;
  scheduledTime: Date;
}

/**
 * Shape of the data embedded in every medication notification payload.
 */
export interface NotificationData {
  medicationId: string;
  scheduleId?: string;
  scheduledAt: string;
  medicationName: string;
  dosage: string;
  snoozeIntervalMinutes: number;
  snoozeCount?: number;
  isSnooze?: boolean;
}

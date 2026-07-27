export interface Profile {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Mission {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  notes: string | null;
  image_url: string | null;
  snooze_interval_minutes: number;
  is_active: boolean;
  created_at: string;
  schedules?: MissionSchedule[];
}

export interface MissionSchedule {
  id: string;
  mission_id: string;
  days_of_week: number[];
  time_of_day: string;
  created_at: string;
}

export type MissionStatus = 'pending' | 'completed' | 'expired' | 'snoozed';

export interface MissionOccurrence {
  id: string;
  mission_id: string;
  user_id: string;
  scheduled_at: string;
  status: MissionStatus;
  completed_at: string | null;
  snooze_count: number;
  created_at: string;
  mission?: Mission;
}

export interface MissionNotificationData {
  missionId: string;
  scheduleId?: string;
  scheduledAt: string;
  missionTitle: string;
  snoozeIntervalMinutes: number;
  snoozeCount?: number;
  isSnooze?: boolean;
}

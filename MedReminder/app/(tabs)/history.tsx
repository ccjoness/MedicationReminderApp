import { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, ScrollView } from 'react-native';
import { Text, ActivityIndicator, Card } from 'react-native-paper';
import { Calendar, DateData } from 'react-native-calendars';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { StatusBadge } from '@/components/StatusBadge';
import { toDateKey, formatTime } from '@/utils/date';
import { useIs24HourFormat } from '@/hooks/useTimeFormat';
import type { MedicationLog } from '@/types';
import { colors, layout, spacing } from '@/theme';

interface MarkedDate {
  marked?: boolean;
  dotColor?: string;
  selected?: boolean;
  selectedColor?: string;
}

export default function HistoryScreen() {
  const { session } = useAuthStore();
  const is24Hour = useIs24HourFormat();
  const [selectedDate, setSelectedDate] = useState<string>(toDateKey(new Date()));
  const [logsForDay, setLogsForDay] = useState<MedicationLog[]>([]);
  const [markedDates, setMarkedDates] = useState<Record<string, MarkedDate>>({});
  const [loading, setLoading] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);

  // Load adherence data for the current month to mark calendar dots
  const loadMonthData = async (year: number, month: number) => {
    if (!session?.user) return;
    setCalendarLoading(true);
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);

      const { data } = await supabase
        .from('medication_logs')
        .select('scheduled_at, status')
        .eq('user_id', session.user.id)
        .gte('scheduled_at', startDate.toISOString())
        .lte('scheduled_at', endDate.toISOString());

      if (!data) return;

      // Group by day
      const byDay: Record<string, { total: number; taken: number }> = {};
      for (const log of data) {
        const key = toDateKey(log.scheduled_at);
        if (!byDay[key]) byDay[key] = { total: 0, taken: 0 };
        byDay[key].total++;
        if (log.status === 'taken') byDay[key].taken++;
      }

      const marks: Record<string, MarkedDate> = {};
      for (const [key, { total, taken }] of Object.entries(byDay)) {
        const allTaken = taken === total;
        const noneTaken = taken === 0;
        marks[key] = {
          marked: true,
          dotColor: allTaken ? colors.success : noneTaken ? colors.error : colors.warning,
        };
      }

      // Keep selected
      marks[selectedDate] = { ...marks[selectedDate], selected: true, selectedColor: colors.primary };

      setMarkedDates(marks);
    } finally {
      setCalendarLoading(false);
    }
  };

  // Load logs for a specific day
  const loadDay = async (dateKey: string) => {
    if (!session?.user) return;
    setLoading(true);
    try {
      const date = new Date(dateKey + 'T00:00:00');
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);

      const { data } = await supabase
        .from('medication_logs')
        .select('*, medication:medications(*)')
        .eq('user_id', session.user.id)
        .gte('scheduled_at', start.toISOString())
        .lte('scheduled_at', end.toISOString())
        .order('scheduled_at', { ascending: true });

      setLogsForDay((data as MedicationLog[]) ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const today = new Date();
    loadMonthData(today.getFullYear(), today.getMonth() + 1);
    loadDay(selectedDate);
  }, [session?.user?.id]);

  const handleDayPress = (day: DateData) => {
    const key = day.dateString;
    setSelectedDate(key);

    setMarkedDates((prev) => {
      const updated = { ...prev };
      // Deselect previous
      for (const k of Object.keys(updated)) {
        if (updated[k].selected) {
          updated[k] = { ...updated[k], selected: false };
        }
      }
      updated[key] = { ...updated[key], selected: true, selectedColor: colors.primary };
      return updated;
    });

    loadDay(key);
  };

  const taken = logsForDay.filter((l) => l.status === 'taken').length;
  const total = logsForDay.length;
  const adherencePercent = total > 0 ? Math.round((taken / total) * 100) : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Calendar
        onDayPress={handleDayPress}
        markedDates={markedDates}
        onMonthChange={(month: DateData) => loadMonthData(month.year, month.month)}
        theme={{
          selectedDayBackgroundColor: colors.primary,
          todayTextColor: colors.primary,
          arrowColor: colors.primary,
          dotColor: colors.primary,
          textDayFontSize: 14,
        }}
      />

      <View style={styles.dayHeader}>
        <Text variant="titleMedium" style={styles.dayTitle}>
          {new Date(selectedDate + 'T12:00:00').toLocaleDateString([], {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
        {adherencePercent !== null && (
          <Text variant="bodySmall" style={styles.adherenceText}>
            {adherencePercent}% adherence ({taken}/{total})
          </Text>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />
      ) : logsForDay.length === 0 ? (
        <Text style={styles.emptyText}>No medications logged for this day.</Text>
      ) : (
        logsForDay.map((log) => (
          <Card key={log.id} style={styles.logCard}>
            <View style={styles.logRow}>
              <View style={styles.logInfo}>
                <Text variant="titleSmall" style={styles.logName}>
                  {log.medication?.name ?? 'Unknown'}
                </Text>
                <Text variant="bodySmall" style={styles.logDosage}>
                  {log.medication?.dosage ?? ''} • {formatTime(log.scheduled_at, is24Hour)}
                </Text>
                {log.taken_at && (
                  <Text variant="bodySmall" style={styles.takenAt}>
                    Taken at {formatTime(log.taken_at, is24Hour)}
                  </Text>
                )}
              </View>
              <StatusBadge status={log.status} />
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: 40,
  },
  dayHeader: {
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 2,
  },
  dayTitle: {
    fontWeight: '600',
    color: colors.text,
  },
  adherenceText: {
    color: colors.primary,
    fontWeight: '500',
  },
  spinner: {
    marginTop: 32,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textDisabled,
    marginTop: 32,
    paddingHorizontal: spacing.xl,
  },
  logCard: {
    marginHorizontal: layout.cardHorizontalMargin,
    marginVertical: 5,
    backgroundColor: colors.surface,
    padding: spacing.md,
    elevation: 1,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logInfo: {
    flex: 1,
    gap: 2,
    marginRight: spacing.md,
  },
  logName: {
    fontWeight: '600',
    color: colors.text,
  },
  logDosage: {
    color: colors.textSecondary,
  },
  takenAt: {
    color: colors.success,
    fontStyle: 'italic',
  },
});

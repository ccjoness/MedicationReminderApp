import { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, ScrollView } from 'react-native';
import { Text, ActivityIndicator, Card } from 'react-native-paper';
import { Calendar, DateData } from 'react-native-calendars';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { StatusBadge } from '@/components/StatusBadge';
import { toDateKey, formatTime } from '@/utils/date';
import type { MedicationLog } from '@/types';

interface MarkedDate {
  marked?: boolean;
  dotColor?: string;
  selected?: boolean;
  selectedColor?: string;
}

export default function HistoryScreen() {
  const { session } = useAuthStore();
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
          dotColor: allTaken ? '#2E7D32' : noneTaken ? '#C62828' : '#E65100',
        };
      }

      // Keep selected
      marks[selectedDate] = { ...marks[selectedDate], selected: true, selectedColor: '#6750A4' };

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
      updated[key] = { ...updated[key], selected: true, selectedColor: '#6750A4' };
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
          selectedDayBackgroundColor: '#6750A4',
          todayTextColor: '#6750A4',
          arrowColor: '#6750A4',
          dotColor: '#6750A4',
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
        <ActivityIndicator size="small" color="#6750A4" style={styles.spinner} />
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
                  {log.medication?.dosage ?? ''} • {formatTime(log.scheduled_at)}
                </Text>
                {log.taken_at && (
                  <Text variant="bodySmall" style={styles.takenAt}>
                    Taken at {formatTime(log.taken_at)}
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
    backgroundColor: '#F6F3FA',
  },
  content: {
    paddingBottom: 40,
  },
  dayHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    gap: 2,
  },
  dayTitle: {
    fontWeight: '600',
    color: '#1a1a1a',
  },
  adherenceText: {
    color: '#6750A4',
    fontWeight: '500',
  },
  spinner: {
    marginTop: 32,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 32,
    paddingHorizontal: 24,
  },
  logCard: {
    marginHorizontal: 16,
    marginVertical: 5,
    backgroundColor: '#fff',
    padding: 12,
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
    marginRight: 12,
  },
  logName: {
    fontWeight: '600',
    color: '#1a1a1a',
  },
  logDosage: {
    color: '#555',
  },
  takenAt: {
    color: '#2E7D32',
    fontStyle: 'italic',
  },
});

import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Card, Text } from 'react-native-paper';
import { Calendar, type DateData } from 'react-native-calendars';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { StatusBadge } from '@/components/StatusBadge';
import { formatTime, toDateKey } from '@/utils/date';
import { useIs24HourFormat } from '@/hooks/useTimeFormat';
import type { MissionOccurrence } from '@/types';
import { colors, layout, spacing } from '@/theme';

type MarkedDate = { marked?: boolean; dotColor?: string; selected?: boolean; selectedColor?: string };

export default function HistoryScreen() {
  const { session } = useAuthStore();
  const is24Hour = useIs24HourFormat();
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [occurrences, setOccurrences] = useState<MissionOccurrence[]>([]);
  const [markedDates, setMarkedDates] = useState<Record<string, MarkedDate>>({});
  const [loading, setLoading] = useState(false);

  const loadMonth = async (year: number, month: number) => {
    if (!session?.user) return;
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    const { data } = await supabase.from('mission_occurrences').select('scheduled_at, status').eq('user_id', session.user.id).gte('scheduled_at', start.toISOString()).lte('scheduled_at', end.toISOString());
    const summary: Record<string, { total: number; completed: number }> = {};
    for (const item of data ?? []) {
      const key = toDateKey(item.scheduled_at);
      summary[key] ??= { total: 0, completed: 0 };
      summary[key].total++;
      if (item.status === 'completed') summary[key].completed++;
    }
    const marks: Record<string, MarkedDate> = {};
    for (const [key, value] of Object.entries(summary)) {
      marks[key] = { marked: true, dotColor: value.completed === value.total ? colors.success : value.completed === 0 ? colors.error : colors.warning };
    }
    marks[selectedDate] = { ...marks[selectedDate], selected: true, selectedColor: colors.primary };
    setMarkedDates(marks);
  };

  const loadDay = async (dateKey: string) => {
    if (!session?.user) return;
    setLoading(true);
    try {
      const { data } = await supabase.from('mission_occurrences').select('*, mission:missions(*)').eq('user_id', session.user.id).gte('scheduled_at', new Date(`${dateKey}T00:00:00`).toISOString()).lte('scheduled_at', new Date(`${dateKey}T23:59:59.999`).toISOString()).order('scheduled_at');
      setOccurrences((data as MissionOccurrence[]) ?? []);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const today = new Date();
    loadMonth(today.getFullYear(), today.getMonth() + 1);
    loadDay(selectedDate);
  }, [session?.user?.id]);

  const selectDay = (day: DateData) => {
    setSelectedDate(day.dateString);
    setMarkedDates((current) => ({ ...Object.fromEntries(Object.entries(current).map(([key, value]) => [key, { ...value, selected: false }])), [day.dateString]: { ...current[day.dateString], selected: true, selectedColor: colors.primary } }));
    loadDay(day.dateString);
  };
  const completed = occurrences.filter((item) => item.status === 'completed').length;
  const percentage = occurrences.length ? Math.round(completed / occurrences.length * 100) : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Calendar onDayPress={selectDay} markedDates={markedDates} onMonthChange={(month: DateData) => loadMonth(month.year, month.month)} theme={{ selectedDayBackgroundColor: colors.primary, todayTextColor: colors.primary, arrowColor: colors.primary, dotColor: colors.primary }} />
      <View style={styles.header}>
        <Text variant="titleMedium" style={styles.date}>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
        {percentage !== null && <Text variant="bodySmall" style={styles.rate}>{percentage}% complete ({completed}/{occurrences.length})</Text>}
      </View>
      {loading ? <ActivityIndicator color={colors.primary} style={styles.spinner} /> : !occurrences.length ? <Text style={styles.empty}>No missions recorded for this day.</Text> : occurrences.map((item) => (
        <Card key={item.id} style={styles.card}>
          <View style={styles.row}>
            <View style={styles.info}>
              <Text variant="titleSmall" style={styles.title}>{item.mission?.title ?? 'Unknown mission'}</Text>
              <Text variant="bodySmall" style={styles.time}>Scheduled {formatTime(item.scheduled_at, is24Hour)}</Text>
              {item.completed_at && <Text variant="bodySmall" style={styles.completed}>Completed {formatTime(item.completed_at, is24Hour)}</Text>}
            </View>
            <StatusBadge status={item.status} />
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxxl },
  header: { padding: layout.screenPadding, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  date: { fontWeight: '600', color: colors.text },
  rate: { color: colors.primary, fontWeight: '500' },
  spinner: { marginTop: spacing.xxl },
  empty: { textAlign: 'center', color: colors.textDisabled, marginTop: spacing.xxl },
  card: { marginHorizontal: layout.cardHorizontalMargin, marginVertical: 5, padding: spacing.md, backgroundColor: colors.surface },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  info: { flex: 1, gap: spacing.xxs, marginRight: spacing.md },
  title: { fontWeight: '600', color: colors.text },
  time: { color: colors.textSecondary },
  completed: { color: colors.success, fontStyle: 'italic' },
});

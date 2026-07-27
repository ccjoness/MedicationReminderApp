import { useCallback, useEffect } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { useOccurrenceStore } from '@/stores/occurrenceStore';
import { MissionCard } from '@/components/MissionCard';
import { EmptyState } from '@/components/EmptyState';
import { formatDate } from '@/utils/date';
import type { MissionOccurrence } from '@/types';
import { colors, layout, spacing } from '@/theme';

export default function TodayScreen() {
  const { todayOccurrences, loading, fetchTodayOccurrences, markAsCompleted } = useOccurrenceStore();
  useEffect(() => { fetchTodayOccurrences(); }, []);
  const refresh = useCallback(() => { fetchTodayOccurrences(); }, []);
  const complete = (occurrence: MissionOccurrence) => markAsCompleted(occurrence.id);
  const completed = todayOccurrences.filter((item) => item.status === 'completed').length;

  if (loading && !todayOccurrences.length) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  return (
    <View style={styles.container}>
      <View style={styles.subheader}>
        <Text variant="bodyLarge" style={styles.dateLabel}>{formatDate(new Date())}</Text>
        <Text variant="bodySmall" style={styles.countLabel}>{completed}/{todayOccurrences.length} complete</Text>
      </View>
      <FlatList
        data={todayOccurrences}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => item.mission ? (
          <MissionCard mission={item.mission} occurrence={item} scheduledTime={item.scheduled_at} onComplete={item.status === 'pending' || item.status === 'snoozed' ? () => complete(item) : undefined} />
        ) : null}
        ListEmptyComponent={<EmptyState icon="target" title="No missions scheduled today" subtitle="Add a mission and choose a reminder time to get started." />}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
        contentContainerStyle={!todayOccurrences.length ? styles.emptyFlex : styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  subheader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: layout.screenPadding, paddingVertical: spacing.md, backgroundColor: colors.primary },
  dateLabel: { color: colors.onPrimary, fontWeight: '500' },
  countLabel: { color: colors.onPrimaryMuted },
  listContent: { paddingVertical: spacing.sm, paddingBottom: spacing.xl },
  emptyFlex: { flex: 1 },
});

import { useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { useAuthStore } from '@/stores/authStore';
import { useLogStore } from '@/stores/logStore';
import { MedicationCard } from '@/components/MedicationCard';
import { EmptyState } from '@/components/EmptyState';
import { formatDate } from '@/utils/date';
import type { MedicationLog } from '@/types';

export default function TodayScreen() {
  const { session } = useAuthStore();
  const { todayLogs, loading, fetchTodayLogs, markAsTaken } = useLogStore();

  // fetchTodayLogs only reads — it never inserts rows.
  // generateTodayLogs (which inserts) is called exactly once in _layout.tsx
  // when the session is established, preventing the concurrent-insert race
  // that caused duplicates.
  useEffect(() => {
    fetchTodayLogs();
  }, []);

  const handleRefresh = useCallback(() => {
    fetchTodayLogs();
  }, []);

  const handleMarkTaken = async (log: MedicationLog) => {
    await markAsTaken(log.id, log.medication_id);
  };

  const todayLabel = formatDate(new Date());

  if (loading && todayLogs.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6750A4" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.subheader}>
        <Text variant="bodyLarge" style={styles.dateLabel}>
          {todayLabel}
        </Text>
        <Text variant="bodySmall" style={styles.countLabel}>
          {todayLogs.filter((l) => l.status === 'taken').length}/{todayLogs.length} taken
        </Text>
      </View>

      <FlatList
        data={todayLogs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          if (!item.medication) return null; // guard against orphaned log rows
          return (
            <MedicationCard
              medication={item.medication}
              log={item}
              scheduledTime={item.scheduled_at}
              onMarkTaken={
                item.status === 'pending' || item.status === 'snoozed'
                  ? () => handleMarkTaken(item)
                  : undefined
              }
            />
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="pill"
            title="No medications scheduled today"
            subtitle="Add a medication and set a schedule to get started."
          />
        }
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={handleRefresh} tintColor="#6750A4" />
        }
        contentContainerStyle={todayLogs.length === 0 ? styles.emptyFlex : styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F3FA',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subheader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#6750A4',
  },
  dateLabel: {
    color: '#fff',
    fontWeight: '500',
  },
  countLabel: {
    color: 'rgba(255,255,255,0.8)',
  },
  listContent: {
    paddingVertical: 8,
    paddingBottom: 24,
  },
  emptyFlex: {
    flex: 1,
  },
});

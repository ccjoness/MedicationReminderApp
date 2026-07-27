import { useEffect } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Card, FAB, Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMissionStore } from '@/stores/missionStore';
import { EmptyState } from '@/components/EmptyState';
import { DAY_LABELS, timeStringToLabel } from '@/utils/date';
import { useIs24HourFormat } from '@/hooks/useTimeFormat';
import type { Mission } from '@/types';
import { colors, layout, spacing } from '@/theme';

export default function MissionsScreen() {
  const router = useRouter();
  const { missions, loading, fetchMissions, deleteMission } = useMissionStore();
  const is24Hour = useIs24HourFormat();
  useEffect(() => { fetchMissions(); }, []);

  const remove = (mission: Mission) => Alert.alert('Delete Mission', `Delete “${mission.title}” and cancel its reminders?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => deleteMission(mission.id) },
  ]);
  const rightActions = (mission: Mission) => (
    <TouchableOpacity style={styles.deleteAction} onPress={() => remove(mission)}>
      <MaterialCommunityIcons name="trash-can" size={24} color={colors.onPrimary} />
      <Text style={styles.deleteText}>Delete</Text>
    </TouchableOpacity>
  );

  if (loading && !missions.length) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  return (
    <View style={styles.container}>
      <FlatList
        data={missions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Swipeable renderRightActions={() => rightActions(item)}>
            <Card style={styles.card} onPress={() => router.push(`/missions/${item.id}`)}>
              <View style={styles.cardContent}>
                <View style={styles.titleRow}>
                  <MaterialCommunityIcons name="target" size={22} color={colors.primary} />
                  <Text variant="titleMedium" style={styles.title}>{item.title}</Text>
                </View>
                {item.description && <Text variant="bodySmall" style={styles.description}>{item.description}</Text>}
                {item.schedules?.map((schedule) => {
                  const days = !schedule.days_of_week.length ? 'Every day' : schedule.days_of_week.slice().sort((a, b) => a - b).map((day) => DAY_LABELS[day]).join(', ');
                  return <Text key={schedule.id} variant="bodySmall" style={styles.schedule}>{timeStringToLabel(schedule.time_of_day, is24Hour)} — {days}</Text>;
                })}
                <Text variant="bodySmall" style={styles.snooze}>Snooze: {item.snooze_interval_minutes} min</Text>
              </View>
            </Card>
          </Swipeable>
        )}
        ListEmptyComponent={<EmptyState icon="target" title="No missions yet" subtitle="Tap + to create your first mission." />}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchMissions} tintColor={colors.primary} />}
        contentContainerStyle={!missions.length ? styles.emptyFlex : styles.listContent}
      />
      <FAB icon="plus" style={styles.fab} onPress={() => router.push('/missions/add')} color={colors.onPrimary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingVertical: spacing.sm, paddingBottom: 100 },
  emptyFlex: { flex: 1 },
  card: { marginHorizontal: layout.cardHorizontalMargin, marginVertical: layout.cardVerticalMargin, backgroundColor: colors.surface, elevation: 2 },
  cardContent: { padding: spacing.lg, gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, fontWeight: '600', color: colors.text },
  description: { color: colors.textSecondary },
  schedule: { color: colors.primary },
  snooze: { color: colors.textMuted },
  deleteAction: { backgroundColor: colors.error, justifyContent: 'center', alignItems: 'center', width: 80, marginVertical: layout.cardVerticalMargin, marginRight: spacing.lg, borderRadius: 8 },
  deleteText: { color: colors.onPrimary, fontSize: 12 },
  fab: { position: 'absolute', right: layout.floatingButtonOffset, bottom: spacing.xl, backgroundColor: colors.primary },
});

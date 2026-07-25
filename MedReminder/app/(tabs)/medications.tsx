import { useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Text, FAB, ActivityIndicator, Card, Chip } from 'react-native-paper';
import { useRouter } from 'expo-router';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMedicationStore } from '@/stores/medicationStore';
import { EmptyState } from '@/components/EmptyState';
import { timeStringToLabel, DAY_LABELS } from '@/utils/date';
import { useIs24HourFormat } from '@/hooks/useTimeFormat';
import type { Medication } from '@/types';
import { colors, layout, spacing } from '@/theme';

export default function MedicationsScreen() {
  const router = useRouter();
  const { medications, loading, fetchMedications, deleteMedication } = useMedicationStore();
  const is24Hour = useIs24HourFormat();

  useEffect(() => {
    fetchMedications();
  }, []);

  const handleDelete = (med: Medication) => {
    Alert.alert(
      'Remove Medication',
      `Remove "${med.name}" and cancel all its reminders?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMedication(med.id);
            } catch {
              Alert.alert('Error', 'Could not remove medication. Please try again.');
            }
          },
        },
      ]
    );
  };

  const renderRightActions = (med: Medication) => (
    <TouchableOpacity
      style={styles.deleteAction}
      onPress={() => handleDelete(med)}
    >
      <MaterialCommunityIcons name="trash-can" size={24} color={colors.onPrimary} />
      <Text style={styles.deleteActionText}>Delete</Text>
    </TouchableOpacity>
  );

  const renderItem = ({ item }: { item: Medication }) => {
    const lowStock =
      item.refill_count !== null &&
      item.low_refill_threshold !== null &&
      item.refill_count <= item.low_refill_threshold;

    return (
      <Swipeable renderRightActions={() => renderRightActions(item)}>
        <Card
          style={styles.card}
          onPress={() => router.push(`/medications/${item.id}`)}
        >
          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <View style={styles.nameRow}>
                <Text variant="titleMedium" style={styles.name}>
                  {item.name}
                </Text>
                {lowStock && (
                  <Chip icon="alert" compact style={styles.lowStockChip} textStyle={styles.lowStockText}>
                    Low supply
                  </Chip>
                )}
              </View>
              <Text variant="bodySmall" style={styles.dosage}>{item.dosage}</Text>
            </View>

            {item.schedules && item.schedules.length > 0 && (
              <View style={styles.schedules}>
                {item.schedules.map((s) => {
                  const days =
                    s.days_of_week.length === 0
                      ? 'Every day'
                      : s.days_of_week.sort((a, b) => a - b).map((d) => DAY_LABELS[d]).join(', ');
                  return (
                    <Text key={s.id} variant="bodySmall" style={styles.scheduleText}>
                      {timeStringToLabel(s.time_of_day, is24Hour)} — {days}
                    </Text>
                  );
                })}
              </View>
            )}

            <View style={styles.meta}>
              {item.refill_count !== null && (
                <Text variant="bodySmall" style={lowStock ? styles.lowStockMeta : styles.metaText}>
                  {item.refill_count} pill(s) remaining
                </Text>
              )}
              <Text variant="bodySmall" style={styles.snoozeText}>
                Snooze: {item.snooze_interval_minutes} min
              </Text>
            </View>
          </View>
        </Card>
      </Swipeable>
    );
  };

  if (loading && medications.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={medications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <EmptyState
            icon="medical-bag"
            title="No medications yet"
            subtitle="Tap the + button to add your first medication."
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchMedications}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={medications.length === 0 ? styles.emptyFlex : styles.listContent}
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => router.push('/medications/add')}
        color={colors.onPrimary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingVertical: spacing.sm,
    paddingBottom: 100,
  },
  emptyFlex: {
    flex: 1,
  },
  card: {
    marginHorizontal: layout.cardHorizontalMargin,
    marginVertical: 6,
    backgroundColor: colors.surface,
    elevation: 2,
  },
  cardContent: {
    padding: spacing.lg,
    gap: 6,
  },
  cardHeader: {
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  name: {
    fontWeight: '600',
    color: colors.text,
  },
  dosage: {
    color: colors.textSecondary,
  },
  schedules: {
    gap: 2,
    marginTop: 4,
  },
  scheduleText: {
    color: colors.primary,
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  metaText: {
    color: colors.textMuted,
  },
  lowStockMeta: {
    color: colors.warning,
    fontWeight: '500',
  },
  snoozeText: {
    color: colors.textMuted,
  },
  lowStockChip: {
    backgroundColor: colors.warningContainer,
    height: 24,
  },
  lowStockText: {
    fontSize: 11,
    color: colors.warning,
  },
  deleteAction: {
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    marginVertical: 6,
    marginRight: spacing.lg,
    borderRadius: 8,
    gap: 4,
  },
  deleteActionText: {
    color: colors.onPrimary,
    fontSize: 12,
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    right: layout.floatingButtonOffset,
    bottom: spacing.xl,
    backgroundColor: colors.primary,
  },
});

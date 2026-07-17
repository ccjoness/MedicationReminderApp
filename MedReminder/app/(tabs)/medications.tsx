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
import type { Medication } from '@/types';

export default function MedicationsScreen() {
  const router = useRouter();
  const { medications, loading, fetchMedications, deleteMedication } = useMedicationStore();

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
      <MaterialCommunityIcons name="trash-can" size={24} color="#fff" />
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
                      {timeStringToLabel(s.time_of_day)} — {days}
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
        <ActivityIndicator size="large" color="#6750A4" />
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
            tintColor="#6750A4"
          />
        }
        contentContainerStyle={medications.length === 0 ? styles.emptyFlex : styles.listContent}
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => router.push('/medications/add')}
        color="#fff"
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
  listContent: {
    paddingVertical: 8,
    paddingBottom: 100,
  },
  emptyFlex: {
    flex: 1,
  },
  card: {
    marginHorizontal: 16,
    marginVertical: 6,
    backgroundColor: '#fff',
    elevation: 2,
  },
  cardContent: {
    padding: 14,
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
    color: '#1a1a1a',
  },
  dosage: {
    color: '#555',
  },
  schedules: {
    gap: 2,
    marginTop: 4,
  },
  scheduleText: {
    color: '#6750A4',
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  metaText: {
    color: '#888',
  },
  lowStockMeta: {
    color: '#E65100',
    fontWeight: '500',
  },
  snoozeText: {
    color: '#888',
  },
  lowStockChip: {
    backgroundColor: '#FFF3E0',
    height: 24,
  },
  lowStockText: {
    fontSize: 11,
    color: '#E65100',
  },
  deleteAction: {
    backgroundColor: '#C62828',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    marginVertical: 6,
    marginRight: 16,
    borderRadius: 8,
    gap: 4,
  },
  deleteActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    backgroundColor: '#6750A4',
  },
});

import { View, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { Text, Button, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBadge } from './StatusBadge';
import { formatTime, timeStringToLabel } from '../utils/date';
import type { MedicationLog, Medication } from '../types';

interface Props {
  medication: Medication;
  log?: MedicationLog | null;
  scheduledTime?: Date | string;
  onMarkTaken?: () => void;
  onPress?: () => void;
}

export function MedicationCard({ medication, log, scheduledTime, onMarkTaken, onPress }: Props) {
  const status = log?.status ?? 'pending';
  const canTake = status === 'pending' || status === 'snoozed';
  const timeLabel = scheduledTime
    ? typeof scheduledTime === 'string'
      ? formatTime(scheduledTime)
      : formatTime(scheduledTime)
    : null;

  const lowStock =
    medication.refill_count !== null &&
    medication.low_refill_threshold !== null &&
    medication.refill_count <= medication.low_refill_threshold;

  return (
    <Card style={styles.card} onPress={onPress}>
      <View style={styles.row}>
        {medication.photo_url ? (
          <Image source={{ uri: medication.photo_url }} style={styles.photo} />
        ) : (
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="pill" size={28} color="#6750A4" />
          </View>
        )}

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text variant="titleMedium" style={styles.name} numberOfLines={1}>
              {medication.name}
            </Text>
            {log && <StatusBadge status={log.status} />}
          </View>

          <Text variant="bodySmall" style={styles.dosage}>
            {medication.dosage}
            {timeLabel ? ` • ${timeLabel}` : ''}
          </Text>

          {medication.notes ? (
            <Text variant="bodySmall" style={styles.notes} numberOfLines={1}>
              {medication.notes}
            </Text>
          ) : null}

          {lowStock ? (
            <View style={styles.refillWarning}>
              <MaterialCommunityIcons name="alert-circle" size={12} color="#E65100" />
              <Text style={styles.refillText}>
                {medication.refill_count} left — refill soon
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {canTake && onMarkTaken ? (
        <View style={styles.actions}>
          <Button
            mode="contained"
            compact
            onPress={onMarkTaken}
            style={styles.takeButton}
            labelStyle={styles.takeLabel}
          >
            Mark as Taken
          </Button>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 12,
    backgroundColor: '#fff',
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  photo: {
    width: 52,
    height: 52,
    borderRadius: 8,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#EDE7F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    fontWeight: '600',
    flex: 1,
    color: '#1a1a1a',
  },
  dosage: {
    color: '#555',
  },
  notes: {
    color: '#888',
    fontStyle: 'italic',
  },
  refillWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  refillText: {
    color: '#E65100',
    fontSize: 11,
    fontWeight: '500',
  },
  actions: {
    marginTop: 10,
    alignItems: 'flex-end',
  },
  takeButton: {
    borderRadius: 6,
    backgroundColor: '#6750A4',
  },
  takeLabel: {
    fontSize: 13,
  },
});

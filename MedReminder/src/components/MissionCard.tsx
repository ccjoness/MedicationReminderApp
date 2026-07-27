import { Image, StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBadge } from './StatusBadge';
import { formatTime } from '../utils/date';
import { useIs24HourFormat } from '../hooks/useTimeFormat';
import type { Mission, MissionOccurrence } from '../types';
import { colors, layout, radii, spacing } from '../theme';

interface Props {
  mission: Mission;
  occurrence?: MissionOccurrence | null;
  scheduledTime?: Date | string;
  onComplete?: () => void;
}

export function MissionCard({ mission, occurrence, scheduledTime, onComplete }: Props) {
  const is24Hour = useIs24HourFormat();
  const status = occurrence?.status ?? 'pending';
  const canComplete = status === 'pending' || status === 'snoozed';

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        {mission.image_url ? (
          <Image source={{ uri: mission.image_url }} style={styles.image} />
        ) : (
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="target" size={28} color={colors.primary} />
          </View>
        )}
        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text variant="titleMedium" style={styles.title} numberOfLines={1}>{mission.title}</Text>
            {occurrence && <StatusBadge status={occurrence.status} />}
          </View>
          <Text variant="bodySmall" style={styles.description} numberOfLines={2}>
            {mission.description || 'A mission worth completing'}
            {scheduledTime ? ` • ${formatTime(scheduledTime, is24Hour)}` : ''}
          </Text>
          {mission.notes ? (
            <Text variant="bodySmall" style={styles.notes} numberOfLines={1}>First step: {mission.notes}</Text>
          ) : null}
        </View>
      </View>
      {canComplete && onComplete ? (
        <View style={styles.actions}>
          <Button mode="contained" compact onPress={onComplete}>Complete Mission</Button>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: layout.cardHorizontalMargin,
    marginVertical: layout.cardVerticalMargin,
    padding: spacing.md,
    backgroundColor: colors.surface,
    elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  image: { width: 52, height: 52, borderRadius: radii.medium },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: radii.medium,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: spacing.xxs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, fontWeight: '600', color: colors.text },
  description: { color: colors.textSecondary },
  notes: { color: colors.textMuted, fontStyle: 'italic' },
  actions: { marginTop: 10, alignItems: 'flex-end' },
});

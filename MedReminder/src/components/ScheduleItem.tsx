import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import { DAY_LABELS, timeStringToLabel } from '../utils/date';
import { useIs24HourFormat } from '../hooks/useTimeFormat';
import type { MedicationSchedule } from '../types';
import { colors, radii, spacing } from '../theme';

interface Props {
  schedule: Pick<MedicationSchedule, 'time_of_day' | 'days_of_week'>;
  onRemove?: () => void;
  onPress?: () => void;
}

export function ScheduleItem({ schedule, onRemove, onPress }: Props) {
  const is24Hour = useIs24HourFormat();
  const daysLabel =
    schedule.days_of_week.length === 0
      ? 'Every day'
      : schedule.days_of_week
          .sort((a, b) => a - b)
          .map((d) => DAY_LABELS[d])
          .join(', ');

  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.container}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.info}>
        <Text variant="titleSmall" style={styles.time}>
          {timeStringToLabel(schedule.time_of_day, is24Hour)}
        </Text>
        <Text variant="bodySmall" style={styles.days}>
          {daysLabel}
        </Text>
      </View>
      {onRemove ? (
        <IconButton icon="close" size={18} onPress={onRemove} iconColor={colors.textDisabled} />
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryContainerSoft,
    borderRadius: radii.medium,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginVertical: 4,
  },
  info: {
    flex: 1,
  },
  time: {
    color: colors.primary,
    fontWeight: '600',
  },
  days: {
    color: colors.textSecondary,
    marginTop: 2,
  },
});

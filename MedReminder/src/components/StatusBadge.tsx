import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import type { MissionStatus } from '../types';
import { colors } from '../theme';

const STATUS_CONFIG: Record<MissionStatus, { label: string; bg: string; color: string }> = {
  pending: { label: 'Pending', bg: colors.warningContainer, color: colors.warning },
  completed: { label: 'Completed', bg: colors.successContainer, color: colors.success },
  expired: { label: 'Not completed', bg: colors.errorContainer, color: colors.error },
  snoozed: { label: 'Snoozed', bg: colors.infoContainer, color: colors.info },
};

interface Props {
  status: MissionStatus;
}

export function StatusBadge({ status }: Props) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    bg: colors.border,
    color: colors.textSecondary,
  };
  const { label, bg, color } = cfg;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});

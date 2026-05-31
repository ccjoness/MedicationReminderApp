import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import type { LogStatus } from '../types';

const STATUS_CONFIG: Record<LogStatus, { label: string; bg: string; color: string }> = {
  pending: { label: 'Pending', bg: '#FFF3E0', color: '#E65100' },
  taken: { label: 'Taken', bg: '#E8F5E9', color: '#2E7D32' },
  missed: { label: 'Missed', bg: '#FFEBEE', color: '#C62828' },
  snoozed: { label: 'Snoozed', bg: '#E3F2FD', color: '#1565C0' },
};

interface Props {
  status: LogStatus;
}

export function StatusBadge({ status }: Props) {
  const { label, bg, color } = STATUS_CONFIG[status];
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

import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface Props {
  icon: IconName;
  title: string;
  subtitle?: string;
}

export function EmptyState({ icon, title, subtitle }: Props) {
  return (
    <View style={styles.container}>
      <MaterialCommunityIcons name={icon} size={64} color={colors.iconMuted} />
      <Text variant="titleMedium" style={styles.title}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="bodyMedium" style={styles.subtitle}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxxl,
    gap: spacing.md,
  },
  title: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textDisabled,
    textAlign: 'center',
    lineHeight: 22,
  },
});

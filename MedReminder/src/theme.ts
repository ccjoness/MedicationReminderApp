import { MD3LightTheme } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';

export const colors = {
  primary: '#225F06',
  primaryContainer: '#EDE9FF',
  primaryContainerSoft: '#F5F3FF',
  onPrimary: '#FFFFFF',

  background: '#F7F6FC',
  surface: '#FFFFFF',
  surfaceVariant: '#F0EEF5',
  border: '#D9D5EB',

  text: '#0D0B22',
  textStrong: '#1A1340',
  textSecondary: '#2E2A40',
  textSubtle: '#5A5270',
  textMuted: '#7B768F',
  textDisabled: '#A09AB8',
  iconMuted: '#C4BBFF',

  success: '#0A6647',
  successContainer: '#D4F7EC',
  warning: '#854F0B',
  warningContainer: '#FAEEDA',
  error: '#A32D2D',
  errorDark: '#7A1F1F',
  errorContainer: '#FCEBEB',
  info: '#185FA5',
  infoContainer: '#E6F1FB',

  overlay: 'rgba(13,11,34,0.4)',
  onPrimaryMuted: 'rgba(255,255,255,0.8)',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

export const radii = {
  small: 6,
  medium: 8,
  large: 12,
  pill: 999,
} as const;

export const layout = {
  screenPadding: spacing.lg,
  formPadding: spacing.lg,
  cardHorizontalMargin: spacing.lg,
  cardVerticalMargin: 6,
  tabBarBorderWidth: 1,
  floatingButtonOffset: 20,
} as const;

export const appTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: radii.medium,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    onPrimary: colors.onPrimary,
    primaryContainer: colors.primaryContainer,
    background: colors.background,
    surface: colors.surface,
    surfaceVariant: colors.surfaceVariant,
    outline: colors.border,
    error: colors.error,
    onError: colors.onPrimary,
    errorContainer: colors.errorContainer,
  },
};
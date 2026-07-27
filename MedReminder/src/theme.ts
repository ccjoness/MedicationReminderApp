import { MD3LightTheme, type MD3Theme } from 'react-native-paper';

/**
 * Quovi runtime theme and layout tokens.
 *
 * React Native does not use CSS for native Android screens. Edit the values in
 * this file to change colors, spacing, and corner radii throughout the app.
 * Build-time colors such as the splash screen and notification icon remain in
 * app.config.js because Android compiles those into the APK.
 */
export const colors = {
  primary: '#225F06',
  primaryContainer: '#D5EFC8',
  primaryContainerSoft: '#EDF7E8',
  onPrimary: '#FFFFFF',

  background: '#F7FAF5',
  surface: '#FFFFFF',
  surfaceVariant: '#EFF4EC',
  border: '#DCE5D8',

  text: '#172114',
  textStrong: '#263323',
  textSecondary: '#4B5847',
  textSubtle: '#64705F',
  textMuted: '#7B8677',
  textDisabled: '#9AA397',
  iconMuted: '#C7CDC4',

  success: '#2E7D32',
  successContainer: '#E8F5E9',
  warning: '#E65100',
  warningContainer: '#FFF3E0',
  error: '#C62828',
  errorDark: '#B00020',
  errorContainer: '#FFEBEE',
  info: '#1565C0',
  infoContainer: '#E3F2FD',

  overlay: 'rgba(0,0,0,0.4)',
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

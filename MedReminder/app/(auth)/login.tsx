import { useState } from 'react';
import { View, StyleSheet, Image, Alert } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import {
  GoogleSignin,
  GoogleSigninButton,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { refreshSession } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const signInResult = await GoogleSignin.signIn();

      const idToken = signInResult.data?.idToken;
      if (!idToken) throw new Error('No ID token returned from Google Sign-In');

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });
      if (error) throw error;

      await refreshSession();
      router.replace('/(tabs)');
    } catch (e: unknown) {
      const code = (e as any)?.code;
      if (code === statusCodes.SIGN_IN_CANCELLED) return;
      if (code === statusCodes.IN_PROGRESS) return;
      if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Google Play Services required', 'Please update Google Play Services.');
        return;
      }
      const message = e instanceof Error ? e.message : 'Sign in failed. Please try again.';
      Alert.alert('Sign In Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text variant="displaySmall" style={styles.title}>
          Lumidose
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Your personal medication tracker
        </Text>
      </View>

      <View style={styles.footer}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : (
          <GoogleSigninButton
            size={GoogleSigninButton.Size.Wide}
            color={GoogleSigninButton.Color.Dark}
            onPress={handleGoogleSignIn}
            style={styles.googleButton}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    justifyContent: 'space-between',
    paddingVertical: 80,
    paddingHorizontal: spacing.xxl,
  },
  header: {
    alignItems: 'center',
    gap: spacing.md,
    marginTop: 40,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 20,
    marginBottom: 8,
  },
  title: {
    fontWeight: 'bold',
    color: colors.primary,
    letterSpacing: 1,
  },
  subtitle: {
    color: colors.textSubtle,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    alignItems: 'center',
    gap: 16,
  },
  googleButton: {
    width: 240,
    height: 52,
  },
});

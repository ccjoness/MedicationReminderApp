import { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { Text, TextInput, Button, Divider } from 'react-native-paper';
import { Link, useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

// Native Google Sign-In SDK (Android & iOS only)
const GoogleSignin =
  Platform.OS !== 'web'
    ? require('@react-native-google-signin/google-signin').GoogleSignin
    : null;

const statusCodes =
  Platform.OS !== 'web'
    ? require('@react-native-google-signin/google-signin').statusCodes
    : null;

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
type FormData = z.infer<typeof schema>;

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, loading, refreshSession } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await signIn(data.email, data.password);
      router.replace('/(tabs)');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Sign in failed';
      Alert.alert('Sign In Error', message);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      // --- Web: browser-based OAuth via Supabase ---
      if (Platform.OS === 'web') {
        const redirectTo = window.location.origin + '/auth/callback';
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo },
        });
        if (error) Alert.alert('Sign In Error', error.message);
        return;
      }

      // --- Native: Google Sign-In SDK ---
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const signInResult = await GoogleSignin.signIn();

      const idToken = signInResult.data?.idToken;
      if (!idToken) throw new Error('No ID token returned from Google');

      // Exchange the Google ID token for a Supabase session
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (error) throw error;

      await refreshSession();
      router.replace('/(tabs)');
    } catch (e: unknown) {
      if (statusCodes && (e as any)?.code === statusCodes.SIGN_IN_CANCELLED) return;
      if (statusCodes && (e as any)?.code === statusCodes.IN_PROGRESS) return;
      const message = e instanceof Error ? e.message : 'Google sign in failed';
      Alert.alert('Sign In Error', message);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      if (Platform.OS === 'web') {
        const redirectTo = window.location.origin + '/auth/callback';
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'apple',
          options: { redirectTo },
        });
        if (error) Alert.alert('Sign In Error', error.message);
        return;
      }

      // Native Apple Sign-In via browser fallback (Apple SDK requires paid Apple dev account)
      const redirectUrl = Linking.createURL('auth/callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
      });
      if (error || !data.url) {
        Alert.alert('Sign In Error', error?.message ?? 'Could not open Apple sign in');
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
      if (result.type !== 'success') return;

      const { error: sessionError } = await supabase.auth.exchangeCodeForSession(result.url);
      if (sessionError) throw sessionError;

      await refreshSession();
      router.replace('/(tabs)');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Apple sign in failed';
      Alert.alert('Sign In Error', message);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>
          Lumidose
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Your personal medication tracker
        </Text>
      </View>

      <View style={styles.form}>
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, value } }) => (
            <TextInput
              label="Email"
              value={value}
              onChangeText={onChange}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={!!errors.email}
              style={styles.input}
              mode="outlined"
            />
          )}
        />
        {errors.email && (
          <Text style={styles.errorText}>{errors.email.message}</Text>
        )}

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, value } }) => (
            <TextInput
              label="Password"
              value={value}
              onChangeText={onChange}
              secureTextEntry={!showPassword}
              autoComplete="password"
              error={!!errors.password}
              style={styles.input}
              mode="outlined"
              right={
                <TextInput.Icon
                  icon={showPassword ? 'eye-off' : 'eye'}
                  onPress={() => setShowPassword((v) => !v)}
                />
              }
            />
          )}
        />
        {errors.password && (
          <Text style={styles.errorText}>{errors.password.message}</Text>
        )}

        <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
          <Text style={styles.forgotText}>Forgot password?</Text>
        </TouchableOpacity>

        <Button
          mode="contained"
          onPress={handleSubmit(onSubmit)}
          loading={loading}
          disabled={loading}
          style={styles.button}
          contentStyle={styles.buttonContent}
        >
          Sign In
        </Button>

        <Divider style={styles.divider} />
        <Text style={styles.orText}>or continue with</Text>

        <Button
          mode="outlined"
          onPress={handleGoogleSignIn}
          icon="google"
          style={styles.socialButton}
          contentStyle={styles.buttonContent}
        >
          Sign in with Google
        </Button>

        {Platform.OS === 'ios' && (
          <Button
            mode="outlined"
            onPress={handleAppleSignIn}
            icon="apple"
            style={styles.socialButton}
            contentStyle={styles.buttonContent}
          >
            Sign in with Apple
          </Button>
        )}
      </View>

      <View style={styles.footer}>
        <Text>Don&apos;t have an account? </Text>
        <Link href="/(auth)/register" asChild>
          <TouchableOpacity>
            <Text style={styles.linkText}>Sign up</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontWeight: 'bold',
    color: '#6750A4',
    marginBottom: 8,
  },
  subtitle: {
    color: '#666',
    textAlign: 'center',
  },
  form: {
    gap: 8,
  },
  input: {
    backgroundColor: '#fff',
  },
  errorText: {
    color: '#B00020',
    fontSize: 12,
    marginTop: -4,
    marginLeft: 4,
  },
  forgotText: {
    color: '#6750A4',
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 8,
  },
  button: {
    marginTop: 8,
    borderRadius: 8,
  },
  buttonContent: {
    paddingVertical: 6,
  },
  divider: {
    marginVertical: 20,
  },
  orText: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 12,
  },
  socialButton: {
    borderRadius: 8,
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  linkText: {
    color: '#6750A4',
    fontWeight: 'bold',
  },
});

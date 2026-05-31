import { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
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
import { makeRedirectUri, useAuthRequest } from 'expo-auth-session';
import * as AuthSession from 'expo-auth-session';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
type FormData = z.infer<typeof schema>;

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, loading } = useAuthStore();
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
    const redirectUrl = makeRedirectUri({ scheme: 'med-reminder', path: 'auth/callback' });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
    });
    if (error || !data.url) {
      Alert.alert('Google Sign In Error', error?.message ?? 'Could not open Google sign in');
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
    if (result.type === 'success') {
      const params = new URL(result.url).hash.substring(1);
      const parsed = Object.fromEntries(new URLSearchParams(params));
      if (parsed.access_token) {
        await supabase.auth.setSession({
          access_token: parsed.access_token,
          refresh_token: parsed.refresh_token,
        });
        router.replace('/(tabs)');
      }
    }
  };

  const handleAppleSignIn = async () => {
    const redirectUrl = makeRedirectUri({ scheme: 'med-reminder', path: 'auth/callback' });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
    });
    if (error || !data.url) {
      Alert.alert('Apple Sign In Error', error?.message ?? 'Could not open Apple sign in');
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
    if (result.type === 'success') {
      const params = new URL(result.url).hash.substring(1);
      const parsed = Object.fromEntries(new URLSearchParams(params));
      if (parsed.access_token) {
        await supabase.auth.setSession({
          access_token: parsed.access_token,
          refresh_token: parsed.refresh_token,
        });
        router.replace('/(tabs)');
      }
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>
          MedReminder
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

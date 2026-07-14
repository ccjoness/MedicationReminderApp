/**
 * Web-only OAuth callback page.
 *
 * After Google/Apple sign-in, Supabase redirects the browser to
 * <origin>/auth/callback?code=... .
 *
 * Because supabase.ts sets detectSessionInUrl: true on web, the Supabase
 * client automatically exchanges the code for a session when the page loads.
 * We just wait for that to complete and then navigate to the app.
 */
import { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { refreshSession } = useAuthStore();

  useEffect(() => {
    // This page is only meaningful on web. On native the deep link
    // is handled in login.tsx via WebBrowser.openAuthSessionAsync.
    if (Platform.OS !== 'web') {
      router.replace('/(tabs)');
      return;
    }

    let unsubscribed = false;

    // Listen for the SIGNED_IN event that fires once Supabase has processed
    // the ?code= parameter from the redirect URL.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session && !unsubscribed) {
          unsubscribed = true;
          subscription.unsubscribe();
          await refreshSession();
          router.replace('/(tabs)');
        }
      }
    );

    // Fallback: if the session is already available (e.g. fast exchange),
    // navigate immediately.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session && !unsubscribed) {
        unsubscribed = true;
        subscription.unsubscribe();
        await refreshSession();
        router.replace('/(tabs)');
      }
    });

    return () => {
      unsubscribed = true;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#6750A4" />
      <Text variant="bodyLarge" style={styles.text}>
        Signing you in…
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: '#fff',
  },
  text: {
    color: '#555',
  },
});

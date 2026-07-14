import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoCrypto from 'expo-crypto';

// Polyfill crypto.getRandomValues on native only.
// Web browsers already provide a native WebCrypto implementation.
if (Platform.OS !== 'web') {
  if (typeof global.crypto === 'undefined' || !global.crypto.getRandomValues) {
    (global as typeof global & { crypto: Crypto }).crypto = {
      getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
        if (array && ArrayBuffer.isView(array)) {
          const bytes = ExpoCrypto.getRandomBytes(array.byteLength);
          new Uint8Array(array.buffer, array.byteOffset, array.byteLength).set(bytes);
        }
        return array;
      },
    } as Crypto;
  }
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables.\n' +
    'Copy .env.example to .env and fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Web uses localStorage by default; native needs AsyncStorage
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // On web, automatically handle the OAuth code in the URL on page load
    detectSessionInUrl: Platform.OS === 'web',
    flowType: 'pkce',
  },
});

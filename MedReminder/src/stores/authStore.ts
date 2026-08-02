import { create } from 'zustand';
import type { Session, User, Subscription } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  initialized: boolean;
  _subscription: Subscription | null;
  // Actions
  initialize: () => Promise<void>;
  refreshSession: () => Promise<void>;
  fetchProfile: (userId: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearLocalSession: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<Profile, 'display_name' | 'avatar_url'>>) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  initialized: false,
  _subscription: null,

  initialize: async () => {
    // Unsubscribe any previous listener (guards against double-mount in React StrictMode)
    get()._subscription?.unsubscribe();

    const { data: { session } } = await supabase.auth.getSession();
    set({ session, user: session?.user ?? null, initialized: true });
    if (session?.user) get().fetchProfile(session.user.id);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        set({ session: newSession, user: newSession?.user ?? null });

        if (newSession?.user) {
          // The DB trigger (on_auth_user_created) already creates the profile row.
          // We only need to fetch it here — no redundant SELECT+INSERT needed.
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            get().fetchProfile(newSession.user.id);
          }
        } else {
          set({ profile: null });
        }
      }
    );

    set({ _subscription: subscription });
  },

  refreshSession: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    set({ session, user: session?.user ?? null });
    if (session?.user) get().fetchProfile(session.user.id);
  },

  fetchProfile: async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (!error && data) set({ profile: data as Profile });
  },

  signOut: async () => {
    get()._subscription?.unsubscribe();
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null, _subscription: null });
  },

  clearLocalSession: async () => {
    get()._subscription?.unsubscribe();
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } finally {
      // The server may already consider the token invalid after deleting the
      // Auth user, but the app must still clear its persisted local session.
      set({ session: null, user: null, profile: null, _subscription: null });
    }
  },

  updateProfile: async (updates) => {
    const { user } = get();
    if (!user) return;
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
    if (error) throw error;
    set((state) => ({
      profile: state.profile ? { ...state.profile, ...updates } : state.profile,
    }));
  },
}));

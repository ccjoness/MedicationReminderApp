import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  initialized: boolean;
  // Actions
  initialize: () => Promise<void>;
  refreshSession: () => Promise<void>;
  fetchProfile: (userId: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<Profile, 'display_name' | 'avatar_url'>>) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  initialized: false,

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    set({ session, user: session?.user ?? null, initialized: true });

    if (session?.user) get().fetchProfile(session.user.id);

    supabase.auth.onAuthStateChange(async (event, newSession) => {
      set({ session: newSession, user: newSession?.user ?? null });

      if (newSession?.user) {
        if (event === 'SIGNED_IN') {
          // Ensure a profile row exists (first-time Google sign-in)
          const { data: existing } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', newSession.user.id)
            .maybeSingle();

          if (!existing) {
            await supabase.from('profiles').insert({
              id: newSession.user.id,
              email: newSession.user.email ?? '',
              display_name:
                newSession.user.user_metadata?.full_name ??
                newSession.user.email?.split('@')[0] ??
                'User',
              avatar_url: newSession.user.user_metadata?.avatar_url ?? null,
            });
          }
          get().fetchProfile(newSession.user.id);
        }
      } else {
        set({ profile: null });
      }
    });
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
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null });
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

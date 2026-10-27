import { create } from 'zustand';
import { api, type AuthUser } from '../sync/api';
import { useSyncStore } from './syncStore';

interface AuthState {
  user: AuthUser | null;
  /** True once /api/me has answered this boot (signed out counts as answered). */
  checked: boolean;
  busy: boolean;
  refreshMe: () => Promise<void>;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

/**
 * Cookie-based auth. The session itself lives in an HttpOnly cookie — this
 * store only mirrors WHO is signed in. Signing in/out resets the sync cursor
 * so the next sync is a full two-way merge for that account.
 */
export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  checked: false,
  busy: false,

  refreshMe: async () => {
    try {
      const { user } = await api.me();
      set({ user, checked: true });
    } catch {
      set({ user: null, checked: true });
    }
  },

  signIn: async (username, password) => {
    set({ busy: true });
    try {
      const { user } = await api.login(username, password);
      useSyncStore.getState().reset();
      set({ user, checked: true, busy: false });
    } catch (error) {
      set({ busy: false });
      throw error;
    }
  },

  signUp: async (username, password, displayName) => {
    set({ busy: true });
    try {
      const { user } = await api.register(username, password, displayName);
      useSyncStore.getState().reset();
      set({ user, checked: true, busy: false });
    } catch (error) {
      set({ busy: false });
      throw error;
    }
  },

  signOut: async () => {
    try {
      await api.logout();
    } catch {
      // Clear locally regardless — a stale cookie is harmless.
    }
    useSyncStore.getState().reset();
    set({ user: null });
  },
}));

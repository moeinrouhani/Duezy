import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline' | 'unavailable';

interface SyncState {
  /** Cursor is per-user: signing into a different account forces a full merge. */
  lastSyncUser: string | null;
  /** Server clock from the last successful response — the PULL cursor. */
  lastSyncAt: string | null;
  /**
   * Client wall clock captured when the last successful sync STARTED — the
   * PUSH cursor. Kept on the client clock (not the server's) so a device
   * whose clock runs behind the server can't silently skip its own edits.
   */
  lastPushAtMs: number | null;
  /** Local wall clock of the last successful sync (for display only). */
  lastSyncedAtMs: number | null;
  status: SyncStatus;
  setMeta: (patch: {
    lastSyncUser?: string | null;
    lastSyncAt?: string | null;
    lastPushAtMs?: number | null;
    lastSyncedAtMs?: number | null;
    status?: SyncStatus;
  }) => void;
  reset: () => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      lastSyncUser: null,
      lastSyncAt: null,
      lastPushAtMs: null,
      lastSyncedAtMs: null,
      status: 'idle',
      setMeta: (patch) => set(patch),
      reset: () =>
        set({
          lastSyncUser: null,
          lastSyncAt: null,
          lastPushAtMs: null,
          lastSyncedAtMs: null,
          status: 'idle',
        }),
    }),
    {
      name: 'duezy-sync',
      version: 1,
      // Transient status must not survive reloads ('syncing' would stick).
      partialize: (state) => ({
        lastSyncUser: state.lastSyncUser,
        lastSyncAt: state.lastSyncAt,
        lastPushAtMs: state.lastPushAtMs,
        lastSyncedAtMs: state.lastSyncedAtMs,
      }),
    },
  ),
);

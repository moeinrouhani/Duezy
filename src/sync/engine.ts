import type { Table } from 'dexie';
import { openDatabase } from '../db/db';
import { getRepositories } from '../repositories';
import { useAuthStore } from '../stores/authStore';
import { useSyncStore } from '../stores/syncStore';
import { useCategoryStore, useReminderStore } from '../stores/dataStores';
import { api, ApiError, type SyncEnvelope } from './api';
import { setSyncTrigger } from './bus';

/**
 * Bidirectional last-write-wins sync.
 *
 * One round trip per sync: push every locally-changed record, pull every
 * remote change, apply pulled records only when strictly newer than the
 * local copy.
 *
 * Two independent cursors, deliberately on different clocks:
 * - PUSH cursor = client wall clock when the last sync started. Comparing
 *   client timestamps against the server's clock would silently drop edits
 *   on any device whose clock runs behind the server.
 * - PULL cursor = the server timestamp of the last response. Server-only
 *   comparison, immune to client clock skew.
 *
 * Offline changes simply wait — the next successful sync pushes them, and
 * the manual "Sync now" button forces a FULL two-way pass that converges
 * regardless of cursors or clocks.
 */

export type SyncOutcome = 'synced' | 'signed-out' | 'failed';

let inFlight: Promise<SyncOutcome> | null = null;
let rerunQueued = false;

/** Records changed after the given client-clock moment; all of them when null. */
export function filterChangedSince<T extends { updatedAt: string }>(
  records: T[],
  sinceMs: number | null,
): T[] {
  if (sinceMs === null) return records;
  return records.filter((record) => {
    const changedAtMs = Date.parse(record.updatedAt);
    return Number.isFinite(changedAtMs) && changedAtMs > sinceMs;
  });
}

/** LWW accept rule for pulled records — never clobber a fresher local edit. */
export function shouldApplyRemote<T extends { updatedAt: string }>(remote: T, local: T | undefined): boolean {
  return !local || remote.updatedAt > local.updatedAt;
}

/**
 * Wrap a local record into the wire envelope: the four sync columns the
 * server indexes and compares live on the envelope, the full record rides as
 * `data`. Records pushed bare (no `data`) get stored as empty payloads, which
 * every device then silently skips on pull — the silent-sync-killer bug.
 */
export function toEnvelope<T extends { id: string; createdAt: string; updatedAt: string; deletedAt: string | null }>(
  record: T,
): SyncEnvelope<T> {
  return {
    id: record.id,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt,
    data: record,
  };
}

/** Coalesce concurrent callers into one round trip; a change arriving mid-sync re-runs. */
export function syncNow(opts?: { full?: boolean }): Promise<SyncOutcome> {
  if (inFlight) {
    rerunQueued = true;
    return inFlight;
  }
  inFlight = runSync(opts?.full ?? false).finally(() => {
    inFlight = null;
    if (rerunQueued) {
      rerunQueued = false;
      void syncNow();
    }
  });
  return inFlight;
}

async function runSync(full: boolean): Promise<SyncOutcome> {
  const { user } = useAuthStore.getState();
  if (!user) return 'signed-out';

  const syncState = useSyncStore.getState();
  const initial = full || syncState.lastSyncUser !== user.id;
  const pullSince = initial ? null : syncState.lastSyncAt;
  // Capture BEFORE gathering, so edits made during the flight are caught by
  // the next sync rather than falling between two cursors.
  const pushMarkerMs = Date.now();
  const pushSinceMs = initial ? null : (syncState.lastPushAtMs ?? 0);
  useSyncStore.setState({ status: 'syncing' });

  try {
    const repos = await getRepositories();
    // Every list here includes TOMBSTONES — a deletion is itself a change the
    // server must learn about. (The UI-facing categories.list() hides them,
    // which used to leave deleted categories alive on the server forever.)
    const [reminders, categories, completions] = await Promise.all([
      repos.reminders.list({ activeOnly: false }),
      repos.categories.listAll(),
      repos.completions.listAll(),
    ]);

    const pushing = {
      reminders: filterChangedSince(reminders, pushSinceMs).map(toEnvelope),
      categories: filterChangedSince(categories, pushSinceMs).map(toEnvelope),
      completions: filterChangedSince(completions, pushSinceMs).map(toEnvelope),
    };

    const { now, changes } = await api.sync(pullSince, pushing);

    // Apply directly against Dexie (not the repositories) so the applied
    // remote records don't re-trigger requestSync through the mutation bus.
    const db = await openDatabase();
    await applyTable(db.reminders, reminders, changes.reminders);
    await applyTable(db.categories, categories, changes.categories);
    await applyTable(db.completions, completions, changes.completions);

    useSyncStore.getState().setMeta({
      lastSyncUser: user.id,
      lastSyncAt: now,
      lastPushAtMs: pushMarkerMs,
      lastSyncedAtMs: Date.now(),
      lastPulledCount:
        changes.reminders.length + changes.categories.length + changes.completions.length,
      status: 'idle',
    });
    await Promise.all([useReminderStore.getState().refresh(), useCategoryStore.getState().refresh()]);
    console.info(
      `[sync] pushed ${pushing.reminders.length}+${pushing.categories.length}+${pushing.completions.length}, ` +
        `pulled ${changes.reminders.length}+${changes.categories.length}+${changes.completions.length}`,
    );
    return 'synced';
  } catch (error) {
    const status =
      error instanceof ApiError && error.code === 'not_configured'
        ? 'unavailable'
        : typeof navigator !== 'undefined' && navigator.onLine === false
          ? 'offline'
          : 'error';
    useSyncStore.setState({ status });
    console.error('[sync] failed:', error);
    return 'failed';
  }
}

function hasSyncShape(value: unknown): value is { id: string; updatedAt: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { id?: unknown }).id === 'string' &&
    typeof (value as { updatedAt?: unknown }).updatedAt === 'string'
  );
}

/**
 * LWW merge of pulled records against the local table. `localRows` must be
 * the tombstone-inclusive table contents: a deleted-locally record that's
 * missing from the map looks "absent", and any stale remote copy would then
 * slip past the LWW check and resurrect it.
 */
export function acceptRemote<T extends { id: string; updatedAt: string }>(
  localRows: T[],
  remoteRows: unknown[],
): T[] {
  const localById = new Map(localRows.map((row) => [row.id, row]));
  const accepted: T[] = [];
  for (const remote of remoteRows) {
    if (!hasSyncShape(remote)) {
      console.warn('[sync] skipped malformed remote record');
      continue;
    }
    const candidate = remote as T;
    if (shouldApplyRemote(candidate, localById.get(candidate.id))) accepted.push(candidate);
  }
  return accepted;
}

async function applyTable<T extends { id: string; updatedAt: string }>(
  table: Table<T, string>,
  localRows: T[],
  remoteRows: unknown[],
): Promise<void> {
  const accepted = acceptRemote(localRows, remoteRows);
  if (accepted.length > 0) await table.bulkPut(accepted);
}

let installed = false;

/** Wire the mutation bus + lifecycle triggers. Called once from App. */
export function installSyncTriggers(): void {
  if (installed) return;
  installed = true;
  setSyncTrigger(() => void syncNow());

  const onActive = () => {
    if (document.visibilityState === 'visible') void syncNow();
  };
  document.addEventListener('visibilitychange', onActive);
  window.addEventListener('focus', onActive);
  window.addEventListener('online', onActive);
  window.setInterval(() => void syncNow(), 5 * 60_000);
}

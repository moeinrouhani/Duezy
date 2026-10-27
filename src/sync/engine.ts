import type { Table } from 'dexie';
import { openDatabase } from '../db/db';
import { getRepositories } from '../repositories';
import { useAuthStore } from '../stores/authStore';
import { useSyncStore } from '../stores/syncStore';
import { useCategoryStore, useReminderStore } from '../stores/dataStores';
import { api, ApiError } from './api';
import { setSyncTrigger } from './bus';

/**
 * Bidirectional last-write-wins sync.
 *
 * One round trip per sync: push every local record newer than the cursor,
 * pull every remote record newer than the cursor, apply pulled records only
 * when strictly newer than the local copy. The cursor is the SERVER timestamp
 * of the previous response, so client clock skew can't corrupt the merge.
 * Offline changes simply wait — the next successful sync pushes them.
 */

export type SyncOutcome = 'synced' | 'signed-out' | 'failed';

let inFlight: Promise<SyncOutcome> | null = null;
let rerunQueued = false;

/** Records strictly newer than the cursor; all of them when the cursor is null. */
export function filterNewer<T extends { updatedAt: string }>(records: T[], since: string | null): T[] {
  if (since === null) return records;
  return records.filter((record) => record.updatedAt > since);
}

/** LWW accept rule for pulled records — never clobber a fresher local edit. */
export function shouldApplyRemote<T extends { updatedAt: string }>(remote: T, local: T | undefined): boolean {
  return !local || remote.updatedAt > local.updatedAt;
}

/** Coalesce concurrent callers into one round trip; a change arriving mid-sync re-runs. */
export function syncNow(): Promise<SyncOutcome> {
  if (inFlight) {
    rerunQueued = true;
    return inFlight;
  }
  inFlight = runSync().finally(() => {
    inFlight = null;
    if (rerunQueued) {
      rerunQueued = false;
      void syncNow();
    }
  });
  return inFlight;
}

async function runSync(): Promise<SyncOutcome> {
  const { user } = useAuthStore.getState();
  if (!user) return 'signed-out';

  const syncState = useSyncStore.getState();
  const initial = syncState.lastSyncUser !== user.id;
  const since = initial ? null : syncState.lastSyncAt;
  useSyncStore.setState({ status: 'syncing' });

  try {
    const repos = await getRepositories();
    const [reminders, categories, completions] = await Promise.all([
      repos.reminders.list({ activeOnly: false }),
      repos.categories.list(),
      repos.completions.listAll(),
    ]);

    const pushing = initial
      ? { reminders, categories, completions }
      : {
          reminders: filterNewer(reminders, since),
          categories: filterNewer(categories, since),
          completions: filterNewer(completions, since),
        };

    const { now, changes } = await api.sync(since, pushing);

    // Apply directly against Dexie (not the repositories) so the applied
    // remote records don't re-trigger requestSync through the mutation bus.
    const db = await openDatabase();
    await applyTable(db.reminders, reminders, changes.reminders);
    await applyTable(db.categories, categories, changes.categories);
    await applyTable(db.completions, completions, changes.completions);

    useSyncStore.getState().setMeta({
      lastSyncUser: user.id,
      lastSyncAt: now,
      lastSyncedAtMs: Date.now(),
      status: 'idle',
    });
    await Promise.all([useReminderStore.getState().refresh(), useCategoryStore.getState().refresh()]);
    return 'synced';
  } catch (error) {
    const status =
      error instanceof ApiError && error.code === 'not_configured'
        ? 'unavailable'
        : typeof navigator !== 'undefined' && navigator.onLine === false
          ? 'offline'
          : 'error';
    useSyncStore.setState({ status });
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

async function applyTable<T extends { id: string; updatedAt: string }>(
  table: Table<T, string>,
  localRows: T[],
  remoteRows: unknown[],
): Promise<void> {
  if (remoteRows.length === 0) return;
  const localById = new Map(localRows.map((row) => [row.id, row]));
  const accepted: T[] = [];
  for (const remote of remoteRows) {
    if (!hasSyncShape(remote)) continue;
    const candidate = remote as T;
    if (shouldApplyRemote(candidate, localById.get(candidate.id))) accepted.push(candidate);
  }
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

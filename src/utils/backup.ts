import type { BackupFile } from '../repositories/types';
import { getRepositories } from '../repositories';
import { isValidISODate } from '../domain/date';
import { acceptRemote } from '../sync/engine';
import { useCategoryStore, useReminderStore } from '../stores/dataStores';
import type { Settings, Timestamp } from '../domain/types';

/** Gather every table + settings into a versioned JSON backup. */
export async function createBackup(settings: Settings): Promise<BackupFile> {
  const repos = await getRepositories();
  const [reminders, categories, completions] = await Promise.all([
    repos.reminders.list({ activeOnly: false }),
    repos.categories.list(),
    repos.completions.listAll(),
  ]);
  return {
    version: 1,
    app: 'duezy',
    exportedAt: new Date().toISOString(),
    settings,
    categories,
    reminders,
    completions,
  };
}

export function backupFileName(exportedAt: Timestamp): string {
  return `duezy-backup-${exportedAt.slice(0, 10)}.json`;
}

/** Download the backup as a file (browser only). */
export function downloadBackup(backup: BackupFile): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = backupFileName(backup.exportedAt);
  // Firefox needs the anchor in the DOM, and revoking right away can cancel
  // the download in Safari/Firefox — release the blob a little later.
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export interface ImportResult {
  reminders: number;
  categories: number;
  completions: number;
  settingsApplied: boolean;
}

/**
 * Validate shape loosely, then merge idempotently (last-write-wins on
 * updatedAt). Returns counts; throws Error with a user-mappable key on bad input.
 */
export async function importBackup(
  text: string,
): Promise<{ backup: BackupFile; result: ImportResult }> {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('backup.invalidJson');
  }
  if (!isBackupLike(data)) throw new Error('backup.invalidFormat');

  const repos = await getRepositories();
  // Merge by newest change (as documented): an older backup row must never
  // overwrite a fresher local edit. Local lists include tombstones so a record
  // deleted here isn't resurrected by a stale backup copy.
  const [localReminders, localCategories, localCompletions] = await Promise.all([
    repos.reminders.list({ activeOnly: false }),
    repos.categories.listAll(),
    repos.completions.listAll(),
  ]);
  const reminders = acceptRemote(localReminders, data.reminders);
  const categories = acceptRemote(localCategories, data.categories);
  const completions = acceptRemote(localCompletions, data.completions);
  await Promise.all([
    repos.categories.bulkPut(categories),
    repos.reminders.bulkPut(reminders),
    repos.completions.bulkPut(completions),
  ]);
  // The screens read mirror stores — without a refresh imported data stayed invisible until reload.
  await Promise.all([useReminderStore.getState().refresh(), useCategoryStore.getState().refresh()]);

  return {
    backup: data,
    result: {
      reminders: data.reminders.length,
      categories: data.categories.length,
      completions: data.completions.length,
      settingsApplied: isSettingsLike(data.settings),
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isBackupLike(value: unknown): value is BackupFile {
  if (!isRecord(value)) return false;
  return (
    value.app === 'duezy' &&
    value.version === 1 &&
    Array.isArray(value.reminders) &&
    Array.isArray(value.categories) &&
    Array.isArray(value.completions) &&
    value.reminders.every(isReminderLike) &&
    value.categories.every(isSyncRecordLike) &&
    value.completions.every(isSyncRecordLike)
  );
}

function isSyncRecordLike(value: unknown): boolean {
  return isRecord(value) && typeof value.id === 'string' && typeof value.updatedAt === 'string';
}

function isReminderLike(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.dueDate === 'string' &&
    isValidISODate(value.dueDate) &&
    typeof value.updatedAt === 'string'
  );
}

function isSettingsLike(value: unknown): value is Settings {
  return isRecord(value) && typeof value.lang === 'string';
}

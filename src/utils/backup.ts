import type { BackupFile } from '../repositories/types';
import { getRepositories } from '../repositories';
import { isValidISODate } from '../domain/date';
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
  a.click();
  URL.revokeObjectURL(url);
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
  await Promise.all([
    repos.categories.bulkPut(data.categories),
    repos.reminders.bulkPut(data.reminders),
    repos.completions.bulkPut(data.completions),
  ]);

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
    value.reminders.every(isReminderLike)
  );
}

function isReminderLike(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.dueDate === 'string' &&
    isValidISODate(value.dueDate)
  );
}

function isSettingsLike(value: unknown): value is Settings {
  return isRecord(value) && typeof value.lang === 'string';
}

import { openDatabase } from '../db/db';
import { DexieReminderRepository } from './dexieReminderRepository';
import { DexieCategoryRepository } from './dexieCategoryRepository';
import { DexieCompletionRepository } from './dexieCompletionRepository';
import type { CategoryRepository, CompletionRepository, ReminderRepository } from './types';

export type { ReminderRepository, CategoryRepository, CompletionRepository, SyncCapable, BackupFile } from './types';

export interface Repositories {
  reminders: ReminderRepository;
  categories: CategoryRepository;
  completions: CompletionRepository;
}

let reposPromise: Promise<Repositories> | null = null;

/** Composition root — the single place the Dexie adapters get wired up. */
export function getRepositories(): Promise<Repositories> {
  if (!reposPromise) {
    reposPromise = openDatabase().then((db) => ({
      reminders: new DexieReminderRepository(db),
      categories: new DexieCategoryRepository(db),
      completions: new DexieCompletionRepository(db),
    }));
  }
  return reposPromise;
}

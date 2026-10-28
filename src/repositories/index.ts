import { openDatabase } from '../db/db';
import { DexieReminderRepository } from './dexieReminderRepository';
import { DexieCategoryRepository } from './dexieCategoryRepository';
import { DexieCompletionRepository } from './dexieCompletionRepository';
import { requestSync } from '../sync/bus';
import type { CategoryRepository, CompletionRepository, ReminderRepository } from './types';

export type { ReminderRepository, CategoryRepository, CompletionRepository, SyncCapable, BackupFile } from './types';

export interface Repositories {
  reminders: ReminderRepository;
  categories: CategoryRepository;
  completions: CompletionRepository;
}

let reposPromise: Promise<Repositories> | null = null;

/**
 * Composition root — the single place the Dexie adapters get wired up.
 * Every MUTATING repository method also fires the debounced sync trigger,
 * so local changes reach the server no matter which screen made them.
 * Reads and the sync engine's own writes stay out of the way.
 */
export function getRepositories(): Promise<Repositories> {
  if (!reposPromise) {
    reposPromise = openDatabase().then((db) => {
      const reminders = new DexieReminderRepository(db);
      const categories = new DexieCategoryRepository(db);
      const completions = new DexieCompletionRepository(db);

      const remindersSynced: ReminderRepository = {
        list: (filter) => reminders.list(filter),
        get: (id) => reminders.get(id),
        create: async (draft) => {
          const reminder = await reminders.create(draft);
          requestSync();
          return reminder;
        },
        update: async (id, patch) => {
          const reminder = await reminders.update(id, patch);
          requestSync();
          return reminder;
        },
        softDelete: async (id) => {
          await reminders.softDelete(id);
          requestSync();
        },
        restore: async (id) => {
          await reminders.restore(id);
          requestSync();
        },
        complete: async (id, opts) => {
          const result = await reminders.complete(id, opts);
          requestSync();
          return result;
        },
        undoComplete: async (id) => {
          const reminder = await reminders.undoComplete(id);
          requestSync();
          return reminder;
        },
        completeOccurrence: async (id, dueDate, opts) => {
          const result = await reminders.completeOccurrence(id, dueDate, opts);
          requestSync();
          return result;
        },
        undoOccurrence: async (id, dueDate) => {
          const reminder = await reminders.undoOccurrence(id, dueDate);
          requestSync();
          return reminder;
        },
        togglePin: async (id) => {
          const reminder = await reminders.togglePin(id);
          requestSync();
          return reminder;
        },
        bulkPut: async (records) => {
          await reminders.bulkPut(records);
          requestSync();
        },
      };

      const categoriesSynced: CategoryRepository = {
        list: () => categories.list(),
        create: async (input) => {
          const category = await categories.create(input);
          requestSync();
          return category;
        },
        update: async (id, patch) => {
          const category = await categories.update(id, patch);
          requestSync();
          return category;
        },
        softDelete: async (id, reassignTo) => {
          await categories.softDelete(id, reassignTo);
          requestSync();
        },
        bulkPut: async (records) => {
          await categories.bulkPut(records);
          requestSync();
        },
      };

      const completionsSynced: CompletionRepository = {
        listByReminder: (reminderId) => completions.listByReminder(reminderId),
        listAll: () => completions.listAll(),
        bulkPut: async (records) => {
          await completions.bulkPut(records);
          requestSync();
        },
      };

      return {
        reminders: remindersSynced,
        categories: categoriesSynced,
        completions: completionsSynced,
      };
    });
  }
  return reposPromise;
}

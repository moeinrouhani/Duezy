import Dexie from 'dexie';
import type { Category, CompletionRecord, Reminder } from '../domain/types';
import { builtInCategories } from '../domain/defaults';

export class DuezyDB extends Dexie {
  reminders!: Dexie.Table<Reminder, string>;
  categories!: Dexie.Table<Category, string>;
  completions!: Dexie.Table<CompletionRecord, string>;

  constructor() {
    super('duezy');
    this.version(1).stores({
      // Only fields we query on get an index; everything else lives in the blob.
      reminders: 'id, dueDate, categoryId, updatedAt, deletedAt',
      categories: 'id, order',
      completions: 'id, reminderId, dueDateCompleted, completedAt',
    });
  }
}

let dbPromise: Promise<DuezyDB> | null = null;

/** Open (once) and seed built-in categories on first run. */
export function openDatabase(): Promise<DuezyDB> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = new DuezyDB();
      await db.open();
      if ((await db.categories.count()) === 0) {
        await db.categories.bulkPut(builtInCategories());
      }
      return db;
    })();
  }
  return dbPromise;
}

import type {
  Category,
  CompletionRecord,
  ISODate,
  Reminder,
  ReminderDraft,
  Settings,
  Timestamp,
} from '../domain/types';

/**
 * Persistence boundary. The UI only ever talks to these interfaces, so a
 * future remote/synced implementation can replace the Dexie adapters
 * without touching a single screen.
 */

export interface ReminderFilter {
  /** Exclude soft-deleted records (default true). */
  activeOnly?: boolean;
}

export interface ReminderRepository {
  list(filter?: ReminderFilter): Promise<Reminder[]>;
  get(id: string): Promise<Reminder | undefined>;
  create(draft: ReminderDraft): Promise<Reminder>;
  update(id: string, patch: Partial<Omit<ReminderDraft, 'id'>>): Promise<Reminder>;
  softDelete(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  /**
   * Settle the current occurrence: writes a CompletionRecord and either
   * advances `dueDate` to the next occurrence or marks the reminder done —
   * atomically in one transaction.
   */
  complete(id: string, opts?: { skipped?: boolean }): Promise<{
    reminder: Reminder;
    completion: CompletionRecord;
  }>;
  /** Reverse the latest completion (undo window). */
  undoComplete(id: string): Promise<Reminder>;
  /**
   * Settle a SPECIFIC occurrence by due date. When `dueDate` is the current
   * `dueDate` this behaves exactly like `complete` (advance the pointer or
   * finish the series); any other occurrence of a series just records the
   * completion. Idempotent on an already-settled date.
   */
  completeOccurrence(
    id: string,
    dueDate: ISODate,
    opts?: { skipped?: boolean },
  ): Promise<{ reminder: Reminder; completion: CompletionRecord }>;
  /** Un-settle a specific occurrence (tombstones its completion). */
  undoOccurrence(id: string, dueDate: ISODate): Promise<Reminder>;
  togglePin(id: string): Promise<Reminder>;
  /** Import path; last-write-wins on updatedAt. */
  bulkPut(records: Reminder[]): Promise<void>;
}

export interface CategoryRepository {
  list(): Promise<Category[]>;
  create(input: { name: string; icon: string; color: Category['color'] }): Promise<Category>;
  update(
    id: string,
    patch: Partial<Pick<Category, 'name' | 'icon' | 'color' | 'order'>>,
  ): Promise<Category>;
  /** Soft-delete; reminders are reassigned to `reassignTo` (a built-in id). */
  softDelete(id: string, reassignTo: string): Promise<void>;
  bulkPut(records: Category[]): Promise<void>;
}

export interface CompletionRepository {
  listByReminder(reminderId: string): Promise<CompletionRecord[]>;
  listAll(): Promise<CompletionRecord[]>;
  bulkPut(records: CompletionRecord[]): Promise<void>;
}

/** Optional capability implemented by adapters that can sync. */
export interface SyncCapable {
  pullChangesSince(since: Timestamp): Promise<{
    reminders: Reminder[];
    categories: Category[];
    completions: CompletionRecord[];
  }>;
  applyRemoteChanges(batch: {
    reminders: Reminder[];
    categories: Category[];
    completions: CompletionRecord[];
  }): Promise<void>;
}

export interface BackupFile {
  version: 1;
  exportedAt: Timestamp;
  app: 'duezy';
  settings: Settings;
  categories: Category[];
  reminders: Reminder[];
  completions: CompletionRecord[];
}

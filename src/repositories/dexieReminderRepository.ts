import type { DuezyDB } from '../db/db';
import type { Reminder, ReminderDraft, Timestamp } from '../domain/types';
import { nextOccurrence } from '../domain/recurrence';
import { createReminder } from '../domain/defaults';
import { newId } from '../utils/id';
import type { CompletionRecord } from '../domain/types';
import type { ReminderRepository } from './types';

export class DexieReminderRepository implements ReminderRepository {
  constructor(private readonly db: DuezyDB) {}

  async list(filter?: { activeOnly?: boolean }): Promise<Reminder[]> {
    const all = await this.db.reminders.toArray();
    const activeOnly = filter?.activeOnly ?? true;
    return activeOnly ? all.filter((r) => r.deletedAt === null) : all;
  }

  async get(id: string): Promise<Reminder | undefined> {
    return this.db.reminders.get(id);
  }

  async create(draft: ReminderDraft): Promise<Reminder> {
    const reminder = createReminder(draft);
    await this.db.reminders.put(reminder);
    return reminder;
  }

  async update(id: string, patch: Partial<Omit<ReminderDraft, 'id'>>): Promise<Reminder> {
    return this.db.transaction('rw', this.db.reminders, async () => {
      const current = await this.db.reminders.get(id);
      if (!current) throw new Error(`Reminder ${id} not found`);
      const updated: Reminder = {
        ...current,
        ...patch,
        // Editing a done one-time reminder brings it back to life.
        done: patch.dueDate ? false : current.done,
        updatedAt: new Date().toISOString(),
      };
      await this.db.reminders.put(updated);
      return updated;
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.stamp(id, { deletedAt: new Date().toISOString() });
  }

  async restore(id: string): Promise<void> {
    await this.stamp(id, { deletedAt: null });
  }

  async complete(
    id: string,
    opts?: { skipped?: boolean },
  ): Promise<{ reminder: Reminder; completion: CompletionRecord }> {
    const now: Timestamp = new Date().toISOString();
    return this.db.transaction('rw', this.db.reminders, this.db.completions, async () => {
      const reminder = await this.db.reminders.get(id);
      if (!reminder || reminder.deletedAt) throw new Error(`Reminder ${id} not found or deleted`);
      if (reminder.done) throw new Error(`Reminder ${id} is already done`);

      const completion: CompletionRecord = {
        id: newId(),
        reminderId: id,
        dueDateCompleted: reminder.dueDate,
        completedAt: now,
        skipped: opts?.skipped ?? false,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      await this.db.completions.put(completion);

      let updated: Reminder;
      const next = reminder.recurrence ? nextOccurrence(reminder.recurrence, reminder.dueDate) : null;
      if (next) {
        updated = { ...reminder, dueDate: next, updatedAt: now };
      } else {
        updated = { ...reminder, done: true, updatedAt: now };
      }
      await this.db.reminders.put(updated);
      return { reminder: updated, completion };
    });
  }

  async undoComplete(id: string): Promise<Reminder> {
    const now: Timestamp = new Date().toISOString();
    return this.db.transaction('rw', this.db.reminders, this.db.completions, async () => {
      const completions = await this.db.completions.where('reminderId').equals(id).toArray();
      const latest = completions
        .filter((c) => !c.deletedAt)
        .sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0];
      if (!latest) throw new Error(`No completion to undo for ${id}`);
      await this.db.completions.delete(latest.id);

      const reminder = await this.db.reminders.get(id);
      if (!reminder) throw new Error(`Reminder ${id} not found`);
      const restored: Reminder = {
        ...reminder,
        dueDate: latest.dueDateCompleted,
        done: false,
        updatedAt: now,
      };
      await this.db.reminders.put(restored);
      return restored;
    });
  }

  async togglePin(id: string): Promise<Reminder> {
    const reminder = await this.db.reminders.get(id);
    if (!reminder) throw new Error(`Reminder ${id} not found`);
    return this.updateRow(reminder, { pinned: !reminder.pinned });
  }

  async bulkPut(records: Reminder[]): Promise<void> {
    await this.db.reminders.bulkPut(records);
  }

  private async updateRow(current: Reminder, patch: Partial<Reminder>): Promise<Reminder> {
    const updated: Reminder = { ...current, ...patch, updatedAt: new Date().toISOString() };
    await this.db.reminders.put(updated);
    return updated;
  }

  private async stamp(id: string, patch: { deletedAt: string | null }): Promise<void> {
    const reminder = await this.db.reminders.get(id);
    if (!reminder) throw new Error(`Reminder ${id} not found`);
    await this.updateRow(reminder, patch);
  }
}

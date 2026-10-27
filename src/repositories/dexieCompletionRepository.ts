import type { DuezyDB } from '../db/db';
import type { CompletionRecord } from '../domain/types';
import type { CompletionRepository } from './types';

export class DexieCompletionRepository implements CompletionRepository {
  constructor(private readonly db: DuezyDB) {}

  async listByReminder(reminderId: string): Promise<CompletionRecord[]> {
    const rows = await this.db.completions.where('reminderId').equals(reminderId).toArray();
    return rows
      .filter((c) => c.deletedAt === null)
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  }

  async listAll(): Promise<CompletionRecord[]> {
    return this.db.completions.toArray();
  }

  async bulkPut(records: CompletionRecord[]): Promise<void> {
    await this.db.completions.bulkPut(records);
  }
}

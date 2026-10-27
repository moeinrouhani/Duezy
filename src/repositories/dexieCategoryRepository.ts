import type { DuezyDB } from '../db/db';
import type { Category } from '../domain/types';
import { newId } from '../utils/id';
import type { CategoryRepository } from './types';

export class DexieCategoryRepository implements CategoryRepository {
  constructor(private readonly db: DuezyDB) {}

  async list(): Promise<Category[]> {
    const all = await this.db.categories.toArray();
    return all.filter((c) => c.deletedAt === null).sort((a, b) => a.order - b.order);
  }

  async create(input: { name: string; icon: string; color: Category['color'] }): Promise<Category> {
    const all = await this.db.categories.toArray();
    const order = all.reduce((max, c) => Math.max(max, c.order), -1) + 1;
    const now = new Date().toISOString();
    const category: Category = {
      id: newId(),
      name: input.name,
      icon: input.icon,
      color: input.color,
      order,
      isBuiltIn: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await this.db.categories.put(category);
    return category;
  }

  async update(
    id: string,
    patch: Partial<Pick<Category, 'name' | 'icon' | 'color' | 'order'>>,
  ): Promise<Category> {
    const current = await this.db.categories.get(id);
    if (!current) throw new Error(`Category ${id} not found`);
    const updated: Category = { ...current, ...patch, updatedAt: new Date().toISOString() };
    await this.db.categories.put(updated);
    return updated;
  }

  async softDelete(id: string, reassignTo: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.transaction('rw', this.db.categories, this.db.reminders, async () => {
      const current = await this.db.categories.get(id);
      if (!current) throw new Error(`Category ${id} not found`);
      if (current.isBuiltIn) throw new Error('Built-in categories cannot be deleted');
      await this.db.categories.put({ ...current, deletedAt: now, updatedAt: now });

      const affected = await this.db.reminders.where('categoryId').equals(id).toArray();
      await this.db.reminders.bulkPut(
        affected.map((r) => ({ ...r, categoryId: reassignTo, updatedAt: now })),
      );
    });
  }

  async bulkPut(records: Category[]): Promise<void> {
    await this.db.categories.bulkPut(records);
  }
}

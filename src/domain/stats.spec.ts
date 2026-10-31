import { describe, expect, it } from 'vitest';
import type { CompletionRecord, Reminder } from './types';
import { computeStats } from './stats';
import { addDaysISO, todayISO } from './date';

function reminder(partial: Partial<Reminder>): Reminder {
  return {
    id: 'r1',
    title: 'Loan installment',
    dueDate: '2100-01-15',
    categoryId: 'cat-bills',
    recurrence: null,
    alerts: { offsets: [] },
    pinned: false,
    done: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    ...partial,
  };
}

function completionAt(daysAgo: number, partial: Partial<CompletionRecord> = {}): CompletionRecord {
  const day = addDaysISO(todayISO(), -daysAgo);
  return {
    id: `c${daysAgo}`,
    reminderId: 'r1',
    dueDateCompleted: day,
    completedAt: `${day}T10:00:00.000Z`,
    skipped: false,
    createdAt: `${day}T10:00:00.000Z`,
    updatedAt: `${day}T10:00:00.000Z`,
    deletedAt: null,
    ...partial,
  };
}

describe('domain/stats', () => {
  it('windows completions to the requested interval (default 30 days)', () => {
    const reminders = [reminder({})];
    const completions = [
      completionAt(2), // in every window
      completionAt(20), // in the 30- and 90-day windows
      completionAt(60), // only in the 90-day window
    ];
    expect(computeStats(reminders, completions, 7).completedTotal).toBe(1);
    expect(computeStats(reminders, completions, 30).completedTotal).toBe(2);
    expect(computeStats(reminders, completions, 90).completedTotal).toBe(3);
  });

  it('series length follows the window: daily ≤31 days, weekly beyond', () => {
    const reminders = [reminder({})];
    expect(computeStats(reminders, [], 7).series).toHaveLength(7);
    expect(computeStats(reminders, [], 30).series).toHaveLength(30);
    expect(computeStats(reminders, [], 90).series).toHaveLength(Math.ceil(90 / 7));
  });

  it('on-time rate and by-category are windowed too', () => {
    const reminders = [reminder({}), reminder({ id: 'r2', categoryId: 'cat-vehicle' })];
    const completions = [
      { ...completionAt(1), reminderId: 'r1' }, // on time
      { ...completionAt(40), reminderId: 'r2' }, // outside the 30-day window
    ];
    const stats = computeStats(reminders, completions, 30);
    expect(stats.completedTotal).toBe(1);
    expect(stats.onTimeRate).toBe(100);
    expect(stats.byCategory).toEqual([{ categoryId: 'cat-bills', count: 1 }]);
  });

  it('streak ignores the window — it reaches back past it', () => {
    const completions = [completionAt(0), completionAt(1), completionAt(2)];
    // The 2-day window sees two completions but the streak still reads 3.
    const stats = computeStats([reminder({})], completions, 2);
    expect(stats.completedTotal).toBe(2);
    expect(stats.streak).toBe(3);
  });

  it('tombstoned and skipped completions never count', () => {
    const completions = [
      completionAt(1, { deletedAt: todayISO() + 'T11:00:00.000Z' }),
      completionAt(2, { skipped: true }),
    ];
    const stats = computeStats([reminder({})], completions, 30);
    expect(stats.completedTotal).toBe(0);
    expect(stats.onTimeRate).toBeNull();
  });
});

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
  it('counts a due-but-unsettled reminder as missed, per window', () => {
    // The reported case: a reminder due 38 days ago, never settled.
    const past = reminder({ dueDate: addDaysISO(todayISO(), -38) });
    expect(computeStats([past], [], 7)).toMatchObject({ dueCount: 0, settledCount: 0, missedCount: 0 });
    expect(computeStats([past], [], 30)).toMatchObject({ dueCount: 0, missedCount: 0 });
    expect(computeStats([past], [], 90)).toMatchObject({ dueCount: 1, settledCount: 0, missedCount: 1 });
  });

  it('a settled occurrence counts as due + settled, not missed', () => {
    const day = addDaysISO(todayISO(), -3);
    const r = reminder({ dueDate: day });
    const completions = [{ ...completionAt(3), dueDateCompleted: day }];
    expect(computeStats([r], completions, 7)).toMatchObject({ dueCount: 1, settledCount: 1, missedCount: 0 });
  });

  it('completion-derived values are windowed (skips, on-time)', () => {
    const reminders = [reminder({})];
    const completions = [
      completionAt(2), // on time, in every window
      completionAt(60, { skipped: true }), // only in the 90-day window
    ];
    expect(computeStats(reminders, completions, 7)).toMatchObject({ skippedTotal: 0, onTimeRate: 100 });
    expect(computeStats(reminders, completions, 90)).toMatchObject({ skippedTotal: 1, onTimeRate: 100 });
  });

  it('series length follows the window: daily ≤31 days, weekly beyond', () => {
    const reminders = [reminder({})];
    expect(computeStats(reminders, [], 7).series).toHaveLength(7);
    expect(computeStats(reminders, [], 30).series).toHaveLength(30);
    expect(computeStats(reminders, [], 90).series).toHaveLength(Math.ceil(90 / 7));
  });

  it('on-time rate is computed over window completions', () => {
    const day = addDaysISO(todayISO(), -2);
    const completions = [
      { ...completionAt(2), dueDateCompleted: day }, // on time
      { ...completionAt(3), dueDateCompleted: addDaysISO(todayISO(), -5) }, // late
    ];
    const stats = computeStats([reminder({})], completions, 30);
    expect(stats.onTimeRate).toBe(50);
    // Chart buckets on the completion days: today-2 and today-3 have one each.
    expect(stats.series.at(-3)?.count).toBe(1);
    expect(stats.series.at(-4)?.count).toBe(1);
    expect(stats.series.at(-1)?.count).toBe(0);
    expect(stats.series.at(-2)?.count).toBe(0);
  });

  it('streak ignores the window — it reaches back past it', () => {
    const completions = [completionAt(0), completionAt(1), completionAt(2)];
    // The 2-day window sees two completions but the streak still reads 3.
    const stats = computeStats([reminder({})], completions, 2);
    expect(stats.streak).toBe(3);
  });

  it('tombstoned and skipped completions never count', () => {
    const completions = [
      completionAt(1, { deletedAt: todayISO() + 'T11:00:00.000Z' }),
      completionAt(2, { skipped: true }),
    ];
    const stats = computeStats([reminder({})], completions, 30);
    expect(stats.settledCount).toBe(0);
    expect(stats.skippedTotal).toBe(1);
    expect(stats.onTimeRate).toBeNull();
  });
});

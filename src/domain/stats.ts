import type { CompletionRecord, ISODate, Reminder } from './types';
import { addDaysISO, parseISODate, toISODate, todayISO } from './date';
import { daysUntil } from './date';

export interface StatsSummary {
  activeCount: number;
  overdueCount: number;
  completedTotal: number;
  onTimeTotal: number;
  lateTotal: number;
  skippedTotal: number;
  /** 0–100, or null when nothing completed yet. */
  onTimeRate: number | null;
  /** Consecutive days ending today (or yesterday) with ≥1 real completion. */
  streak: number;
  /** Last 30 days, oldest → newest. */
  last30: { date: ISODate; count: number }[];
  byCategory: { categoryId: string; count: number }[];
}

const DAY_MS = 86_400_000;

export function computeStats(
  reminders: Reminder[],
  completions: CompletionRecord[],
): StatsSummary {
  const active = reminders.filter((r) => !r.deletedAt && !r.done);
  const overdueCount = active.filter((r) => daysUntil(r.dueDate) < 0).length;

  const settled = completions.filter((c) => !c.deletedAt);
  const real = settled.filter((c) => !c.skipped);
  const onTimeTotal = real.filter((c) => c.completedAt.slice(0, 10) <= c.dueDateCompleted).length;
  const lateTotal = real.length - onTimeTotal;

  // Per-day completion counts for the last 30 days.
  const perDay = new Map<ISODate, number>();
  for (const c of real) {
    const day = c.completedAt.slice(0, 10);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  const today = todayISO();
  const todayMs = parseISODate(today).getTime();
  const last30 = Array.from({ length: 30 }, (_, i) => {
    const date = toISODate(new Date(todayMs - (29 - i) * DAY_MS));
    return { date, count: perDay.get(date) ?? 0 };
  });

  // Streak: walk back from today; allow starting at today or yesterday.
  let streak = 0;
  let cursor = perDay.has(today) ? today : addDaysISO(today, -1);
  while ((perDay.get(cursor) ?? 0) > 0) {
    streak++;
    cursor = addDaysISO(cursor, -1);
  }

  const byCategoryMap = new Map<string, number>();
  for (const c of real) {
    const reminder = reminders.find((r) => r.id === c.reminderId);
    if (!reminder) continue;
    byCategoryMap.set(reminder.categoryId, (byCategoryMap.get(reminder.categoryId) ?? 0) + 1);
  }

  return {
    activeCount: active.length,
    overdueCount,
    completedTotal: real.length,
    onTimeTotal,
    lateTotal,
    skippedTotal: settled.length - real.length,
    onTimeRate: real.length > 0 ? Math.round((onTimeTotal / real.length) * 100) : null,
    streak,
    last30,
    byCategory: [...byCategoryMap.entries()]
      .map(([categoryId, count]) => ({ categoryId, count }))
      .sort((a, b) => b.count - a.count),
  };
}

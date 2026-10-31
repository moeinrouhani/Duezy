import type { CompletionRecord, ISODate, Reminder, Timestamp } from './types';
import { addDaysISO, parseISODate, toISODate, todayISO } from './date';
import { daysUntil } from './date';

export interface StatsSummary {
  /** Current snapshot — not windowed. */
  activeCount: number;
  overdueCount: number;
  /** Within the window. */
  completedTotal: number;
  onTimeTotal: number;
  lateTotal: number;
  skippedTotal: number;
  /** 0–100 within the window, or null when nothing completed yet. */
  onTimeRate: number | null;
  /** Consecutive days ending today (or yesterday) with ≥1 real completion — not windowed. */
  streak: number;
  /** Completion buckets across the window, oldest → newest. */
  series: { date: ISODate; count: number }[];
  byCategory: { categoryId: string; count: number }[];
}

const DAY_MS = 86_400_000;

/**
 * Statistics over the LAST `days` days (default 30). Snapshot counts
 * (active/overdue) and the streak are inherently "now" values and stay
 * unwindowed; everything completion-based is filtered to the window.
 */
export function computeStats(
  reminders: Reminder[],
  completions: CompletionRecord[],
  days = 30,
): StatsSummary {
  const windowStart = addDaysISO(todayISO(), -(days - 1));
  const inWindow = (ts: Timestamp) => ts.slice(0, 10) >= windowStart;

  const active = reminders.filter((r) => !r.deletedAt && !r.done);
  const overdueCount = active.filter((r) => daysUntil(r.dueDate) < 0).length;

  const settled = completions.filter((c) => !c.deletedAt && inWindow(c.completedAt));
  const real = settled.filter((c) => !c.skipped);
  const onTimeTotal = real.filter((c) => c.completedAt.slice(0, 10) <= c.dueDateCompleted).length;
  const lateTotal = real.length - onTimeTotal;

  // Completion counts per calendar day (real completions only).
  const perDay = new Map<ISODate, number>();
  for (const c of completions) {
    if (c.deletedAt || c.skipped) continue;
    const day = c.completedAt.slice(0, 10);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }

  // Streak: walk back from today; allow starting at today or yesterday.
  const today = todayISO();
  let streak = 0;
  let cursor = perDay.has(today) ? today : addDaysISO(today, -1);
  while ((perDay.get(cursor) ?? 0) > 0) {
    streak++;
    cursor = addDaysISO(cursor, -1);
  }

  // Chart series across the window: daily while it fits, weekly beyond a month.
  const series: { date: ISODate; count: number }[] = [];
  if (days <= 31) {
    for (let i = 0; i < days; i++) {
      const date = addDaysISO(windowStart, i);
      series.push({ date, count: perDay.get(date) ?? 0 });
    }
  } else {
    const startMs = parseISODate(windowStart).getTime();
    const weeks = Math.ceil(days / 7);
    const buckets = new Array<number>(weeks).fill(0);
    for (const c of real) {
      const index = Math.floor((parseISODate(c.completedAt.slice(0, 10)).getTime() - startMs) / (7 * DAY_MS));
      if (index >= 0 && index < weeks) buckets[index]++;
    }
    for (let k = 0; k < weeks; k++) {
      series.push({ date: toISODate(new Date(startMs + k * 7 * DAY_MS)), count: buckets[k] });
    }
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
    series,
    byCategory: [...byCategoryMap.entries()]
      .map(([categoryId, count]) => ({ categoryId, count }))
      .sort((a, b) => b.count - a.count),
  };
}

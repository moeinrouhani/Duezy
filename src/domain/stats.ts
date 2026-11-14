import type { CompletionRecord, ISODate, Reminder } from './types';
import { addDaysISO, parseISODate, toISODate, todayISO } from './date';
import { occurrencesBetween } from './occurrences';

export interface StatsSummary {
  /** Occurrences due within the window (today included). */
  dueCount: number;
  /** Of those, settled (a completion exists, or a done one-time reminder). */
  settledCount: number;
  /** Due in the window on an earlier day and still unsettled. */
  missedCount: number;
  /** Skipped completions within the window. */
  skippedTotal: number;
  /** 0–100 of window completions made on/before their due date; null when none. */
  onTimeRate: number | null;
  /** Consecutive days ending today (or yesterday) with ≥1 real completion — not windowed. */
  streak: number;
  /** Completion buckets across the window, oldest → newest. */
  series: { date: ISODate; count: number }[];
  byCategory: { categoryId: string; count: number }[];
}

const DAY_MS = 86_400_000;

/**
 * The user's LOCAL calendar day of a stored timestamp. `completedAt` is a UTC
 * ISO string, so `slice(0, 10)` gave the UTC date — for anyone off UTC an
 * evening (or just-after-midnight) completion landed on the wrong day, which
 * skewed the on-time rate, the streak, the chart and the window edge.
 */
function localDay(timestamp: string): ISODate {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? timestamp.slice(0, 10) : toISODate(date);
}

/** Whole days between two ISO dates — rounded, so DST's 23/25-hour days don't skew it. */
function dayDiff(later: ISODate, earlier: ISODate): number {
  return Math.round((parseISODate(later).getTime() - parseISODate(earlier).getTime()) / DAY_MS);
}

/**
 * Statistics over the LAST `days` days (default 30), counted per OCCURRENCE:
 * a reminder due 38 days ago that was never settled shows up under "missed"
 * in a 90-day window and disappears from a 7-day one — the window drives the
 * numbers. The streak is inherently a "now" value and stays unwindowed.
 */
export function computeStats(
  reminders: Reminder[],
  completions: CompletionRecord[],
  days = 30,
): StatsSummary {
  const today = todayISO();
  const windowStart = addDaysISO(today, -(days - 1));

  // Every occurrence that came due in the window, settled or not.
  const occurrences = occurrencesBetween(reminders, completions, windowStart, today);
  const dueCount = occurrences.length;
  const settledCount = occurrences.filter((o) => o.checked).length;
  const missedCount = occurrences.filter((o) => !o.checked && o.date < today).length;

  // Windowed completions of reminders that still exist — the same population
  // the Due/Settled cards and the category bars use (a deleted reminder's
  // history used to leak into the on-time rate, skips and chart only).
  const liveIds = new Set(reminders.filter((r) => !r.deletedAt).map((r) => r.id));
  const settled = completions.filter(
    (c) => !c.deletedAt && liveIds.has(c.reminderId) && localDay(c.completedAt) >= windowStart,
  );
  const real = settled.filter((c) => !c.skipped);
  const onTimeTotal = real.filter((c) => localDay(c.completedAt) <= c.dueDateCompleted).length;

  // Real completions per local day. The streak is a habit measure, so it looks
  // at every completion ever made; the chart only at the window's population.
  const perDay = new Map<ISODate, number>();
  for (const c of completions) {
    if (c.deletedAt || c.skipped) continue;
    const day = localDay(c.completedAt);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  const perDayWindow = new Map<ISODate, number>();
  for (const c of real) {
    const day = localDay(c.completedAt);
    perDayWindow.set(day, (perDayWindow.get(day) ?? 0) + 1);
  }

  // Streak: walk back from today; allow starting at today or yesterday.
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
      series.push({ date, count: perDayWindow.get(date) ?? 0 });
    }
  } else {
    const weeks = Math.ceil(days / 7);
    const buckets = new Array<number>(weeks).fill(0);
    for (const c of real) {
      const index = Math.floor(dayDiff(localDay(c.completedAt), windowStart) / 7);
      if (index >= 0 && index < weeks) buckets[index]++;
    }
    for (let k = 0; k < weeks; k++) {
      series.push({ date: addDaysISO(windowStart, k * 7), count: buckets[k] });
    }
  }

  const byCategoryMap = new Map<string, number>();
  for (const c of real) {
    const reminder = reminders.find((r) => r.id === c.reminderId);
    if (!reminder) continue;
    byCategoryMap.set(reminder.categoryId, (byCategoryMap.get(reminder.categoryId) ?? 0) + 1);
  }

  return {
    dueCount,
    settledCount,
    missedCount,
    skippedTotal: settled.length - real.length,
    onTimeRate: real.length > 0 ? Math.round((onTimeTotal / real.length) * 100) : null,
    streak,
    series,
    byCategory: [...byCategoryMap.entries()]
      .map(([categoryId, count]) => ({ categoryId, count }))
      .sort((a, b) => b.count - a.count),
  };
}

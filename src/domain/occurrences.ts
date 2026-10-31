import type { CalendarSystem, CompletionRecord, ISODate, Reminder } from './types';
import { compareISO, parseISODate, toISODate, todayISO } from './date';
import { jalaliMonthLength, jalaliToISO, toJalali } from './jalali';
import { occurrencesInRange } from './recurrence';

/**
 * Occurrence model: a reminder expanded into its concrete due dates.
 *
 * The dashboard works per-occurrence (a 5-month payment shows 5 monthly
 * rows); the reminders screen works per-reminder. These helpers are the pure
 * core both views share.
 */

/** One concrete due date of a reminder, with its derived settlement state. */
export interface Occurrence {
  reminder: Reminder;
  date: ISODate;
  checked: boolean;
  overdue: boolean;
}

/** A `{year, month}` pair in the ACTIVE calendar system (month 1-based). */
export interface CalendarMonth {
  y: number;
  m: number;
}

export function calendarMonthOf(iso: ISODate, calendar: CalendarSystem): CalendarMonth {
  if (calendar === 'jalali') {
    const { jy, jm } = toJalali(iso);
    return { y: jy, m: jm };
  }
  const date = parseISODate(iso);
  return { y: date.getFullYear(), m: date.getMonth() + 1 };
}

/** First/last day of a month in the active calendar system, as ISO dates. */
export function calendarMonthRange(
  month: CalendarMonth,
  calendar: CalendarSystem,
): { start: ISODate; end: ISODate } {
  if (calendar === 'jalali') {
    return {
      start: jalaliToISO(month.y, month.m, 1),
      end: jalaliToISO(month.y, month.m, jalaliMonthLength(month.y, month.m)),
    };
  }
  return {
    start: toISODate(new Date(month.y, month.m - 1, 1)),
    end: toISODate(new Date(month.y, month.m, 0)),
  };
}

/** Shift by whole months in calendar-space (jalali years have 12 months too). */
export function addCalendarMonths(month: CalendarMonth, delta: number): CalendarMonth {
  const total = month.y * 12 + (month.m - 1) + delta;
  return { y: Math.floor(total / 12), m: ((total % 12) + 12) % 12 + 1 };
}

/**
 * Every occurrence falling within [start, end], oldest first.
 *
 * One-time reminders contribute their dueDate; recurring series are expanded
 * per the rule. An occurrence is checked when a live (non-tombstoned)
 * completion exists for that exact date — or, for one-time reminders, when
 * `done` is set (legacy rows may predate completions).
 */
export function occurrencesBetween(
  reminders: Reminder[],
  completions: CompletionRecord[],
  start: ISODate,
  end: ISODate,
): Occurrence[] {
  const doneKeys = new Set(
    completions
      .filter((c) => !c.deletedAt)
      .map((c) => `${c.reminderId}:${c.dueDateCompleted}`),
  );
  const today = todayISO();
  const out: Occurrence[] = [];

  for (const reminder of reminders) {
    if (reminder.deletedAt) continue;
    const dates = reminder.recurrence
      ? occurrencesInRange(reminder.recurrence, start, end).map((o) => o.date)
      : compareISO(reminder.dueDate, start) >= 0 && compareISO(reminder.dueDate, end) <= 0
        ? [reminder.dueDate]
        : [];
    for (const date of dates) {
      const checked =
        doneKeys.has(`${reminder.id}:${date}`) || (!reminder.recurrence && reminder.done);
      out.push({
        reminder,
        date,
        checked,
        overdue: !checked && compareISO(date, today) < 0,
      });
    }
  }
  return out.sort((a, b) => compareISO(a.date, b.date));
}

export interface MonthMoney {
  /** Undefined = reminders without an amount/currency. */
  currency?: string;
  total: number;
  paid: number;
  unpaid: number;
}

export interface MonthSummary {
  /** Occurrence count in the month. */
  count: number;
  paidCount: number;
  overdueCount: number;
  /** Amount sums grouped by currency ('' when a reminder sets no currency). */
  money: MonthMoney[];
}

/** Aggregate occurrences into the dashboard's month stats card. */
export function summarizeOccurrences(occurrences: Occurrence[]): MonthSummary {
  const byCurrency = new Map<string, MonthMoney>();
  let paidCount = 0;
  let overdueCount = 0;

  for (const o of occurrences) {
    if (o.checked) paidCount++;
    if (o.overdue) overdueCount++;
    if (o.reminder.amount !== undefined) {
      const key = o.reminder.currency ?? '';
      const bucket =
        byCurrency.get(key) ??
        ({ currency: o.reminder.currency, total: 0, paid: 0, unpaid: 0 } satisfies MonthMoney);
      bucket.total += o.reminder.amount;
      if (o.checked) bucket.paid += o.reminder.amount;
      else bucket.unpaid += o.reminder.amount;
      byCurrency.set(key, bucket);
    }
  }
  return { count: occurrences.length, paidCount, overdueCount, money: [...byCurrency.values()] };
}

/**
 * 0–1 progress across the reminder's bounded work; null when unbounded.
 * `completedCount` = live completions of the reminder (skips included —
 * they settle an occurrence just the same). Installments paid before
 * tracking began (Reminder.paidCount) count toward the total.
 */
export function reminderProgress(reminder: Reminder, completedCount: number): number | null {
  if (!reminder.recurrence) return reminder.done ? 1 : 0;
  const { end } = reminder.recurrence;
  const paid = reminder.paidCount ?? 0;
  if (end.type === 'after') {
    const total = Math.max(end.count + paid, 1);
    return Math.min((completedCount + paid) / total, 1);
  }
  if (end.type === 'on') {
    const total = occurrencesInRange(reminder.recurrence, reminder.recurrence.start, end.date).length;
    return total > 0 ? Math.min(completedCount / total, 1) : null;
  }
  return null; // never-ending series
}

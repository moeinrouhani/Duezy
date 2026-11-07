import { addDays, addMonths, addYears, differenceInCalendarDays } from 'date-fns';
import type { ISODate, RecurrenceRule, Weekday } from './types';
import { addDaysISO, compareISO, parseISODate, toISODate } from './date';
import { addJalaliMonths, addJalaliYears, toJalali } from './jalali';

/** Hard cap so a corrupt rule can never hang the app. */
const MAX_WALK = 20_000;

/**
 * One step forward in the series from `iso` (no end checks).
 * `iso` is assumed to be a series occurrence (dueDate always is).
 */
export function stepOccurrence(rule: RecurrenceRule, iso: ISODate): ISODate {
  switch (rule.freq) {
    case 'daily':
      return addDaysISO(iso, rule.interval);
    case 'weekly':
      return stepWeekly(rule, iso);
    // Month/year steps are measured from the immutable series anchor, never
    // chained from the previous (possibly clamped) date — chaining made a
    // bill on the 31st fall to the 28th in February and STAY there
    // (31 → 28 → 28 → 28 …). Anchored, it returns to the 31st in March.
    case 'monthly': {
      const offset = unitsBetween(rule, iso, 'monthly') + rule.interval;
      return rule.calendar === 'jalali'
        ? addJalaliMonths(rule.start, offset)
        : toISODate(addMonths(parseISODate(rule.start), offset));
    }
    case 'yearly': {
      const offset = unitsBetween(rule, iso, 'yearly') + rule.interval;
      return rule.calendar === 'jalali'
        ? addJalaliYears(rule.start, offset)
        : toISODate(addYears(parseISODate(rule.start), offset));
    }
  }
}

/** Whole months/years from the series anchor to `iso`, in the rule's calendar. */
function unitsBetween(rule: RecurrenceRule, iso: ISODate, unit: 'monthly' | 'yearly'): number {
  const parts = (value: ISODate) => {
    if (rule.calendar === 'jalali') {
      const { jy, jm } = toJalali(value);
      return { y: jy, m: jm };
    }
    const date = parseISODate(value);
    return { y: date.getFullYear(), m: date.getMonth() + 1 };
  };
  const a = parts(rule.start);
  const b = parts(iso);
  return unit === 'yearly' ? b.y - a.y : (b.y - a.y) * 12 + (b.m - a.m);
}

function stepWeekly(rule: RecurrenceRule, iso: ISODate): ISODate {
  const days = rule.byWeekday ?? [];
  if (days.length === 0) return addDaysISO(iso, 7 * rule.interval);

  // Next calendar day strictly after `iso` matching the weekday set…
  let candidate = parseISODate(iso);
  for (let i = 0; i < 7; i++) {
    candidate = addDays(candidate, 1);
    if (days.includes(candidate.getDay() as Weekday)) break;
  }
  // …then advance whole weeks until the interval (weeks since anchor) aligns.
  let guard = 0;
  while (!onIntervalWeek(rule, toISODate(candidate))) {
    candidate = addDays(candidate, 7);
    if (++guard > MAX_WALK) return addDaysISO(iso, 7 * rule.interval);
  }
  return toISODate(candidate);
}

function onIntervalWeek(rule: RecurrenceRule, iso: ISODate): boolean {
  if (rule.interval <= 1) return true;
  // Calendar-day difference, not milliseconds: a DST change makes a local
  // week 6d23h long, and flooring that dropped the week count by one.
  const weeks = Math.floor(differenceInCalendarDays(parseISODate(iso), parseISODate(rule.start)) / 7);
  return weeks >= 0 && weeks % rule.interval === 0;
}

/**
 * Next occurrence strictly after `fromISO`, or null when the series has ended
 * (`end.on` inclusive boundary; `end.after` counts occurrences from `start`).
 */
export function nextOccurrence(rule: RecurrenceRule, fromISO: ISODate): ISODate | null {
  const candidate = stepOccurrence(rule, fromISO);

  if (rule.end.type === 'on' && compareISO(candidate, rule.end.date) > 0) return null;

  if (rule.end.type === 'after') {
    let current = rule.start;
    let index = 1;
    while (compareISO(current, candidate) < 0) {
      current = stepOccurrence(rule, current);
      index++;
      if (index > MAX_WALK) return null;
    }
    if (current !== candidate) return null; // walked past candidate → off-series
    if (index > rule.end.count) return null;
  }

  return candidate;
}

/** True when completing `dueDate` ends the series (or the reminder is one-time). */
export function isSeriesExhausted(rule: RecurrenceRule, dueDate: ISODate): boolean {
  return nextOccurrence(rule, dueDate) === null;
}

/** Next N occurrences (empty when the series ends earlier). */
export function upcomingOccurrences(
  rule: RecurrenceRule,
  fromISO: ISODate,
  n: number,
): ISODate[] {
  const result: ISODate[] = [];
  let cursor = fromISO;
  for (let i = 0; i < n; i++) {
    const next = nextOccurrence(rule, cursor);
    if (!next) break;
    result.push(next);
    cursor = next;
  }
  return result;
}

/**
 * Every series occurrence within [rangeStart, rangeEnd], oldest first, with
 * its 1-based index (`start` is occurrence #1 — same convention as
 * nextOccurrence/end.after). Honors `end.on` / `end.after` boundaries.
 */
export function occurrencesInRange(
  rule: RecurrenceRule,
  rangeStart: ISODate,
  rangeEnd: ISODate,
): { date: ISODate; index: number }[] {
  const out: { date: ISODate; index: number }[] = [];
  let cursor = rule.start;
  let index = 1;
  while (compareISO(cursor, rangeEnd) <= 0 && index <= MAX_WALK) {
    if (rule.end.type === 'on' && compareISO(cursor, rule.end.date) > 0) break;
    if (rule.end.type === 'after' && index > rule.end.count) break;
    if (compareISO(cursor, rangeStart) >= 0) out.push({ date: cursor, index });
    cursor = stepOccurrence(rule, cursor);
    index++;
  }
  return out;
}

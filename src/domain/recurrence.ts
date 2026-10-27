import { addDays, addMonths, addYears } from 'date-fns';
import type { ISODate, RecurrenceRule, Weekday } from './types';
import { addDaysISO, compareISO, parseISODate, toISODate } from './date';
import { addJalaliMonths, addJalaliYears } from './jalali';

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
    case 'monthly':
      return rule.calendar === 'jalali'
        ? addJalaliMonths(iso, rule.interval)
        : toISODate(addMonths(parseISODate(iso), rule.interval));
    case 'yearly':
      return rule.calendar === 'jalali'
        ? addJalaliYears(iso, rule.interval)
        : toISODate(addYears(parseISODate(iso), rule.interval));
  }
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
  const weeks = Math.floor(
    (parseISODate(iso).getTime() - parseISODate(rule.start).getTime()) / (7 * 86_400_000),
  );
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

import { addDays, differenceInCalendarDays, format, parseISO, startOfToday } from 'date-fns';
import type { ISODate } from './types';

/**
 * Single entry point for ISO-date parsing. `new Date('YYYY-MM-DD')` parses as
 * UTC midnight and shifts days for negative-UTC users — never use it directly.
 */
export function parseISODate(iso: ISODate): Date {
  return parseISO(iso); // local midnight
}

export function toISODate(date: Date): ISODate {
  return format(date, 'yyyy-MM-dd');
}

export function todayISO(): ISODate {
  return toISODate(new Date());
}

export function addDaysISO(iso: ISODate, amount: number): ISODate {
  return toISODate(addDays(parseISODate(iso), amount));
}

/** Positive = future, 0 = today, negative = past. */
export function daysUntil(iso: ISODate): number {
  return differenceInCalendarDays(parseISODate(iso), startOfToday());
}

/** ISO dates compare correctly as plain strings. */
export function compareISO(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function isValidISODate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1) return false;
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** Combine a local date with 'HH:mm' into a Date. */
export function dateAtTime(iso: ISODate, time: string): Date {
  const [h, m] = time.split(':').map(Number);
  const date = parseISODate(iso);
  date.setHours(h || 0, m || 0, 0, 0);
  return date;
}

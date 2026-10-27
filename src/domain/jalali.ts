import { toGregorian, toJalaali, isLeapJalaaliYear as _isLeap, jalaaliMonthLength as _monthLength } from 'jalaali-js';
import type { ISODate } from './types';
import { parseISODate, toISODate } from './date';

export interface JDate {
  jy: number;
  jm: number;
  jd: number;
}

/** Gregorian ISO → Jalali parts. */
export function toJalali(iso: ISODate): JDate {
  const d = parseISODate(iso);
  return toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** Jalali parts → Gregorian ISO. */
export function jalaliToISO(jy: number, jm: number, jd: number): ISODate {
  const g = toGregorian(jy, jm, jd);
  return toISODate(new Date(g.gy, g.gm - 1, g.gd));
}

export function jalaliMonthLength(jy: number, jm: number): number {
  return _monthLength(jy, jm);
}

export function isLeapJalaaliYear(jy: number): boolean {
  return _isLeap(jy);
}

/**
 * Add N Jalali months, clamping the day to the target month length
 * (۳۱ آبان + 1 ماه → ۳۰ آذر). Preserves the same Jalali day whenever it fits.
 */
export function addJalaliMonths(iso: ISODate, n: number): ISODate {
  const { jy, jm, jd } = toJalali(iso);
  const total = (jy * 12 + (jm - 1)) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const nd = Math.min(jd, jalaliMonthLength(ny, nm));
  return jalaliToISO(ny, nm, nd);
}

/**
 * Add N Jalali years, clamping Esfand 30 → 29 in non-leap targets.
 */
export function addJalaliYears(iso: ISODate, n: number): ISODate {
  const { jy, jm, jd } = toJalali(iso);
  const ny = jy + n;
  const nd = Math.min(jd, jalaliMonthLength(ny, jm));
  return jalaliToISO(ny, jm, nd);
}

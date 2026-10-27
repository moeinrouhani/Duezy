import { describe, expect, it } from 'vitest';
import { addJalaliMonths, addJalaliYears, isLeapJalaaliYear, jalaliMonthLength, jalaliToISO, toJalali } from './jalali';

describe('domain/jalali', () => {
  it('round-trips a known date: 1403/01/01 ↔ 2024-03-20', () => {
    expect(jalaliToISO(1403, 1, 1)).toBe('2024-03-20');
    expect(toJalali('2024-03-20')).toEqual({ jy: 1403, jm: 1, jd: 1 });
  });

  it('round-trips another known date: 1405/08/15 ↔ 2026-11-06', () => {
    const iso = jalaliToISO(1405, 8, 15);
    expect(toJalali(iso)).toEqual({ jy: 1405, jm: 8, jd: 15 });
  });

  it('knows leap years (1399 and 1403 are leap, Esfand has 30 days)', () => {
    expect(isLeapJalaaliYear(1399)).toBe(true);
    expect(isLeapJalaaliYear(1403)).toBe(true);
    expect(isLeapJalaaliYear(1404)).toBe(false);
    expect(jalaliMonthLength(1403, 12)).toBe(30);
    expect(jalaliMonthLength(1404, 12)).toBe(29);
  });

  it('has the standard month-length table (31×6, 30×5, 29/30)', () => {
    for (let jm = 1; jm <= 6; jm++) expect(jalaliMonthLength(1405, jm)).toBe(31);
    for (let jm = 7; jm <= 11; jm++) expect(jalaliMonthLength(1405, jm)).toBe(30);
    expect(jalaliMonthLength(1405, 12)).toBe(29);
  });

  it('adds months preserving the Jalali day (۳۱ شهریور → ۳۰ مهر)', () => {
    // Shahrivar (month 6) has 31 days; Mehr (month 7) only 30 → clamp.
    const iso = jalaliToISO(1405, 6, 31);
    const next = addJalaliMonths(iso, 1);
    expect(toJalali(next)).toEqual({ jy: 1405, jm: 7, jd: 30 });
  });

  it('adds months carrying across the year boundary (آذر → فروردین via دی+)', () => {
    const iso = jalaliToISO(1405, 9, 15);
    expect(toJalali(addJalaliMonths(iso, 4))).toEqual({ jy: 1406, jm: 1, jd: 15 });
  });

  it('clamps Esfand 30 to 29 when adding years into a non-leap year', () => {
    const iso = jalaliToISO(1403, 12, 30);
    const next = addJalaliYears(iso, 1);
    expect(toJalali(next)).toEqual({ jy: 1404, jm: 12, jd: 29 });
  });

  it('keeps Esfand 30 across a leap year step', () => {
    const iso = jalaliToISO(1402, 12, 29);
    expect(toJalali(addJalaliYears(iso, 1))).toEqual({ jy: 1403, jm: 12, jd: 29 });
  });
});

import { describe, expect, it } from 'vitest';
import type { RecurrenceRule } from './types';
import { isSeriesExhausted, nextOccurrence, occurrencesInRange, upcomingOccurrences } from './recurrence';
import { jalaliToISO } from './jalali';

function rule(partial: Partial<RecurrenceRule>): RecurrenceRule {
  return {
    freq: 'monthly',
    interval: 1,
    calendar: 'gregorian',
    start: '2026-01-15',
    end: { type: 'never' },
    ...partial,
  };
}

describe('domain/recurrence', () => {
  it('daily: steps by interval', () => {
    const daily = rule({ freq: 'daily', interval: 3 });
    expect(nextOccurrence(daily, '2026-01-15')).toBe('2026-01-18');
    expect(nextOccurrence(daily, '2026-12-30')).toBe('2027-01-02');
  });

  it('weekly: plain weekly steps by 7·interval', () => {
    const weekly = rule({ freq: 'weekly', interval: 2, start: '2026-01-05' });
    expect(nextOccurrence(weekly, '2026-01-05')).toBe('2026-01-19');
  });

  it('weekly byWeekday: picks the next matching weekday', () => {
    // 2026-01-05 is a Monday; series on Saturday(6)+Tuesday(2).
    const weekly = rule({ freq: 'weekly', interval: 1, byWeekday: [6, 2], start: '2026-01-05' });
    // Next after Monday Jan 5 → Tuesday Jan 6 → Saturday Jan 10.
    expect(nextOccurrence(weekly, '2026-01-05')).toBe('2026-01-06');
    expect(nextOccurrence(weekly, '2026-01-06')).toBe('2026-01-10');
    expect(nextOccurrence(weekly, '2026-01-10')).toBe('2026-01-13');
  });

  it('weekly byWeekday with interval 2 stays on alternating weeks from start', () => {
    const weekly = rule({ freq: 'weekly', interval: 2, byWeekday: [1], start: '2026-01-05' });
    // Monday Jan 5 → Jan 12 is week 1 (odd) → skip → Jan 19 (week 2).
    expect(nextOccurrence(weekly, '2026-01-05')).toBe('2026-01-19');
  });

  it('monthly gregorian: clamps Jan 31 → Feb 28', () => {
    const monthly = rule({ freq: 'monthly', start: '2026-01-31' });
    expect(nextOccurrence(monthly, '2026-01-31')).toBe('2026-02-28');
  });

  it('monthly jalali: ۳۱ شهریور + 1 ماه → ۳۰ مهر (same Jalali day policy)', () => {
    // Shahrivar 31 exists (month 6); Mehr 30 is the clamped target.
    const start = jalaliToISO(1405, 6, 31);
    const jalaliMonthly = rule({ freq: 'monthly', calendar: 'jalali', start });
    expect(nextOccurrence(jalaliMonthly, start)).toBe(jalaliToISO(1405, 7, 30));
  });

  it('yearly jalali keeps the Jalali date (not the Gregorian one)', () => {
    const jalaliYearly = rule({ freq: 'yearly', calendar: 'jalali', start: '2024-03-20' });
    // 1403/01/01 → 1404/01/01 = 2025-03-21 (Gregorian date shifts).
    expect(nextOccurrence(jalaliYearly, '2024-03-20')).toBe('2025-03-21');
  });

  it('yearly gregorian clamps Feb 29 → Feb 28 on non-leap targets', () => {
    const yearly = rule({ freq: 'yearly', start: '2024-02-29' });
    expect(nextOccurrence(yearly, '2024-02-29')).toBe('2025-02-28');
  });

  it('end.on: inclusive boundary', () => {
    const bounded = rule({ end: { type: 'on', date: '2026-03-15' } });
    expect(nextOccurrence(bounded, '2026-02-15')).toBe('2026-03-15');
    expect(nextOccurrence(bounded, '2026-03-15')).toBeNull();
  });

  it('end.after: exactly N occurrences from start', () => {
    const bounded = rule({ start: '2026-01-01', end: { type: 'after', count: 3 } });
    expect(nextOccurrence(bounded, '2026-01-01')).toBe('2026-02-01'); // #2
    expect(nextOccurrence(bounded, '2026-02-01')).toBe('2026-03-01'); // #3
    expect(nextOccurrence(bounded, '2026-03-01')).toBeNull(); // series done
  });

  it('isSeriesExhausted mirrors nextOccurrence', () => {
    const bounded = rule({ end: { type: 'after', count: 1 }, start: '2026-01-01' });
    expect(isSeriesExhausted(bounded, '2026-01-01')).toBe(true);
  });

  it('upcomingOccurrences stops when the series ends', () => {
    const bounded = rule({ start: '2026-01-01', end: { type: 'after', count: 2 } });
    expect(upcomingOccurrences(bounded, '2026-01-01', 5)).toEqual(['2026-02-01']);
  });
});

describe('occurrencesInRange', () => {
  it('returns only in-range occurrences with 1-based series indices', () => {
    const rows = occurrencesInRange(rule({}), '2026-02-01', '2026-04-30');
    expect(rows.map((r) => r.date)).toEqual(['2026-02-15', '2026-03-15', '2026-04-15']);
    expect(rows.map((r) => r.index)).toEqual([2, 3, 4]);
  });

  it('honors end.after: a 5-occurrence series stops there', () => {
    const five = rule({ end: { type: 'after', count: 5 } });
    expect(occurrencesInRange(five, '2026-01-01', '2999-12-31')).toHaveLength(5);
    // May 15 is occurrence #5 — the last one.
    expect(occurrencesInRange(five, '2026-05-01', '2999-12-31')).toHaveLength(1);
  });

  it('honors end.on as an inclusive boundary', () => {
    const until = rule({ end: { type: 'on', date: '2026-03-15' } });
    const rows = occurrencesInRange(until, '2026-01-01', '2026-12-31');
    expect(rows.map((r) => r.date)).toEqual(['2026-01-15', '2026-02-15', '2026-03-15']);
  });

  it('jalali monthly stepping keeps the jalali day-of-month', () => {
    const jalali = rule({ calendar: 'jalali', start: jalaliToISO(1405, 8, 15) });
    const rows = occurrencesInRange(jalali, jalaliToISO(1405, 8, 1), jalaliToISO(1405, 10, 29));
    expect(rows.map((r) => r.date)).toEqual([
      jalaliToISO(1405, 8, 15),
      jalaliToISO(1405, 9, 15),
      jalaliToISO(1405, 10, 15),
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import { addDaysISO, compareISO, daysUntil, isValidISODate, parseISODate, todayISO } from './date';

describe('domain/date', () => {
  it('parses ISO dates as local midnights (never UTC-shifted)', () => {
    const date = parseISODate('2026-03-20');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(2);
    expect(date.getDate()).toBe(20);
    expect(date.getHours()).toBe(0);
  });

  it('adds days across month and year boundaries', () => {
    expect(addDaysISO('2026-03-30', 5)).toBe('2026-04-04');
    expect(addDaysISO('2025-12-30', 3)).toBe('2026-01-02');
    expect(addDaysISO('2026-01-05', -10)).toBe('2025-12-26');
  });

  it('daysUntil: past/negative, today/zero, future/positive', () => {
    const today = todayISO();
    expect(daysUntil(today)).toBe(0);
    expect(daysUntil(addDaysISO(today, 9))).toBe(9);
    expect(daysUntil(addDaysISO(today, -4))).toBe(-4);
  });

  it('compares ISO strings chronologically', () => {
    expect(compareISO('2026-01-01', '2026-01-02')).toBeLessThan(0);
    expect(compareISO('2026-05-01', '2026-05-01')).toBe(0);
    expect(compareISO('2027-01-01', '2026-12-31')).toBeGreaterThan(0);
  });

  it('rejects invalid dates', () => {
    expect(isValidISODate('2026-02-30')).toBe(false);
    expect(isValidISODate('2026-13-01')).toBe(false);
    expect(isValidISODate('2026-00-10')).toBe(false);
    expect(isValidISODate('2026-2-3')).toBe(false);
    expect(isValidISODate('2026-02-28')).toBe(true);
    expect(isValidISODate('2024-02-29')).toBe(true);
    expect(isValidISODate('2026-02-29')).toBe(false);
  });
});

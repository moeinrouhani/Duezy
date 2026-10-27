import { describe, expect, it } from 'vitest';
import en from './locales/en.json';
import fa from './locales/fa.json';

/** Normalize plural suffixes so en (_one/_other) and fa (_other) can compare. */
function normalizeKeys(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) return value.flatMap((item, i) => normalizeKeys(item, `${prefix}.${i}`));
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, child]) => normalizeKeys(child, `${prefix}.${key}`));
  }
  return [prefix.replace(/_(one|two|few|many|other)$/, '')];
}

describe('locales', () => {
  it('en and fa expose identical key trees (modulo plural suffixes)', () => {
    // Dedupe: en carries _one+_other variants that normalize to one key.
    const enKeys = [...new Set(normalizeKeys(en))].sort();
    const faKeys = [...new Set(normalizeKeys(fa))].sort();
    expect(faKeys).toEqual(enKeys);
  });

  it('month arrays have 12 entries in both calendars and languages', () => {
    for (const locale of [en, fa]) {
      expect(locale.months.jalali).toHaveLength(12);
      expect(locale.months.gregorian).toHaveLength(12);
      expect(locale.weekdays.short).toHaveLength(7);
      expect(locale.weekdays.full).toHaveLength(7);
    }
  });
});

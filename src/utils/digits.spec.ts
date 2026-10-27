import { describe, expect, it } from 'vitest';
import { formatNumber, parseAmount, toFaDigits, toLatinDigits } from './digits';

describe('utils/digits', () => {
  it('maps digits both directions', () => {
    expect(toFaDigits('1405/08/15')).toBe('۱۴۰۵/۰۸/۱۵');
    expect(toLatinDigits('۱۴۰۵/۰۸/۱۵')).toBe('1405/08/15');
  });

  it('formats numbers with grouping, localized per language', () => {
    expect(formatNumber(1234567, 'en')).toBe('1,234,567');
    expect(formatNumber(1234567, 'fa')).toBe('۱٬۲۳۴٬۵۶۷');
    expect(formatNumber(0, 'fa')).toBe('۰');
    expect(formatNumber(-2500, 'en')).toBe('-2,500');
  });

  it('parses amounts typed in either digit system', () => {
    expect(parseAmount('۲٬۵۰۰٬۰۰۰')).toBe(2500000);
    expect(parseAmount('1,250.5')).toBe(1250.5);
    expect(parseAmount('abc')).toBeUndefined();
    expect(parseAmount('')).toBeUndefined();
  });
});

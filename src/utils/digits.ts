import type { Lang } from '../domain/types';

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toFaDigits(input: string): string {
  return input.replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

export function toLatinDigits(input: string): string {
  return input.replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)));
}

/** Group thousands, then localize digits. 1234567 → '۱٬۲۳۴٬۵۶۷' / '1,234,567'. */
export function formatNumber(value: number, lang: Lang): string {
  const grouped = Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (lang !== 'fa') return grouped;
  return toFaDigits(grouped).replace(/,/g, '٬');
}

/**
 * Localized year — never thousands-grouped. Years are identifiers, not
 * quantities: ۱۴۰۵, not ۱٬۴۰۵.
 */
export function formatYear(value: number, lang: Lang): string {
  return lang === 'fa' ? toFaDigits(String(value)) : String(value);
}

/** Localized number from an arbitrary string/number (i18n interpolation hook). */
export function localizeNumeric(value: string | number, lang: Lang): string {
  if (typeof value === 'number') return formatNumber(value, lang);
  return lang === 'fa' ? toFaDigits(value) : value;
}

/** Parse user-typed amounts in either digit system. */
export function parseAmount(input: string): number | undefined {
  const cleaned = toLatinDigits(input).replace(/[^\d.]/g, '');
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Format an amount AS THE USER TYPES: digits only, thousands-grouped and
 * localized ('2500000' → '2,500,000' / '۲٬۵۰۰٬۰۰۰'). parseAmount still reads
 * the grouped text back, so storage is unaffected.
 */
export function formatAmountInput(text: string, lang: Lang): string {
  const latin = toLatinDigits(text).replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '');
  if (!latin) return '';
  const grouped = latin.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return lang === 'fa' ? toFaDigits(grouped).replace(/,/g, '٬') : grouped;
}

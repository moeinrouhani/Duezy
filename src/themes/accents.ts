import type { AccentColor } from '../domain/types';

/** Picker model for Settings → accent color. */
export const ACCENTS: { id: AccentColor; swatch: string }[] = [
  { id: 'teal', swatch: '#0d9488' },
  { id: 'emerald', swatch: '#059669' },
  { id: 'blue', swatch: '#2563eb' },
  { id: 'violet', swatch: '#7c3aed' },
  { id: 'rose', swatch: '#e11d48' },
  { id: 'amber', swatch: '#d97706' },
];

/** Fixed hex per accent — category chips keep their color under any theme. */
export const CATEGORY_COLOR_HEX: Record<AccentColor, string> = {
  teal: '#0d9488',
  emerald: '#059669',
  blue: '#2563eb',
  violet: '#7c3aed',
  rose: '#e11d48',
  amber: '#d97706',
};

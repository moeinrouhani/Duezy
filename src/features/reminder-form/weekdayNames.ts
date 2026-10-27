import type { TFunction } from 'i18next';

/** Localized weekday names indexed by Date#getDay (0 = Sunday). */
export function weekdayNames(t: TFunction): string[] {
  return t('weekdays.full', { returnObjects: true }) as string[];
}

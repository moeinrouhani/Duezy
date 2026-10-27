import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../stores/settingsStore';
import type { CalendarSystem, ISODate, Lang, Weekday } from '../domain/types';
import { daysUntil, parseISODate } from '../domain/date';
import { toJalali } from '../domain/jalali';
import { formatNumber } from '../utils/digits';

export interface LocalDateFormatter {
  /** '۱۵ آبان ۱۴۰۵' / '15 Aban 1405' / '۱۵ ژانویه ۲۰۲۶' / '15 January 2026' */
  formatDate(iso: ISODate): string;
  /** With weekday: 'پنجشنبه ۱۵ آبان ۱۴۰۵' */
  formatDateLong(iso: ISODate): string;
  /** Day number inside a month grid, localized digits. */
  dayNumber(day: number): string;
  /** 'آبان ۱۴۰۵' style label for month navigation. */
  monthYearLabel(year: number, month1based: number): string;
  /** today / tomorrow / in N days / N days overdue. */
  relative(iso: ISODate): string;
}

export function useLocalDate(): LocalDateFormatter {
  const { t, i18n } = useTranslation();
  const calendar = useSettingsStore((s) => s.settings.calendar);
  const lang = (i18n.language === 'en' ? 'en' : 'fa') as Lang;

  return useMemo(() => {
    const jalaliMonths = t('months.jalali', { returnObjects: true }) as string[];
    const gregorianMonths = t('months.gregorian', { returnObjects: true }) as string[];
    const weekdays = t('weekdays.full', { returnObjects: true }) as string[];

    const monthName = (calendarSystem: CalendarSystem, month1based: number) =>
      calendarSystem === 'jalali' ? jalaliMonths[month1based - 1] : gregorianMonths[month1based - 1];

    const parts = (iso: ISODate) => {
      const date = parseISODate(iso);
      if (calendar === 'jalali') {
        const { jy, jm, jd } = toJalali(iso);
        return { day: jd, month: jm, year: jy, weekday: date.getDay(), system: 'jalali' as const };
      }
      return {
        day: date.getDate(),
        month: date.getMonth() + 1,
        year: date.getFullYear(),
        weekday: date.getDay(),
        system: 'gregorian' as const,
      };
    };

    const fmt = (iso: ISODate): string => {
      const p = parts(iso);
      return formatNumber(p.day, lang) + ' ' + monthName(p.system, p.month) + ' ' + formatNumber(p.year, lang);
    };

    return {
      formatDate: fmt,
      formatDateLong: (iso) => {
        const p = parts(iso);
        return `${weekdays[p.weekday]} ${fmt(iso)}`;
      },
      dayNumber: (day) => formatNumber(day, lang),
      monthYearLabel: (year, month1based) =>
        `${monthName(calendar, month1based)} ${formatNumber(year, lang)}`,
      relative: (iso) => {
        const n = daysUntil(iso);
        if (n === 0) return t('common.today');
        if (n === 1) return t('common.tomorrow');
        if (n === -1) return t('common.yesterday');
        if (n > 1) return t('common.inDays', { count: n });
        return t('common.daysOverdue', { count: -n });
      },
    };
  }, [calendar, lang, t]);
}

/** Ordered weekday indices for a grid header given the week-start setting. */
export function weekdayOrder(weekStart: Weekday): Weekday[] {
  return Array.from({ length: 7 }, (_, i) => (weekStart + i) % 7) as Weekday[];
}

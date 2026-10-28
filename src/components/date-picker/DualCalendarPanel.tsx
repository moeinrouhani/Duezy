import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ISODate, Weekday } from '../../domain/types';
import { parseISODate, toISODate, todayISO } from '../../domain/date';
import { jalaliMonthLength, jalaliToISO, toJalali } from '../../domain/jalali';
import { useLocalDate, weekdayOrder } from '../../hooks/useLocalDate';
import { cn } from '../../utils/cn';
import { YearMonthNav } from './YearMonthNav';

export interface DayMark {
  count: number;
  danger: boolean;
}

interface Props {
  calendar: 'jalali' | 'gregorian';
  weekStart: Weekday;
  value: ISODate | null;
  onChange: (iso: ISODate) => void;
  /** Optional per-day dots (calendar screen). */
  marks?: Record<ISODate, DayMark>;
  /** Controlled visible month — the dashboard derives its list from it. */
  month?: { y: number; m: number };
  onMonthChange?: (month: { y: number; m: number }) => void;
}

/** {y, m} in the ACTIVE calendar space — conversions happen only per-cell. */
interface CalendarMonth {
  y: number;
  m: number;
}

function monthOf(iso: ISODate, calendar: 'jalali' | 'gregorian'): CalendarMonth {
  if (calendar === 'jalali') {
    const { jy, jm } = toJalali(iso);
    return { y: jy, m: jm };
  }
  const d = parseISODate(iso);
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}

function addMonths({ y, m }: CalendarMonth, delta: number): CalendarMonth {
  const total = y * 12 + (m - 1) + delta;
  return { y: Math.floor(total / 12), m: ((total % 12) + 12) % 12 + 1 };
}

function monthLength({ y, m }: CalendarMonth, calendar: 'jalali' | 'gregorian'): number {
  return calendar === 'jalali' ? jalaliMonthLength(y, m) : new Date(y, m, 0).getDate();
}

function firstDayISO({ y, m }: CalendarMonth, calendar: 'jalali' | 'gregorian'): ISODate {
  return calendar === 'jalali' ? jalaliToISO(y, m, 1) : toISODate(new Date(y, m - 1, 1));
}

function dayISO({ y, m }: CalendarMonth, day: number, calendar: 'jalali' | 'gregorian'): ISODate {
  return calendar === 'jalali' ? jalaliToISO(y, m, day) : toISODate(new Date(y, m - 1, day));
}

/**
 * One month-grid component for BOTH calendar systems. All view state lives in
 * calendar space; cells convert to ISO only to compare/select and to look up
 * marks, so switching systems never drifts.
 */
export function DualCalendarPanel({ calendar, weekStart, value, onChange, marks, month, onMonthChange }: Props) {
  const { t } = useTranslation();
  const localDate = useLocalDate();
  const today = todayISO();
  const [internalView, setInternalView] = useState<CalendarMonth>(() => monthOf(value ?? today, calendar));
  const view = month ?? internalView;
  const updateView = (next: CalendarMonth) => (onMonthChange ? onMonthChange(next) : setInternalView(next));

  // Re-derive the visible month when the calendar system changes. Controlled
  // mode only tracks it — the parent owns the month there.
  useEffect(() => {
    if (month === undefined) setInternalView(monthOf(value ?? today, calendar));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendar]);

  const cells = useMemo(() => {
    const len = monthLength(view, calendar);
    const leading = (parseISODate(firstDayISO(view, calendar)).getDay() - weekStart + 7) % 7;
    const list: (ISODate | null)[] = Array.from({ length: leading }, () => null);
    for (let day = 1; day <= len; day++) list.push(dayISO(view, day, calendar));
    return list;
  }, [view, calendar, weekStart]);

  const headerWeekdays = weekdayOrder(weekStart);
  const weekdays = t('weekdays.short', { returnObjects: true }) as string[];
  const todayMonth = monthOf(today, calendar);

  return (
    <div>
      <YearMonthNav
        label={localDate.monthYearLabel(view.y, view.m)}
        onPrev={() => updateView(addMonths(view, -1))}
        onNext={() => updateView(addMonths(view, 1))}
        onToday={
          (view.y !== todayMonth.y || view.m !== todayMonth.m)
            ? () => updateView(todayMonth)
            : undefined
        }
      />
      <div className="mt-3 grid grid-cols-7 gap-y-1 text-center">
        {headerWeekdays.map((wd) => (
          <div key={wd} className="py-1 text-[0.65rem] font-medium text-fg-2">
            {weekdays[wd]}
          </div>
        ))}
        {cells.map((iso, index) => {
          if (!iso) return <span key={`blank-${index}`} />;
          const date = parseISODate(iso);
          const dayNumber = calendar === 'jalali' ? toJalali(iso).jd : date.getDate();
          const isToday = iso === today;
          const isSelected = iso === value;
          const mark = marks?.[iso];
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onChange(iso)}
              aria-pressed={isSelected}
              aria-label={localDate.formatDate(iso)}
              className={cn(
                'mx-auto flex h-9 w-9 flex-col items-center justify-center rounded-xl text-sm transition-colors',
                isSelected
                  ? 'bg-accent-600 font-semibold text-white dark:bg-accent-500'
                  : isToday
                    ? 'font-semibold text-accent-600 dark:text-accent-400 ring-1 ring-accent-400/60'
                    : 'text-fg-1 hover:bg-surface-2',
              )}
            >
              {localDate.dayNumber(dayNumber)}
              {mark && mark.count > 0 && (
                <span className="flex h-1 gap-0.5" aria-hidden>
                  {Array.from({ length: Math.min(mark.count, 3) }, (_, i) => (
                    <span
                      key={i}
                      className={cn(
                        'h-1 w-1 rounded-full',
                        isSelected
                          ? 'bg-white'
                          : mark.danger
                            ? 'bg-danger'
                            : 'bg-accent-500 dark:bg-accent-400',
                      )}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

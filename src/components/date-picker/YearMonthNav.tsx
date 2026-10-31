import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onToday?: () => void;
}

const NAV_BUTTON =
  'flex h-9 w-9 items-center justify-center rounded-xl text-fg-2 transition-[background-color,color,transform] duration-150 hover:bg-surface-2 hover:text-fg-1 active:scale-90';

export function YearMonthNav({ label, onPrev, onNext, onToday }: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-2">
      {/* Previous sits at the start edge: arrow points left in LTR, right in RTL. */}
      <button type="button" onClick={onPrev} aria-label={t('calendar.prevMonth')} className={NAV_BUTTON}>
        <ChevronLeft size={18} className="rtl:rotate-180" />
      </button>
      <div className="flex items-center gap-1.5">
        {/* Re-keyed so the label eases in with each month change. */}
        <span key={label} className="anim-fade-in text-sm font-semibold">
          {label}
        </span>
        {onToday && (
          <button
            type="button"
            onClick={onToday}
            aria-label={t('calendar.todayButton')}
            title={t('calendar.todayButton')}
            className="anim-pop flex h-7 w-7 items-center justify-center rounded-lg text-accent-600 transition-colors hover:bg-accent-50 dark:text-accent-400 dark:hover:bg-accent-950"
          >
            <CalendarDays size={15} />
          </button>
        )}
      </div>
      <button type="button" onClick={onNext} aria-label={t('calendar.nextMonth')} className={NAV_BUTTON}>
        <ChevronRight size={18} className="rtl:rotate-180" />
      </button>
    </div>
  );
}

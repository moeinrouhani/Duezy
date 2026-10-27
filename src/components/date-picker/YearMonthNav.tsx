import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onToday?: () => void;
}

export function YearMonthNav({ label, onPrev, onNext, onToday }: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={onPrev}
        aria-label={t('common.back')}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-2 hover:bg-surface-2 hover:text-fg-1"
      >
        <ChevronRight size={18} className="rtl:rotate-180" />
      </button>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">{label}</span>
        {onToday && (
          <button
            type="button"
            onClick={onToday}
            aria-label={t('calendar.todayButton')}
            title={t('calendar.todayButton')}
            className="flex h-6 w-6 items-center justify-center rounded-md text-accent-600 hover:bg-accent-50 dark:text-accent-400 dark:hover:bg-accent-950"
          >
            <Calendar size={14} />
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onNext}
        aria-label="next"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-2 hover:bg-surface-2 hover:text-fg-1"
      >
        <ChevronLeft size={18} className="rtl:rotate-180" />
      </button>
    </div>
  );
}

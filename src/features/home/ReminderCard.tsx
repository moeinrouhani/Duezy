import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Bell, Check, Pin, Repeat } from 'lucide-react';
import type { Reminder } from '../../domain/types';
import { daysUntil } from '../../domain/date';
import { CATEGORY_COLOR_HEX } from '../../themes/accents';
import { cn } from '../../utils/cn';
import { useCategories } from '../../hooks/useReminders';
import { useLocalDate } from '../../hooks/useLocalDate';
import { formatNumber } from '../../utils/digits';

interface Props {
  reminder: Reminder;
  onComplete: (id: string) => void;
}

export function ReminderCard({ reminder, onComplete }: Props) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const localDate = useLocalDate();
  const { categories } = useCategories();
  const lang = i18n.language === 'en' ? 'en' : 'fa';

  const category = categories.find((c) => c.id === reminder.categoryId);
  const color = CATEGORY_COLOR_HEX[category?.color ?? 'teal'];
  const du = daysUntil(reminder.dueDate);
  const overdue = du < 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/reminder/${reminder.id}`)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') navigate(`/reminder/${reminder.id}`);
      }}
      className={cn(
        'relative flex items-center gap-3 overflow-hidden rounded-2xl border bg-surface p-3.5 pe-2 transition-colors cursor-pointer',
        overdue ? 'border-danger/40' : 'border-line',
        reminder.done && 'opacity-60',
      )}
    >
      <span className="absolute inset-y-0 start-0 w-1" style={{ backgroundColor: color }} aria-hidden />

      {!reminder.done && (
        <button
          onClick={(event) => {
            event.stopPropagation();
            onComplete(reminder.id);
          }}
          aria-label={t('detail.markDone')}
          title={t('detail.markDone')}
          className="ms-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-line text-transparent transition hover:border-accent-500 hover:bg-accent-500 hover:text-white"
        >
          <Check size={16} aria-hidden />
        </button>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {reminder.pinned && <Pin size={12} className="shrink-0 text-fg-2" aria-label={t('card.pinned')} />}
          <p className={cn('truncate text-sm font-medium', reminder.done && 'line-through')}>{reminder.title}</p>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-2">
          <span className={cn(overdue && !reminder.done && 'font-medium text-danger')}>
            {localDate.relative(reminder.dueDate)}
          </span>
          {category && <span>· {category.nameKey ? t(category.nameKey) : category.name}</span>}
          {reminder.amount !== undefined && (
            <span>· {formatNumber(reminder.amount, lang)}{reminder.currency ? ` ${reminder.currency}` : ''}</span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 pe-1 text-fg-2">
        {reminder.recurrence && <Repeat size={14} aria-label={t('card.recurring')} />}
        {reminder.alerts.offsets.length > 0 && <Bell size={14} aria-label={t('card.alertsOn')} />}
      </div>
    </div>
  );
}

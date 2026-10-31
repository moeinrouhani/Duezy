import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import {
  Bell,
  BellRing,
  CalendarClock,
  Check,
  CircleAlert,
  CircleCheck,
  FileText,
  Pencil,
  Pin,
  PinOff,
  Repeat,
  SkipForward,
  Trash2,
  Wallet,
} from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { CategoryTile } from '../../components/ui/CategoryIcon';
import { useConfirm } from '../../components/ui/Snackbar';
import { getRepositories } from '../../repositories';
import { useReminders, useCategories } from '../../hooks/useReminders';
import { useLocalDate } from '../../hooks/useLocalDate';
import { CATEGORY_COLOR_HEX } from '../../themes/accents';
import { formatNumber } from '../../utils/digits';
import { upcomingOccurrences } from '../../domain/recurrence';
import { sectionOf } from '../../domain/alerts';
import type { ReminderSection } from '../../domain/alerts';
import type { CompletionRecord, RecurrenceRule, Reminder } from '../../domain/types';
import type { TFunction } from 'i18next';
import { cn } from '../../utils/cn';
import type { CSSProperties } from 'react';

export function recurrenceDescription(rule: RecurrenceRule, t: TFunction): string {
  return rule.interval > 1
    ? `${t('recurrence.intervalLabel')} ${rule.interval} ${t('recurrence.unit.' + rule.freq)}`
    : t('recurrence.' + rule.freq);
}

export function ReminderDetailScreen() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const localDate = useLocalDate();
  const confirm = useConfirm();
  const { remove, complete, togglePin } = useReminders();
  const { categories } = useCategories();
  const lang = i18n.language === 'en' ? 'en' : 'fa';

  const [reminder, setReminder] = useState<Reminder | null>(null);
  const [history, setHistory] = useState<CompletionRecord[]>([]);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const repos = await getRepositories();
      const found = await repos.reminders.get(id!);
      if (cancelled) return;
      if (!found) {
        setMissing(true);
        return;
      }
      setReminder(found);
      setHistory(await repos.completions.listByReminder(found.id));
    })();
    return () => {
      cancelled = true;
    };
  }, [id, reminder?.updatedAt, reminder?.dueDate]);

  if (missing) {
    return (
      <EmptyState
        icon={<CircleAlert size={26} aria-hidden />}
        title={t('search.empty')}
      />
    );
  }

  if (!reminder) return null;

  const category = categories.find((c) => c.id === reminder.categoryId);
  const color = CATEGORY_COLOR_HEX[category?.color ?? 'teal'];
  const preview =
    reminder.recurrence && !reminder.done ? upcomingOccurrences(reminder.recurrence, reminder.dueDate, 3) : [];

  const onDelete = async () => {
    const ok = await confirm('detail.deleteTitle', 'detail.deleteMessage', {
      danger: true,
      confirmLabel: t('common.delete'),
    });
    if (ok) {
      await remove(reminder.id);
      navigate('/');
    }
  };

  const section = sectionOf(reminder);
  const status: Record<ReminderSection, { icon: ReactElement; tone: string }> = {
    overdue: { icon: <CircleAlert size={14} aria-hidden />, tone: 'bg-danger/10 text-danger' },
    today: { icon: <BellRing size={14} aria-hidden />, tone: 'bg-warning/15 text-warning' },
    upcoming: {
      icon: <CalendarClock size={14} aria-hidden />,
      tone: 'bg-accent-50 text-accent-700 dark:bg-accent-950 dark:text-accent-300',
    },
    done: { icon: <CircleCheck size={14} aria-hidden />, tone: 'bg-success/10 text-success' },
  };

  const rows: { label: string; value?: string; icon: ReactElement }[] = [
    ...(reminder.amount !== undefined
      ? [{
          label: t('detail.amountLabel'),
          value: `${formatNumber(reminder.amount, lang)}${reminder.currency ? ` ${reminder.currency}` : ''}`,
          icon: <Wallet size={16} aria-hidden />,
        }]
      : []),
    ...(reminder.recurrence
      ? [{ label: t('recurrence.label'), value: recurrenceDescription(reminder.recurrence, t), icon: <Repeat size={16} aria-hidden /> }]
      : []),
    {
      label: t('detail.alertsLabel'),
      value:
        reminder.alerts.offsets.length > 0
          ? reminder.alerts.offsets
              .map((offset) => (offset === 0 ? t('alerts.dayOf') : t('alerts.dayBefore_other', { count: offset })))
              .join(' · ')
          : t('alerts.inAppOnly'),
      icon: <Bell size={16} aria-hidden />,
    },
    ...(reminder.notes ? [{ label: t('detail.notesLabel'), value: reminder.notes, icon: <FileText size={16} aria-hidden /> }] : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={reminder.title}
        showBack
        actions={
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" aria-label={t('common.edit')} onClick={() => navigate(`/reminder/${reminder.id}/edit`)}>
              <Pencil size={16} aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label={reminder.pinned ? t('common.unpin') : t('common.pin')}
              onClick={() => void togglePin(reminder.id)}
            >
              {reminder.pinned ? <PinOff size={16} aria-hidden /> : <Pin size={16} aria-hidden />}
            </Button>
            <Button variant="ghost" size="sm" aria-label={t('common.delete')} onClick={() => void onDelete()}>
              <Trash2 size={16} className="text-danger" aria-hidden />
            </Button>
          </div>
        }
      />

      {/* Hero: when it's due, at a glance, in the category's color. */}
      <section className="anim-rise relative overflow-hidden rounded-3xl border border-line bg-surface p-5 shadow-card">
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-1"
          style={{ backgroundColor: color }}
        />
        <div className="flex items-start gap-3">
          <CategoryTile icon={category?.icon} color={color} className="h-12 w-12 rounded-2xl" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-fg-2">{t('detail.dueLabel')}</p>
            <p className="mt-0.5 text-lg leading-snug font-bold tracking-tight">{localDate.formatDateLong(reminder.dueDate)}</p>
            {category && (
              <p className="mt-0.5 text-xs text-fg-2">{category.nameKey ? t(category.nameKey) : category.name}</p>
            )}
          </div>
        </div>
        <span
          className={cn(
            'mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
            status[section].tone,
          )}
        >
          {status[section].icon}
          {section === 'done' ? t('common.done') : localDate.relative(reminder.dueDate)}
        </span>
      </section>

      {!reminder.done && (
        <div className="anim-rise flex gap-2" style={{ '--i': 1 } as CSSProperties}>
          <Button className="flex-1" onClick={() => void complete(reminder.id)}>
            <Check size={17} aria-hidden />
            {t('detail.markDone')}
          </Button>
          {reminder.recurrence && (
            <Button variant="secondary" onClick={() => void complete(reminder.id, { skipped: true })}>
              <SkipForward size={16} aria-hidden />
              {t('common.skip')}
            </Button>
          )}
        </div>
      )}

      <section
        className="anim-rise overflow-hidden rounded-2xl border border-line bg-surface shadow-card"
        style={{ '--i': 2 } as CSSProperties}
      >
        <dl>
          {rows.map((row, index) => (
            <div
              key={row.label}
              className={cn('flex items-start gap-3 px-4 py-3', index > 0 && 'border-t border-line')}
            >
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-fg-2">
                {row.icon}
              </span>
              <div className="min-w-0 flex-1">
                <dt className="text-xs text-fg-2">{row.label}</dt>
                <dd className="mt-0.5 text-sm break-words whitespace-pre-wrap">{row.value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </section>

      {preview.length > 0 && (
        <section className="anim-rise" style={{ '--i': 3 } as CSSProperties}>
          <h2 className="mb-2 px-1 text-xs font-semibold text-fg-2">{t('recurrence.nextOccurrences')}</h2>
          <ul className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4 shadow-card">
            {preview.map((iso, i) => (
              <li key={iso} className="flex items-center gap-3 text-sm text-fg-1">
                {/* Timeline dot: fades with distance from now. */}
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full bg-accent-500 dark:bg-accent-400"
                  style={{ opacity: 1 - i * 0.28 }}
                />
                {localDate.formatDate(iso)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="anim-rise" style={{ '--i': 4 } as CSSProperties}>
        <h2 className="mb-2 px-1 text-xs font-semibold text-fg-2">{t('detail.historyLabel')}</h2>
        {history.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-fg-2">
            {t('detail.historyEmpty')}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {history.map((record) => (
              <li
                key={record.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm shadow-card"
              >
                <span className="flex items-center gap-2 text-fg-1">
                  <CircleCheck
                    size={14}
                    className={record.skipped ? 'text-fg-2' : 'text-success'}
                    aria-hidden
                  />
                  {localDate.formatDate(record.dueDateCompleted)}
                  {record.skipped && (
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[0.65rem] text-fg-2">
                      {t('detail.skippedTag')}
                    </span>
                  )}
                </span>
                <span className="text-xs text-fg-2">{t('detail.completedOn', { date: localDate.formatDate(record.completedAt.slice(0, 10)) })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

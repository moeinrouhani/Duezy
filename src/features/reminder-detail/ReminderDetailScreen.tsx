import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import {
  Bell,
  CalendarDays,
  Check,
  CircleAlert,
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
import { useConfirm } from '../../components/ui/Snackbar';
import { getRepositories } from '../../repositories';
import { useReminders, useCategories } from '../../hooks/useReminders';
import { useLocalDate } from '../../hooks/useLocalDate';
import { CATEGORY_COLOR_HEX } from '../../themes/accents';
import { formatNumber } from '../../utils/digits';
import { upcomingOccurrences } from '../../domain/recurrence';
import type { CompletionRecord, RecurrenceRule, Reminder } from '../../domain/types';
import type { TFunction } from 'i18next';
import { cn } from '../../utils/cn';

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
    const ok = await confirm('detail.deleteTitle', 'detail.deleteMessage');
    if (ok) {
      await remove(reminder.id);
      navigate('/');
    }
  };

  const rows: { label: string; value?: string; icon: ReactElement }[] = [
    {
      label: t('detail.dueLabel'),
      value: localDate.formatDateLong(reminder.dueDate) + ' · ' + localDate.relative(reminder.dueDate),
      icon: <CalendarDays size={16} aria-hidden />,
    },
    ...(category
      ? [{ label: t('form.categoryLabel'), value: category.nameKey ? t(category.nameKey) : category.name, icon: <span className="inline-block h-3.5 w-3.5 rounded-full" style={{ backgroundColor: color }} aria-hidden /> }]
      : []),
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

      {!reminder.done && (
        <div className="flex gap-2">
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

      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        <dl>
          {rows.map((row, index) => (
            <div
              key={row.label}
              className={cn('flex items-start gap-3 px-4 py-3', index > 0 && 'border-t border-line')}
            >
              <span className="mt-0.5 text-fg-2">{row.icon}</span>
              <div className="min-w-0 flex-1">
                <dt className="text-xs text-fg-2">{row.label}</dt>
                <dd className="mt-0.5 text-sm break-words whitespace-pre-wrap">{row.value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </section>

      {preview.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-xs font-semibold text-fg-2">{t('recurrence.nextOccurrences')}</h2>
          <ul className="flex flex-col gap-1.5 rounded-2xl border border-line bg-surface p-3">
            {preview.map((iso) => (
              <li key={iso} className="text-sm text-fg-1">
                {localDate.formatDate(iso)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
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
                className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm"
              >
                <span className="text-fg-1">
                  {localDate.formatDate(record.dueDateCompleted)}
                  {record.skipped && (
                    <span className="ms-2 rounded-full bg-surface-2 px-2 py-0.5 text-[0.65rem] text-fg-2">
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

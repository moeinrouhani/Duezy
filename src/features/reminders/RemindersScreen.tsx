import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Bell, ListChecks, Pencil, Plus, Repeat, Search, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button, Chip, EmptyState, SegmentedControl } from '../../components/ui';
import { Input } from '../../components/ui/Input';
import { IconButton } from '../../components/ui/Button';
import { useConfirm } from '../../components/ui/Snackbar';
import { StatsPanel } from './StatsPanel';
import { useReminders, useCategories } from '../../hooks/useReminders';
import { useCompletions } from '../../hooks/useCompletions';
import { useLocalDate } from '../../hooks/useLocalDate';
import { reminderProgress } from '../../domain/occurrences';
import { sortReminders } from '../../utils/sortReminders';
import { CATEGORY_COLOR_HEX } from '../../themes/accents';
import { formatNumber } from '../../utils/digits';
import type { Reminder } from '../../domain/types';
import { cn } from '../../utils/cn';

type Tab = 'list' | 'stats';
type StatusFilter = 'all' | 'active' | 'done';

/**
 * Reminders: every reminder as a WHOLE (a 5-month payment is one row with
 * its full data and progress), with edit/delete. No check/uncheck here —
 * settling occurrences lives on the Dashboard.
 */
export function RemindersScreen() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const lang = i18n.language === 'en' ? 'en' : 'fa';
  const { reminders, remove } = useReminders();
  const { categories } = useCategories();
  const completions = useCompletions();
  const confirm = useConfirm();

  const [tab, setTab] = useState<Tab>('list');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = reminders.filter((reminder) => {
      if (statusFilter === 'active' && reminder.done) return false;
      if (statusFilter === 'done' && !reminder.done) return false;
      if (!q) return true;
      const category = categories.find((c) => c.id === reminder.categoryId);
      const haystack = [
        reminder.title,
        reminder.notes ?? '',
        category ? (category.nameKey ? t(category.nameKey) : category.name) : '',
        reminder.amount !== undefined ? String(reminder.amount) : '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
    return sortReminders(matches);
  }, [reminders, categories, query, statusFilter, t]);

  const statusCounts = useMemo(
    () => ({
      all: reminders.length,
      active: reminders.filter((r) => !r.done).length,
      done: reminders.filter((r) => r.done).length,
    }),
    [reminders],
  );

  async function handleDelete(reminder: Reminder) {
    const ok = await confirm('detail.deleteTitle', 'detail.deleteMessage');
    if (ok) void remove(reminder.id);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('nav.reminders')}
        actions={
          <Button size="sm" variant="secondary" onClick={() => navigate('/reminder/new')} className="hidden md:inline-flex">
            <Plus size={15} aria-hidden />
            {t('nav.add')}
          </Button>
        }
      />

      <SegmentedControl<Tab>
        label={t('nav.reminders')}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'list', label: t('reminders.tabList') },
          { value: 'stats', label: t('reminders.tabStats') },
        ]}
      />

      {tab === 'stats' ? (
        <StatsPanel />
      ) : (
        <>
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute inset-y-0 start-3 my-auto text-fg-2" aria-hidden />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('search.placeholder')}
              aria-label={t('search.title')}
              className="ps-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Chip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
              {t('reminders.filterAll')}
              <span className="opacity-70">{formatNumber(statusCounts.all, lang)}</span>
            </Chip>
            <Chip active={statusFilter === 'active'} onClick={() => setStatusFilter('active')}>
              {t('reminders.filterActive')}
              <span className="opacity-70">{formatNumber(statusCounts.active, lang)}</span>
            </Chip>
            <Chip active={statusFilter === 'done'} onClick={() => setStatusFilter('done')}>
              {t('reminders.filterDone')}
              <span className="opacity-70">{formatNumber(statusCounts.done, lang)}</span>
            </Chip>
          </div>

          {results.length === 0 ? (
            reminders.length === 0 ? (
              <EmptyState
                icon={<ListChecks size={26} aria-hidden />}
                title={t('home.emptyTitle')}
                body={t('home.emptyBody')}
                action={
                  <Button onClick={() => navigate('/reminder/new')} className="mt-2">
                    <Plus size={16} aria-hidden />
                    {t('home.addFirst')}
                  </Button>
                }
              />
            ) : (
              <EmptyState icon={<Search size={26} aria-hidden />} title={t('search.empty')} body={t('search.emptyHint')} />
            )
          ) : (
            <div className="flex flex-col gap-2">
              {results.map((reminder) => {
                const category = categories.find((c) => c.id === reminder.categoryId);
                return (
                  <ReminderManageRow
                    key={reminder.id}
                    reminder={reminder}
                    completedCount={completions.filter((c) => c.reminderId === reminder.id && !c.deletedAt).length}
                    lang={lang}
                    categoryName={category ? (category.nameKey ? t(category.nameKey) : category.name) : undefined}
                    color={CATEGORY_COLOR_HEX[category?.color ?? 'teal']}
                    onEdit={() => navigate(`/reminder/${reminder.id}/edit`)}
                    onDelete={() => void handleDelete(reminder)}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Full-data row: progress + edit/delete. Deliberately no check control. */
function ReminderManageRow({
  reminder,
  completedCount,
  categoryName,
  color,
  lang,
  onEdit,
  onDelete,
}: {
  reminder: Reminder;
  completedCount: number;
  categoryName: string | undefined;
  color: string;
  lang: 'en' | 'fa';
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const localDate = useLocalDate();
  const progress = reminderProgress(reminder, completedCount);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/reminder/${reminder.id}`)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') navigate(`/reminder/${reminder.id}`);
      }}
      className={cn(
        'relative flex cursor-pointer items-start gap-3 overflow-hidden rounded-2xl border border-line bg-surface p-3.5 pe-2 transition-colors',
        reminder.done && 'opacity-60',
      )}
    >
      <span className="absolute inset-y-0 start-0 w-1" style={{ backgroundColor: color }} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className={cn('truncate text-sm font-medium', reminder.done && 'line-through')}>{reminder.title}</p>
        </div>

        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-2">
          <span>{localDate.formatDate(reminder.dueDate)} · {localDate.relative(reminder.dueDate)}</span>
          {categoryName && <span>· {categoryName}</span>}
          {reminder.amount !== undefined && (
            <span>
              · {formatNumber(reminder.amount, lang)}
              {reminder.currency ? ` ${reminder.currency}` : ''}
            </span>
          )}
          {reminder.recurrence && (
            <span className="inline-flex items-center gap-0.5">
              · <Repeat size={12} aria-label={t('card.recurring')} />
              {t(`recurrence.${reminder.recurrence.freq}`)}
            </span>
          )}
          {reminder.alerts.offsets.length > 0 && (
            <span className="inline-flex items-center gap-0.5">
              · <Bell size={12} aria-label={t('card.alertsOn')} />
              {formatNumber(reminder.alerts.offsets.length, lang)}
            </span>
          )}
        </div>

        {/* Progress */}
        <div className="mt-2">
          {progress !== null ? (
            <div className="flex items-center gap-2">
              <span
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"
                role="progressbar"
                aria-valuenow={Math.round(progress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span
                  className="block h-full rounded-full bg-accent-500 dark:bg-accent-400 transition-all"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </span>
              <span className="shrink-0 text-[0.7rem] tabular-nums text-fg-2">
                {reminder.recurrence?.end.type === 'after'
                  ? `${formatNumber(Math.min(completedCount, reminder.recurrence.end.count), lang)}/${formatNumber(reminder.recurrence.end.count, lang)}`
                  : `${formatNumber(Math.round(progress * 100), lang)}%`}
              </span>
            </div>
          ) : (
            <span className="text-[0.7rem] tabular-nums text-fg-2">
              {t('reminders.settledCount', { count: completedCount })}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 self-center pe-1">
        <IconButton label={t('common.edit')} onClick={onEdit}>
          <Pencil size={15} />
        </IconButton>
        <IconButton label={t('common.delete')} className="hover:bg-danger/10 hover:text-danger" onClick={onDelete}>
          <Trash2 size={15} />
        </IconButton>
      </div>
    </div>
  );
}

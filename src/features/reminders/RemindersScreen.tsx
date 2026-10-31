import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Bell, CircleCheck, ListChecks, Pencil, Pin, Plus, Repeat, Search, Trash2, X } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button, Chip, EmptyState, SegmentedControl } from '../../components/ui';
import { Input } from '../../components/ui/Input';
import { IconButton } from '../../components/ui/Button';
import { CategoryTile } from '../../components/ui/CategoryIcon';
import { useConfirm } from '../../components/ui/Snackbar';
import { StatsPanel } from './StatsPanel';
import { useReminders, useCategories } from '../../hooks/useReminders';
import { useCompletions } from '../../hooks/useCompletions';
import { useLocalDate } from '../../hooks/useLocalDate';
import { reminderProgress } from '../../domain/occurrences';
import { daysUntil } from '../../domain/date';
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
  // Rows that were just confirmed for deletion — they collapse before the data goes.
  const [leaving, setLeaving] = useState<Set<string>>(() => new Set());

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
    const ok = await confirm('detail.deleteTitle', 'detail.deleteMessage', {
      danger: true,
      confirmLabel: t('common.delete'),
    });
    if (!ok) return;
    setLeaving((current) => new Set(current).add(reminder.id));
    window.setTimeout(() => {
      void remove(reminder.id).finally(() =>
        setLeaving((current) => {
          const next = new Set(current);
          next.delete(reminder.id);
          return next;
        }),
      );
    }, 260);
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
        <div className="anim-fade-in">
          <StatsPanel />
        </div>
      ) : (
        <>
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute inset-y-0 start-3.5 my-auto text-fg-2" aria-hidden />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('search.placeholder')}
              aria-label={t('search.title')}
              className="ps-10 pe-10"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label={t('search.clear')}
                className="anim-pop absolute inset-y-0 end-2 my-auto flex h-7 w-7 items-center justify-center rounded-lg text-fg-2 transition-colors hover:bg-surface-2 hover:text-fg-1"
              >
                <X size={14} aria-hidden />
              </button>
            )}
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
              {results.map((reminder, index) => {
                const category = categories.find((c) => c.id === reminder.categoryId);
                return (
                  <ReminderManageRow
                    key={reminder.id}
                    index={index}
                    leaving={leaving.has(reminder.id)}
                    reminder={reminder}
                    completedCount={completions.filter((c) => c.reminderId === reminder.id && !c.deletedAt).length}
                    lang={lang}
                    categoryName={category ? (category.nameKey ? t(category.nameKey) : category.name) : undefined}
                    categoryIcon={category?.icon}
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
  index,
  leaving,
  completedCount,
  categoryName,
  categoryIcon,
  color,
  lang,
  onEdit,
  onDelete,
}: {
  reminder: Reminder;
  index: number;
  leaving: boolean;
  completedCount: number;
  categoryName: string | undefined;
  categoryIcon: string | undefined;
  color: string;
  lang: 'en' | 'fa';
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const localDate = useLocalDate();
  const progress = reminderProgress(reminder, completedCount);
  const overdue = !reminder.done && daysUntil(reminder.dueDate) < 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/reminder/${reminder.id}`)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') navigate(`/reminder/${reminder.id}`);
      }}
      style={{ '--i': index } as CSSProperties}
      className={cn(
        'anim-rise group relative flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface p-3 pe-2 shadow-card',
        'transition-[border-color,box-shadow,transform,opacity,filter] duration-200 hover:-translate-y-px hover:border-accent-300/70 hover:shadow-lift active:translate-y-0 dark:hover:border-accent-700/60',
        reminder.done && 'opacity-70',
        // Leaving rows shrink and fade out before the record is removed.
        leaving && 'pointer-events-none scale-95 opacity-0 blur-[1px]',
      )}
    >
      <CategoryTile icon={categoryIcon} color={color} className={reminder.done ? 'opacity-60' : undefined} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className={cn('truncate text-sm font-medium', reminder.done && 'text-fg-2 line-through')}>{reminder.title}</p>
          {reminder.pinned && (
            <Pin size={12} className="shrink-0 -rotate-45 text-accent-600 dark:text-accent-400" aria-label={t('card.pinned')} />
          )}
          {reminder.done && <CircleCheck size={14} className="shrink-0 text-success" aria-hidden />}
        </div>

        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-2">
          <span className={cn(overdue && 'font-medium text-danger')}>
            {localDate.formatDate(reminder.dueDate)} · {localDate.relative(reminder.dueDate)}
          </span>
          {categoryName && <span>· {categoryName}</span>}
          {reminder.amount !== undefined && (
            <span className="font-medium text-fg-1/80">
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
        <div className="mt-2.5">
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
                  className="anim-grow-x block h-full rounded-full bg-linear-to-r from-accent-400 to-accent-600"
                  style={{ width: `${Math.round(progress * 100)}%`, '--i': index } as CSSProperties}
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

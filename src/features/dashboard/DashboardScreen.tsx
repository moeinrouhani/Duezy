import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { BellOff, Check, Plus, X } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { DualCalendarPanel, type DayMark } from '../../components/date-picker/DualCalendarPanel';
import { Button, Chip, EmptyState } from '../../components/ui';
import { useReminders } from '../../hooks/useReminders';
import { useCompletions } from '../../hooks/useCompletions';
import { useCategories } from '../../hooks/useReminders';
import { useLocalDate } from '../../hooks/useLocalDate';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  calendarMonthOf,
  calendarMonthRange,
  occurrencesBetween,
  summarizeOccurrences,
  type CalendarMonth,
  type Occurrence,
} from '../../domain/occurrences';
import { todayISO } from '../../domain/date';
import { CATEGORY_COLOR_HEX } from '../../themes/accents';
import { formatNumber } from '../../utils/digits';
import { cn } from '../../utils/cn';

type MonthFilter = 'all' | 'pending' | 'done' | 'overdue';

/**
 * Dashboard: every occurrence due in the selected month — a 5-month payment
 * shows only this month's row. Check / uncheck lives here; edit/delete does
 * not (that's the Reminders screen's job).
 */
export function DashboardScreen() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const lang = i18n.language === 'en' ? 'en' : 'fa';
  const localDate = useLocalDate();
  const calendar = useSettingsStore((s) => s.settings.calendar);
  const weekStart = useSettingsStore((s) => s.settings.weekStart);
  const { reminders, completeOccurrence, undoOccurrence } = useReminders();
  const completions = useCompletions();
  const { categories } = useCategories();

  const [month, setMonth] = useState<CalendarMonth>(() => calendarMonthOf(todayISO(), calendar));
  const [filter, setFilter] = useState<MonthFilter>('all');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Switching calendar systems re-interprets {y, m} — re-ground on today.
  useEffect(() => {
    setMonth(calendarMonthOf(todayISO(), calendar));
    setSelectedDay(null);
  }, [calendar]);

  const range = useMemo(() => calendarMonthRange(month, calendar), [month, calendar]);
  const occurrences = useMemo(
    () => occurrencesBetween(reminders, completions, range.start, range.end),
    [reminders, completions, range],
  );
  const summary = useMemo(() => summarizeOccurrences(occurrences), [occurrences]);

  const counts = useMemo(
    () => ({
      all: occurrences.length,
      pending: occurrences.filter((o) => !o.checked).length,
      done: occurrences.filter((o) => o.checked).length,
      overdue: occurrences.filter((o) => o.overdue).length,
    }),
    [occurrences],
  );

  const filtered = useMemo(() => {
    return occurrences.filter((o) => {
      if (selectedDay && o.date !== selectedDay) return false;
      if (filter === 'pending') return !o.checked;
      if (filter === 'done') return o.checked;
      if (filter === 'overdue') return o.overdue;
      return true;
    });
  }, [occurrences, filter, selectedDay]);

  const marks = useMemo(() => {
    const byDay = new Map<string, DayMark>();
    for (const o of occurrences) {
      const mark = byDay.get(o.date) ?? { count: 0, danger: false };
      mark.count += 1;
      if (o.overdue) mark.danger = true;
      byDay.set(o.date, mark);
    }
    return Object.fromEntries(byDay);
  }, [occurrences]);

  if (reminders.length === 0) {
    return (
      <div>
        <PageHeader title={t('nav.dashboard')} />
        <EmptyState
          icon={<BellOff size={26} aria-hidden />}
          title={t('home.emptyTitle')}
          body={t('home.emptyBody')}
          action={
            <Button onClick={() => navigate('/reminder/new')} className="mt-2">
              <Plus size={16} aria-hidden />
              {t('home.addFirst')}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('nav.dashboard')} />

      <MonthStatsCard summary={summary} lang={lang} />

      <section className="rounded-2xl border border-line bg-surface p-4">
        <DualCalendarPanel
          calendar={calendar}
          weekStart={weekStart}
          value={selectedDay}
          onChange={(iso) => setSelectedDay((current) => (current === iso ? null : iso))}
          month={month}
          onMonthChange={(next) => {
            setMonth(next);
            setSelectedDay(null);
          }}
          marks={marks}
        />
      </section>

      <div className="flex flex-wrap items-center gap-1.5">
        <FilterChip label={t('dashboard.filterAll')} count={counts.all} active={filter === 'all'} onClick={() => setFilter('all')} />
        <FilterChip label={t('dashboard.filterPending')} count={counts.pending} active={filter === 'pending'} onClick={() => setFilter('pending')} />
        <FilterChip label={t('dashboard.filterDone')} count={counts.done} active={filter === 'done'} onClick={() => setFilter('done')} />
        <FilterChip
          label={t('dashboard.filterOverdue')}
          count={counts.overdue}
          active={filter === 'overdue'}
          onClick={() => setFilter('overdue')}
          danger
        />
        {selectedDay && (
          <Chip active onClick={() => setSelectedDay(null)} className="ms-auto">
            {localDate.formatDate(selectedDay)}
            <X size={12} aria-hidden />
          </Chip>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-fg-2">
          {t('dashboard.emptyMonth')}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((occurrence) => {
            const category = categories.find((c) => c.id === occurrence.reminder.categoryId);
            return (
              <OccurrenceRow
                key={`${occurrence.reminder.id}:${occurrence.date}`}
                occurrence={occurrence}
                categoryName={category ? (category.nameKey ? t(category.nameKey) : category.name) : undefined}
                color={CATEGORY_COLOR_HEX[category?.color ?? 'teal']}
                lang={lang}
                onToggle={() =>
                  void (occurrence.checked
                    ? undoOccurrence(occurrence.reminder.id, occurrence.date)
                    : completeOccurrence(occurrence.reminder.id, occurrence.date))
                }
                onOpen={() => navigate(`/reminder/${occurrence.reminder.id}`)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
  danger,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  danger?: boolean;
}) {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fa';
  return (
    <Chip active={active} onClick={onClick}>
      {label}
      {/* Colored on the child span — the chip's own text color would clash in the cascade. */}
      <span className={cn(danger && count > 0 && !active && 'text-danger')}>
        {formatNumber(count, lang)}
      </span>
    </Chip>
  );
}

function MonthStatsCard({
  summary,
  lang,
}: {
  summary: ReturnType<typeof summarizeOccurrences>;
  lang: 'en' | 'fa';
}) {
  const { t } = useTranslation();
  const unpaidCount = summary.count - summary.paidCount;
  return (
    <section className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-line bg-line">
      <StatCell label={t('dashboard.dueLabel')} value={formatNumber(summary.count, lang)} tone="neutral" />
      <StatCell
        label={t('dashboard.paidLabel')}
        value={formatNumber(summary.paidCount, lang)}
        tone="positive"
        money={summary.money.map((m) => `${formatNumber(m.paid, lang)}/${formatNumber(m.total, lang)}${m.currency ? ` ${m.currency}` : ''}`)}
      />
      <StatCell
        label={t('dashboard.unpaidLabel')}
        value={formatNumber(unpaidCount, lang)}
        tone={summary.overdueCount > 0 ? 'danger' : 'neutral'}
        money={summary.money.map((m) => `${formatNumber(m.unpaid, lang)}${m.currency ? ` ${m.currency}` : ''}`)}
      />
    </section>
  );
}

function StatCell({
  label,
  value,
  money,
  tone,
}: {
  label: string;
  value: string;
  money?: string[];
  tone: 'neutral' | 'positive' | 'danger';
}) {
  return (
    <div className="flex flex-col gap-0.5 bg-surface px-3 py-3">
      <span className="text-[0.65rem] font-medium uppercase tracking-wide text-fg-2">{label}</span>
      <span
        className={cn(
          'text-lg font-bold tabular-nums',
          tone === 'positive' && 'text-success',
          tone === 'danger' && 'text-danger',
        )}
      >
        {value}
      </span>
      {money?.map((line, i) => (
        <span key={i} className="text-[0.7rem] tabular-nums text-fg-2">
          {line}
        </span>
      ))}
    </div>
  );
}

/** One month-occurrence row: check/uncheck ONLY — no edit, no delete. */
function OccurrenceRow({
  occurrence,
  categoryName,
  color,
  lang,
  onToggle,
  onOpen,
}: {
  occurrence: Occurrence;
  categoryName: string | undefined;
  color: string;
  lang: 'en' | 'fa';
  onToggle: () => void;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const localDate = useLocalDate();
  const { reminder, date, checked, overdue } = occurrence;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onOpen();
      }}
      className={cn(
        'relative flex items-center gap-3 overflow-hidden rounded-2xl border bg-surface p-3.5 pe-2 transition-colors cursor-pointer',
        overdue ? 'border-danger/40' : 'border-line',
        checked && 'opacity-60',
      )}
    >
      <span className="absolute inset-y-0 start-0 w-1" style={{ backgroundColor: color }} aria-hidden />

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        aria-label={t(checked ? 'dashboard.uncheck' : 'detail.markDone')}
        title={t(checked ? 'dashboard.uncheck' : 'detail.markDone')}
        className={cn(
          'ms-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition',
          checked
            ? 'border-accent-500 bg-accent-500 text-white'
            : 'border-line text-transparent hover:border-accent-500 hover:bg-accent-500 hover:text-white',
        )}
      >
        <Check size={16} aria-hidden />
      </button>

      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-medium', checked && 'line-through')}>{reminder.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-2">
          <span className={cn(overdue && 'font-medium text-danger')}>
            {localDate.formatDate(date)} · {localDate.relative(date)}
          </span>
          {categoryName && <span>· {categoryName}</span>}
          {reminder.amount !== undefined && (
            <span>
              · {formatNumber(reminder.amount, lang)}
              {reminder.currency ? ` ${reminder.currency}` : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

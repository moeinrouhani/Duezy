import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { BellOff, CalendarCheck, CircleCheck, Plus, X } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { DualCalendarPanel, type DayMark } from '../../components/date-picker/DualCalendarPanel';
import { Button, Chip, EmptyState } from '../../components/ui';
import { CheckButton } from '../../components/ui/CheckButton';
import { CategoryTile } from '../../components/ui/CategoryIcon';
import { useReminders } from '../../hooks/useReminders';
import { useCompletions } from '../../hooks/useCompletions';
import { useCategories } from '../../hooks/useReminders';
import { useLocalDate } from '../../hooks/useLocalDate';
import { useCountUp } from '../../hooks/useCountUp';
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
      <PageHeader title={t('nav.dashboard')} subtitle={localDate.formatDateLong(todayISO())} />

      <MonthStatsCard summary={summary} lang={lang} />

      <section className="rounded-3xl border border-line bg-surface p-4 shadow-card">
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
        <div className="anim-fade-in flex flex-col items-center gap-2 rounded-3xl border border-dashed border-line px-4 py-10 text-center">
          <CalendarCheck size={22} className="text-fg-2" aria-hidden />
          <p className="text-sm text-fg-2">{t('dashboard.emptyMonth')}</p>
        </div>
      ) : (
        // Keyed by month: switching months re-staggers the whole list.
        <div key={`${month.y}-${month.m}`} className="flex flex-col gap-2">
          {filtered.map((occurrence, index) => {
            const category = categories.find((c) => c.id === occurrence.reminder.categoryId);
            return (
              <OccurrenceRow
                key={`${occurrence.reminder.id}:${occurrence.date}`}
                index={index}
                occurrence={occurrence}
                categoryName={category ? (category.nameKey ? t(category.nameKey) : category.name) : undefined}
                categoryIcon={category?.icon}
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
  const ratio = summary.count > 0 ? summary.paidCount / summary.count : 0;
  const allPaid = summary.count > 0 && unpaidCount === 0;
  const percent = useCountUp(Math.round(ratio * 100));

  return (
    <section className="overflow-hidden rounded-3xl border border-line bg-surface shadow-card">
      <div className="grid grid-cols-3 [&>*+*]:border-s [&>*+*]:border-line">
        <StatCell label={t('dashboard.dueLabel')} value={summary.count} lang={lang} tone="neutral" />
        <StatCell
          label={t('dashboard.paidLabel')}
          value={summary.paidCount}
          lang={lang}
          tone="positive"
          money={summary.money.map((m) => `${formatNumber(m.paid, lang)}/${formatNumber(m.total, lang)}${m.currency ? ` ${m.currency}` : ''}`)}
        />
        <StatCell
          label={t('dashboard.unpaidLabel')}
          value={unpaidCount}
          lang={lang}
          tone={summary.overdueCount > 0 ? 'danger' : 'neutral'}
          money={summary.money.map((m) => `${formatNumber(m.unpaid, lang)}${m.currency ? ` ${m.currency}` : ''}`)}
        />
      </div>

      {/* Paid share of the month — fills in once, then follows every check. */}
      <div className="flex items-center gap-3 border-t border-line bg-surface-2/50 px-4 py-2.5">
        {allPaid ? (
          <p className="anim-pop flex flex-1 items-center gap-1.5 text-xs font-medium text-success">
            <CircleCheck size={14} aria-hidden />
            {t('dashboard.allPaid')}
          </p>
        ) : (
          <span
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-line"
            role="progressbar"
            aria-valuenow={Math.round(ratio * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span
              className="block h-full origin-left rounded-full bg-linear-to-r from-accent-400 to-accent-600 transition-[width] duration-700 ease-[var(--ease-out)] rtl:origin-right"
              style={{ width: `${Math.round(ratio * 100)}%` }}
            />
          </span>
        )}
        <span className="shrink-0 text-[0.7rem] font-medium tabular-nums text-fg-2">
          {formatNumber(percent, lang)}%
        </span>
      </div>
    </section>
  );
}

function StatCell({
  label,
  value,
  lang,
  money,
  tone,
}: {
  label: string;
  value: number;
  lang: 'en' | 'fa';
  money?: string[];
  tone: 'neutral' | 'positive' | 'danger';
}) {
  const shown = useCountUp(value, 600);
  return (
    <div className="flex flex-col gap-0.5 px-3 py-3.5">
      <span className="text-[0.7rem] font-medium text-fg-2">{label}</span>
      <span
        className={cn(
          'text-2xl font-bold tabular-nums leading-tight tracking-tight',
          tone === 'positive' && 'text-success',
          tone === 'danger' && 'text-danger',
        )}
      >
        {formatNumber(shown, lang)}
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
  index,
  categoryName,
  categoryIcon,
  color,
  lang,
  onToggle,
  onOpen,
}: {
  occurrence: Occurrence;
  index: number;
  categoryName: string | undefined;
  categoryIcon: string | undefined;
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
      style={{ '--i': index } as CSSProperties}
      className={cn(
        'anim-rise group relative flex cursor-pointer items-center gap-3 rounded-2xl border p-3 pe-3.5 shadow-card',
        'transition-[border-color,box-shadow,transform,background-color] duration-200 hover:-translate-y-px hover:shadow-lift active:translate-y-0 active:scale-[0.995]',
        overdue
          ? 'border-danger/40 bg-[color-mix(in_oklab,var(--c-danger)_5%,var(--c-surface))]'
          : 'border-line bg-surface hover:border-accent-300/70 dark:hover:border-accent-700/60',
      )}
    >
      <CategoryTile
        icon={categoryIcon}
        color={color}
        className={cn('transition-opacity duration-300', checked && 'opacity-50')}
      />

      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-medium transition-colors duration-300', checked && 'text-fg-2')}>
          {/* Strike-through draws across the title when the row is settled. */}
          <span
            className={cn(
              'bg-no-repeat transition-[background-size] duration-300 ease-out',
              'bg-[linear-gradient(currentColor,currentColor)] bg-[position:0_58%] rtl:bg-[position:100%_58%]',
              checked ? 'bg-[length:100%_1.5px]' : 'bg-[length:0%_1.5px]',
            )}
          >
            {reminder.title}
          </span>
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-2">
          <span className={cn(overdue && 'font-medium text-danger')}>
            {localDate.formatDate(date)} · {localDate.relative(date)}
          </span>
          {categoryName && <span>· {categoryName}</span>}
          {reminder.amount !== undefined && (
            <span className="font-medium text-fg-1/80">
              · {formatNumber(reminder.amount, lang)}
              {reminder.currency ? ` ${reminder.currency}` : ''}
            </span>
          )}
        </div>
      </div>

      <CheckButton
        checked={checked}
        onToggle={onToggle}
        label={t(checked ? 'dashboard.uncheck' : 'detail.markDone')}
      />
    </div>
  );
}

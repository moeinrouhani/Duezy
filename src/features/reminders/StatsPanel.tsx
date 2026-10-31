import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { ChartNoAxesColumn } from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { useReminders, useCategories } from '../../hooks/useReminders';
import { useCompletions } from '../../hooks/useCompletions';
import { useCountUp } from '../../hooks/useCountUp';
import { computeStats } from '../../domain/stats';
import { CATEGORY_COLOR_HEX } from '../../themes/accents';
import { formatNumber } from '../../utils/digits';
import { useLocalDate } from '../../hooks/useLocalDate';
import { cn } from '../../utils/cn';

type StatsWindow = 7 | 30 | 90;

/** A stat tile whose number counts up when it appears or changes. */
function StatCard({
  label,
  value,
  suffix,
  danger,
  index,
  lang,
}: {
  label: string;
  /** null renders a dash (nothing to measure yet). */
  value: number | null;
  suffix?: string;
  danger?: boolean;
  index: number;
  lang: 'en' | 'fa';
}) {
  const shown = useCountUp(value ?? 0);
  return (
    <div
      style={{ '--i': index } as CSSProperties}
      className="anim-rise rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <p className="text-xs text-fg-2">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold tabular-nums tracking-tight', danger && 'text-danger')}>
        {value === null ? '—' : `${formatNumber(shown, lang)}${suffix ?? ''}`}
      </p>
    </div>
  );
}

/**
 * Statistics body, embedded as the Reminders screen's second tab.
 */
export function StatsPanel() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fa';
  const localDate = useLocalDate();
  const { reminders } = useReminders();
  const { categories } = useCategories();
  const completions = useCompletions();

  const [windowDays, setWindowDays] = useState<StatsWindow>(30);
  const stats = useMemo(
    () => computeStats(reminders, completions, windowDays),
    [reminders, completions, windowDays],
  );
  const maxDay = Math.max(1, ...stats.series.map((day) => day.count));
  const chartLabel =
    windowDays === 7 ? t('stats.last7Label') : windowDays === 30 ? t('stats.last30Label') : t('stats.last90Label');

  if (stats.dueCount === 0 && reminders.length === 0) {
    return <EmptyState icon={<ChartNoAxesColumn size={26} aria-hidden />} title={t('stats.noData')} />;
  }

  return (
    <div>
      <SegmentedControl<StatsWindow>
        label={t('stats.title')}
        value={windowDays}
        onChange={setWindowDays}
        options={[
          { value: 7, label: t('stats.days7') },
          { value: 30, label: t('stats.days30') },
          { value: 90, label: t('stats.days90') },
        ]}
      />

      {/* Every card is scoped to the selected window and counted per
          occurrence — a due-but-unsettled reminder counts as missed in any
          window that reaches it. */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <StatCard index={0} lang={lang} label={t('stats.dueLabel')} value={stats.dueCount} />
        <StatCard index={1} lang={lang} label={t('stats.settledLabel')} value={stats.settledCount} />
        <StatCard index={2} lang={lang} label={t('stats.overdueLabel')} value={stats.missedCount} danger={stats.missedCount > 0} />
        <StatCard index={3} lang={lang} label={t('stats.onTimeLabel')} value={stats.onTimeRate} suffix="%" />
      </div>

      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-xs font-semibold text-fg-2">{chartLabel}</h2>
          <p className="text-xs text-fg-2">
            {t('stats.streakLabel')}: <span className="font-semibold text-fg-1">{formatNumber(stats.streak, lang)}</span>
          </p>
        </div>
        <div
          className="flex h-28 items-end gap-[3px] rounded-2xl border border-line bg-surface p-3 shadow-card"
          role="img"
          aria-label={chartLabel}
        >
          {stats.series.map((day, i) => (
            <div
              key={day.date}
              title={`${localDate.formatDate(day.date)}: ${formatNumber(day.count, lang)}`}
              style={{ height: `${Math.max((day.count / maxDay) * 100, 6)}%`, '--i': i } as CSSProperties}
              className={cn(
                // Bars grow from the baseline, left to right in time order.
                'anim-grow-y flex-1 rounded-sm transition-colors duration-200',
                day.count > 0 ? 'bg-accent-500 hover:bg-accent-600 dark:bg-accent-400 dark:hover:bg-accent-300' : 'bg-surface-2',
              )}
            />
          ))}
        </div>
      </section>

      {stats.byCategory.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 px-1 text-xs font-semibold text-fg-2">{t('stats.byCategoryLabel')}</h2>
          <ul className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface p-4 shadow-card">
            {stats.byCategory.map(({ categoryId, count }, i) => {
              const category = categories.find((c) => c.id === categoryId);
              const color = CATEGORY_COLOR_HEX[category?.color ?? 'teal'];
              const name = category ? (category.nameKey ? t(category.nameKey) : category.name) : '—';
              const width = `${(count / stats.byCategory[0].count) * 100}%`;
              return (
                <li key={categoryId} className="flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0 truncate text-fg-2">{name}</span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <span
                      className="anim-grow-x block h-full rounded-full"
                      style={{ width, backgroundColor: color, '--i': i } as CSSProperties}
                    />
                  </span>
                  <span className="w-8 text-end tabular-nums">{formatNumber(count, lang)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

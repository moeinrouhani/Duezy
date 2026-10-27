import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChartNoAxesColumn } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { getRepositories } from '../../repositories';
import { useReminders, useCategories } from '../../hooks/useReminders';
import { computeStats } from '../../domain/stats';
import { CATEGORY_COLOR_HEX } from '../../themes/accents';
import { formatNumber } from '../../utils/digits';
import { useLocalDate } from '../../hooks/useLocalDate';
import { cn } from '../../utils/cn';

export function StatsScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fa';
  const { reminders } = useReminders();
  const { categories } = useCategories();
  const localDate = useLocalDate();
  const [completions, setCompletions] = useState<Awaited<ReturnType<typeof getCompletions>>>([]);

  async function getCompletions() {
    const repos = await getRepositories();
    return repos.completions.listAll();
  }

  useEffect(() => {
    void getCompletions().then(setCompletions);
  }, [reminders]);

  const stats = useMemo(() => computeStats(reminders, completions), [reminders, completions]);
  const maxDay = Math.max(1, ...stats.last30.map((day) => day.count));

  if (stats.completedTotal === 0 && stats.activeCount === 0) {
    return (
      <div>
        <PageHeader title={t('stats.title')} />
        <EmptyState icon={<ChartNoAxesColumn size={26} aria-hidden />} title={t('stats.noData')} />
      </div>
    );
  }

  const cards = [
    { label: t('stats.activeLabel'), value: stats.activeCount },
    { label: t('stats.overdueLabel'), value: stats.overdueCount, danger: true },
    { label: t('stats.completedLabel'), value: stats.completedTotal },
    {
      label: t('stats.onTimeLabel'),
      value: stats.onTimeRate === null ? '—' : `${stats.onTimeRate}%`,
    },
  ];

  return (
    <div>
      <PageHeader title={t('stats.title')} />

      <div className="grid grid-cols-2 gap-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-xs text-fg-2">{card.label}</p>
            <p className={cn('mt-1 text-2xl font-bold', card.danger && stats.overdueCount > 0 && 'text-danger')}>
              {typeof card.value === 'number' ? formatNumber(card.value, lang) : card.value}
            </p>
          </div>
        ))}
      </div>

      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-xs font-semibold text-fg-2">{t('stats.last30Label')}</h2>
          <p className="text-xs text-fg-2">
            {t('stats.streakLabel')}: <span className="font-semibold text-fg-1">{formatNumber(stats.streak, lang)}</span>
          </p>
        </div>
        <div className="flex h-24 items-end gap-[3px] rounded-2xl border border-line bg-surface p-3" role="img" aria-label={t('stats.last30Label')}>
          {stats.last30.map((day) => (
            <div
              key={day.date}
              title={`${localDate.formatDate(day.date)}: ${day.count}`}
              className={cn(
                'flex-1 rounded-sm transition-all',
                day.count > 0 ? 'bg-accent-500 dark:bg-accent-400' : 'bg-surface-2',
              )}
              style={{ height: `${Math.max((day.count / maxDay) * 100, 6)}%` }}
            />
          ))}
        </div>
      </section>

      {stats.byCategory.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 px-1 text-xs font-semibold text-fg-2">{t('stats.byCategoryLabel')}</h2>
          <ul className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
            {stats.byCategory.map(({ categoryId, count }) => {
              const category = categories.find((c) => c.id === categoryId);
              const color = CATEGORY_COLOR_HEX[category?.color ?? 'teal'];
              const name = category ? (category.nameKey ? t(category.nameKey) : category.name) : '—';
              const width = `${(count / stats.byCategory[0].count) * 100}%`;
              return (
                <li key={categoryId} className="flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0 truncate text-fg-2">{name}</span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <span className="block h-full rounded-full" style={{ width, backgroundColor: color }} />
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

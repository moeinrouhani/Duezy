import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, SearchX } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { ReminderCard } from '../home/ReminderCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { useReminders } from '../../hooks/useReminders';
import { useCategories } from '../../hooks/useReminders';
import { sortReminders } from '../../utils/sortReminders';
import { toLatinDigits } from '../../utils/digits';

export function SearchScreen() {
  const { t } = useTranslation();
  const { reminders, complete } = useReminders();
  const { categories } = useCategories();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const normalized = toLatinDigits(query.trim().toLowerCase());
    if (!normalized) return [];
    return sortReminders(
      reminders.filter((reminder) => {
        const category = categories.find((c) => c.id === reminder.categoryId);
        const haystack = [
          reminder.title,
          reminder.notes ?? '',
          category ? (category.nameKey ? t(category.nameKey) : (category.name ?? '')) : '',
          reminder.amount?.toString() ?? '',
        ]
          .join('\n')
          .toLowerCase();
        return haystack.includes(normalized);
      }),
    );
  }, [reminders, categories, query, t]);

  return (
    <div>
      <PageHeader title={t('search.title')} />
      <div className="relative mb-4">
        <Search size={17} className="pointer-events-none absolute inset-y-0 top-1/2 start-3.5 -translate-y-1/2 text-fg-2" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('search.placeholder')}
          aria-label={t('search.title')}
          autoFocus
          className="w-full rounded-2xl border border-line bg-surface py-3 ps-10 pe-4 text-sm text-fg-1 placeholder:text-fg-2/70 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30"
        />
      </div>

      {query.trim() === '' ? null : results.length === 0 ? (
        <EmptyState icon={<SearchX size={26} aria-hidden />} title={t('search.empty')} body={t('search.emptyHint')} />
      ) : (
        <>
          <p className="mb-2 px-1 text-xs text-fg-2">{t('search.results_other', { count: results.length })}</p>
          <div className="flex flex-col gap-2">
            {results.map((reminder) => (
              <ReminderCard key={reminder.id} reminder={reminder} onComplete={(id) => void complete(id)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

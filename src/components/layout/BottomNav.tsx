import { useTranslation } from 'react-i18next';
import { NavLink, useNavigate } from 'react-router';
import { House, ListChecks, Plus, SlidersHorizontal, Tags } from 'lucide-react';
import { cn } from '../../utils/cn';

const ITEMS = [
  { to: '/', icon: House, key: 'nav.dashboard' },
  { to: '/reminders', icon: ListChecks, key: 'nav.reminders' },
] as const;

const END_ITEMS = [
  { to: '/categories', icon: Tags, key: 'nav.categories' },
  { to: '/settings', icon: SlidersHorizontal, key: 'nav.settings' },
] as const;

export function BottomNav() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const renderItem = ({ to, icon: Icon, key }: (typeof ITEMS)[number] | (typeof END_ITEMS)[number]) => (
    <NavLink
      key={to}
      to={to}
      end={to === '/'}
      aria-label={t(key)}
      className={({ isActive }) =>
        cn(
          'group flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[0.65rem] font-medium transition-colors duration-200 active:scale-95',
          isActive ? 'text-accent-600 dark:text-accent-400' : 'text-fg-2 hover:text-fg-1',
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* The pill grows out of the icon when the tab becomes active. */}
          <span className="relative flex h-7 w-12 items-center justify-center">
            <span
              aria-hidden
              className={cn(
                'absolute inset-0 rounded-full bg-accent-100 transition-[transform,opacity] duration-300 ease-[var(--ease-spring)] dark:bg-accent-950',
                isActive ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
              )}
            />
            <Icon
              size={20}
              strokeWidth={isActive ? 2.3 : 2}
              aria-hidden
              className={cn('relative transition-transform duration-300 ease-[var(--ease-spring)]', isActive && '-translate-y-px scale-110')}
            />
          </span>
          {t(key)}
        </>
      )}
    </NavLink>
  );

  return (
    <nav
      aria-label={t('nav.dashboard')}
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/90 backdrop-blur-xl md:hidden"
    >
      <div className="mx-auto flex max-w-md items-stretch px-2">
        {ITEMS.map(renderItem)}
        <div className="relative flex w-16 items-start justify-center">
          <button
            onClick={() => navigate('/reminder/new')}
            aria-label={t('nav.add')}
            className="group absolute -top-6 flex h-14 w-14 items-center justify-center rounded-full bg-accent-600 text-white shadow-lg shadow-accent-600/35 ring-4 ring-bg transition-[transform,background-color,box-shadow] duration-200 ease-[var(--ease-spring)] hover:bg-accent-700 active:scale-90 dark:bg-accent-500 dark:hover:bg-accent-600"
          >
            <Plus size={26} aria-hidden className="transition-transform duration-300 ease-[var(--ease-spring)] group-hover:rotate-90" />
          </button>
        </div>
        {END_ITEMS.map(renderItem)}
      </div>
    </nav>
  );
}

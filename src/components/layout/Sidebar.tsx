import { useTranslation } from 'react-i18next';
import { NavLink, useNavigate } from 'react-router';
import { House, ListChecks, Plus, SlidersHorizontal, Tags } from 'lucide-react';
import { cn } from '../../utils/cn';

const NAV = [
  { to: '/', icon: House, key: 'nav.dashboard', end: true },
  { to: '/reminders', icon: ListChecks, key: 'nav.reminders' },
  { to: '/categories', icon: Tags, key: 'nav.categories' },
  { to: '/settings', icon: SlidersHorizontal, key: 'nav.settings' },
] as const;

/** Desktop-only persistent navigation. */
export function Sidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-e border-line bg-surface/80 px-3 py-5 backdrop-blur-xl md:flex">
      <div className="mb-6 flex items-center gap-2.5 px-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl ">
          <img
            src="/icons/favicon.svg"
            alt="App logo"
            // className="h-[18px] w-[18px]"
          />
        </span>
        <div>
          <p className="text-base leading-tight font-bold tracking-tight">{t('app.name')}</p>
          <p className="text-[0.7rem] leading-tight text-fg-2">{t('app.tagline')}</p>
        </div>
      </div>

      <button
        onClick={() => navigate('/reminder/new')}
        className="group mb-4 flex h-10 items-center justify-center gap-2 rounded-xl bg-accent-600 text-sm font-medium text-white shadow-sm shadow-accent-600/25 transition-[transform,background-color,box-shadow] duration-150 hover:bg-accent-700 hover:shadow-md hover:shadow-accent-600/30 active:scale-[0.97] dark:bg-accent-500 dark:hover:bg-accent-600"
      >
        <Plus size={16} aria-hidden className="transition-transform duration-300 ease-[var(--ease-spring)] group-hover:rotate-90" />
        {t('nav.add')}
      </button>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map(({ to, icon: Icon, key, ...rest }) => (
          <NavLink
            key={to}
            to={to}
            {...rest}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200',
                isActive
                  ? 'bg-accent-50 text-accent-700 dark:bg-accent-950 dark:text-accent-300'
                  : 'text-fg-2 hover:bg-surface-2 hover:text-fg-1',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  aria-hidden
                  className={cn(
                    'absolute inset-y-2.5 start-0 w-[3px] rounded-full bg-accent-600 transition-[transform,opacity] duration-300 ease-[var(--ease-out)] dark:bg-accent-400',
                    isActive ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0',
                  )}
                />
                <Icon size={18} aria-hidden className="transition-transform duration-200 group-hover:scale-110" />
                {t(key)}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <p className="px-3 text-[0.65rem] text-fg-2">{t('settings.versionLabel')} {__APP_VERSION__}</p>
    </aside>
  );
}

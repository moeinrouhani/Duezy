import { useTranslation } from 'react-i18next';
import { NavLink, useNavigate } from 'react-router';
import {
  ChevronLeft,
  ChevronRight,
  House,
  ListChecks,
  Plus,
  SlidersHorizontal,
  Tags,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useLayoutStore } from '../../stores/layoutStore';

const NAV = [
  { to: '/', icon: House, key: 'nav.dashboard', end: true },
  { to: '/reminders', icon: ListChecks, key: 'nav.reminders' },
  { to: '/categories', icon: Tags, key: 'nav.categories' },
  { to: '/settings', icon: SlidersHorizontal, key: 'nav.settings' },
] as const;

/**
 * Text that fades and slides away when the rail is collapsed. It never
 * wraps and stays in the DOM, so nothing reflows mid-animation — the
 * sidebar's own `overflow-hidden` simply clips it as the width shrinks.
 */
function RailLabel({ collapsed, children, className }: { collapsed: boolean; children: React.ReactNode; className?: string }) {
  return (
    <span
      aria-hidden={collapsed}
      className={cn(
        'whitespace-nowrap transition-[opacity,transform] duration-200 ease-[var(--ease-out)]',
        collapsed ? 'pointer-events-none -translate-x-1 opacity-0 rtl:translate-x-1' : 'opacity-100 delay-100',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Desktop-only persistent navigation, collapsible to an icon rail via a floating edge button. */
export function Sidebar() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const collapsed = useLayoutStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useLayoutStore((s) => s.toggleSidebar);

  // The chevron points toward the edge the sidebar sits on (collapse direction)
  // and turns around when collapsed — one icon, so the flip can animate.
  const ToggleIcon = i18n.dir() === 'rtl' ? ChevronRight : ChevronLeft;
  const toggleLabel = t(collapsed ? 'nav.expand' : 'nav.collapse');

  return (
    // Fixed icon column: 12px aside padding + 12px item padding + 24px icon box
    // puts every icon's centre 36px from the edge — exactly the middle of the
    // 72px rail — so icons stay perfectly still while the width animates.
    // The wrapper owns size/position and does NOT clip, so the floating toggle
    // can straddle the edge; the inner <aside> clips the labels while it animates.
    <div
      data-collapsed={collapsed}
      className={cn(
        'sticky top-0 z-40 hidden h-dvh shrink-0 md:block',
        'transition-[width] duration-300 ease-[var(--ease-out)] motion-reduce:transition-none',
        collapsed ? 'w-[4.5rem]' : 'w-60',
      )}
    >
    <aside className="flex h-full w-full flex-col overflow-hidden border-e border-line bg-surface/80 px-3 py-5 backdrop-blur-xl">
      <div className="mb-6 flex items-center gap-2.5 px-1.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
          <img src="/icons/favicon.svg" alt="" aria-hidden />
        </span>
        <div aria-hidden={collapsed}>
          <RailLabel collapsed={collapsed} className="block text-base leading-tight font-bold tracking-tight">
            {t('app.name')}
          </RailLabel>
          <RailLabel collapsed={collapsed} className="block text-[0.7rem] leading-tight text-fg-2">
            {t('app.tagline')}
          </RailLabel>
        </div>
      </div>

      <button
        onClick={() => navigate('/reminder/new')}
        aria-label={t('nav.add')}
        title={collapsed ? t('nav.add') : undefined}
        className="group mb-4 flex h-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-accent-600 text-sm font-medium text-white shadow-sm shadow-accent-600/25 transition-[transform,background-color,box-shadow] duration-150 hover:bg-accent-700 hover:shadow-md hover:shadow-accent-600/30 active:scale-[0.97] dark:bg-accent-500 dark:hover:bg-accent-600"
      >
        <Plus size={16} aria-hidden className="shrink-0 transition-transform duration-300 ease-[var(--ease-spring)] group-hover:rotate-90" />
        {/* max-width (not display) so the label's room is released smoothly. */}
        <span
          aria-hidden={collapsed}
          className={cn(
            'overflow-hidden whitespace-nowrap transition-[max-width,opacity,margin] duration-300 ease-[var(--ease-out)]',
            collapsed ? 'ms-0 max-w-0 opacity-0' : 'ms-2 max-w-40 opacity-100',
          )}
        >
          {t('nav.add')}
        </span>
      </button>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map(({ to, icon: Icon, key, ...rest }) => (
          <NavLink
            key={to}
            to={to}
            {...rest}
            aria-label={t(key)}
            title={collapsed ? t(key) : undefined}
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
                <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                  <Icon size={18} aria-hidden className="transition-transform duration-200 group-hover:scale-110" />
                </span>
                <RailLabel collapsed={collapsed}>{t(key)}</RailLabel>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <p
        aria-hidden={collapsed}
        className={cn(
          'mb-2 px-3 text-[0.65rem] whitespace-nowrap text-fg-2 transition-opacity duration-200',
          collapsed ? 'opacity-0' : 'opacity-100 delay-100',
        )}
      >
        {t('settings.versionLabel')} {__APP_VERSION__}
      </p>

    </aside>

    {/* Floating edge toggle, centred on the sidebar's border (logical inset → mirrors in RTL). */}
    <button
      type="button"
      onClick={toggleSidebar}
      aria-label={toggleLabel}
      aria-expanded={!collapsed}
      title={toggleLabel}
      className="absolute bottom-6 -end-3.5 flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface text-fg-2 shadow-sm transition-[color,background-color,box-shadow,transform] duration-200 hover:bg-surface-2 hover:text-fg-1 hover:shadow-md active:scale-90"
    >
      <ToggleIcon
        size={15}
        aria-hidden
        className={cn(
          'transition-transform duration-300 ease-[var(--ease-out)] motion-reduce:transition-none',
          collapsed && 'rotate-180',
        )}
      />
    </button>
    </div>
  );
}

import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { Snackbar } from '../ui/Snackbar';
import { ConfirmDialog } from '../ui/ConfirmDialog';

/** Global keyboard shortcuts: n = new reminder, / = search. */
function useKeyboardShortcuts() {
  const navigate = useNavigate();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'n') {
        event.preventDefault();
        navigate('/reminder/new');
      } else if (event.key === '/') {
        event.preventDefault();
        navigate('/reminders');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);
}

export function AppShell() {
  useKeyboardShortcuts();
  const location = useLocation();

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      {/* Standalone PWA on notched phones draws under the status bar
          (viewport-fit=cover) — pad the content clear of it. */}
      <main className="min-w-0 flex-1 pt-[env(safe-area-inset-top)]">
        {/* Keyed by path: every navigation remounts the page and replays the entrance. */}
        <div
          key={location.pathname}
          className="anim-page mx-auto w-full max-w-xl px-4 pt-4 pb-28 sm:max-w-2xl md:pb-10"
        >
          <Outlet />
        </div>
      </main>
      <BottomNav />
      <Snackbar />
      <ConfirmDialog />
    </div>
  );
}

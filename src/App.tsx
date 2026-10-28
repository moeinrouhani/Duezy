import { useEffect } from 'react';
import { createHashRouter, Navigate, RouterProvider } from 'react-router';
import { AppShell } from './components/layout/AppShell';
import { DashboardScreen } from './features/dashboard/DashboardScreen';
import { RemindersScreen } from './features/reminders/RemindersScreen';
import { SettingsScreen } from './features/settings/SettingsScreen';
import { CategoriesScreen } from './features/categories/CategoriesScreen';
import { ReminderForm } from './features/reminder-form/ReminderForm';
import { ReminderDetailScreen } from './features/reminder-detail/ReminderDetailScreen';
import { AuthScreen } from './features/auth/AuthScreen';
import { useTheme } from './hooks/useTheme';
import { useNotificationScheduler } from './hooks/useNotificationScheduler';
import { useAuthStore } from './stores/authStore';
import { useReminderStore } from './stores/dataStores';
import { installSyncTriggers, syncNow } from './sync/engine';

/** Exported so main.tsx can route service-worker deep-links into the app. */
export const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardScreen /> },
      { path: 'reminders', element: <RemindersScreen /> },
      { path: 'settings', element: <SettingsScreen /> },
      { path: 'categories', element: <CategoriesScreen /> },
      { path: 'reminder/new', element: <ReminderForm /> },
      { path: 'reminder/:id', element: <ReminderDetailScreen /> },
      { path: 'reminder/:id/edit', element: <ReminderForm /> },
      // Screens merged away — old deep links land on their replacements.
      { path: 'calendar', element: <Navigate to="/" replace /> },
      { path: 'search', element: <Navigate to="/reminders" replace /> },
      { path: 'stats', element: <Navigate to="/reminders" replace /> },
    ],
  },
  { path: '/auth', element: <AuthScreen /> },
]);

/** Re-sync the mirror store when the tab regains focus (multi-tab LWW). */
function useFocusRefresh() {
  const refresh = useReminderStore((s) => s.refresh);
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [refresh]);
}

export default function App() {
  useTheme();
  useNotificationScheduler();
  useFocusRefresh();
  useSyncBootstrap();

  return <RouterProvider router={router} />;
}

/** Restore the cookie session (if any), then sync; register lifecycle triggers once. */
function useSyncBootstrap() {
  const refreshMe = useAuthStore((s) => s.refreshMe);
  useEffect(() => {
    installSyncTriggers();
    void (async () => {
      await refreshMe();
      if (useAuthStore.getState().user) void syncNow();
    })();
  }, [refreshMe]);
}

import { useEffect } from 'react';
import { createHashRouter, RouterProvider } from 'react-router';
import { AppShell } from './components/layout/AppShell';
import { HomeScreen } from './features/home/HomeScreen';
import { CalendarScreen } from './features/calendar/CalendarScreen';
import { SearchScreen } from './features/search/SearchScreen';
import { StatsScreen } from './features/stats/StatsScreen';
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
      { index: true, element: <HomeScreen /> },
      { path: 'calendar', element: <CalendarScreen /> },
      { path: 'search', element: <SearchScreen /> },
      { path: 'stats', element: <StatsScreen /> },
      { path: 'settings', element: <SettingsScreen /> },
      { path: 'categories', element: <CategoriesScreen /> },
      { path: 'reminder/new', element: <ReminderForm /> },
      { path: 'reminder/:id', element: <ReminderDetailScreen /> },
      { path: 'reminder/:id/edit', element: <ReminderForm /> },
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

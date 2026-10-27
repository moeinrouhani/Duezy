import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Settings } from '../domain/types';
import { DEFAULT_SETTINGS, defaultCalendarFor, defaultWeekStartFor } from '../domain/defaults';

interface SettingsState {
  settings: Settings;
  /** False until the user manually picks a calendar / week start. */
  calendarTouched: boolean;
  weekStartTouched: boolean;
  update: (patch: Partial<Settings>) => void;
}

/**
 * Settings are the single source of truth for lang/theme/calendar and are
 * persisted to localStorage (synchronous rehydration → no theme flash; the
 * inline preboot script in index.html reads the same key).
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      calendarTouched: false,
      weekStartTouched: false,
      update: (patch) =>
        set((state) => {
          const next = { ...state.settings, ...patch };
          const nextFlags = {
            calendarTouched: state.calendarTouched || patch.calendar !== undefined,
            weekStartTouched: state.weekStartTouched || patch.weekStart !== undefined,
          };
          // Language change drags calendar/weekStart along only if untouched.
          if (patch.lang && !nextFlags.calendarTouched) {
            next.calendar = defaultCalendarFor(patch.lang);
          }
          if ((patch.lang && !nextFlags.weekStartTouched) || (patch.calendar && !nextFlags.weekStartTouched)) {
            next.weekStart = defaultWeekStartFor(next.calendar);
          }
          return { settings: next, ...nextFlags };
        }),
    }),
    { name: 'duezy-settings', version: 1 },
  ),
);

export function currentSettings(): Settings {
  return useSettingsStore.getState().settings;
}

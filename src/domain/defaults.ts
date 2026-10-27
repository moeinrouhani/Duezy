import type { Category, Reminder, ReminderDraft, Settings } from './types';
import { todayISO } from './date';
import { newId } from '../utils/id';

export const DEFAULT_SETTINGS: Settings = {
  lang: 'fa',
  calendar: 'jalali',
  themeMode: 'system',
  accent: 'teal',
  notifyTime: '09:00',
  notificationsEnabled: false,
  weekStart: 6,
  defaultAlertOffsets: [3, 0],
};

/** Default calendar for a language (used until the user overrides it). */
export function defaultCalendarFor(lang: Settings['lang']): Settings['calendar'] {
  return lang === 'fa' ? 'jalali' : 'gregorian';
}

export function defaultWeekStartFor(calendar: Settings['calendar']): Settings['weekStart'] {
  return calendar === 'jalali' ? 6 : 0;
}

/** Fixed ids so categories can be referenced before the DB seed runs. */
export const BUILT_IN_CATEGORY_IDS = {
  bills: 'cat-bills',
  vehicle: 'cat-vehicle',
  personal: 'cat-personal',
  other: 'cat-other',
} as const;

export function builtInCategories(now = new Date().toISOString()): Category[] {
  const base = { isBuiltIn: true, createdAt: now, updatedAt: now, deletedAt: null } as const;
  return [
    { ...base, id: BUILT_IN_CATEGORY_IDS.bills, nameKey: 'cat.bills', icon: 'receipt', color: 'amber', order: 0 },
    { ...base, id: BUILT_IN_CATEGORY_IDS.vehicle, nameKey: 'cat.vehicle', icon: 'car', color: 'blue', order: 1 },
    { ...base, id: BUILT_IN_CATEGORY_IDS.personal, nameKey: 'cat.personal', icon: 'user', color: 'violet', order: 2 },
    { ...base, id: BUILT_IN_CATEGORY_IDS.other, nameKey: 'cat.other', icon: 'tag', color: 'teal', order: 3 },
  ];
}

export function createReminder(draft: ReminderDraft, now = new Date().toISOString()): Reminder {
  return {
    ...draft,
    id: newId(),
    done: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

export function exampleDraftDefaults(categoryId: string) {
  return { dueDate: todayISO(), categoryId };
}

/**
 * Core domain types for Duezy.
 *
 * Invariants:
 * - All stored dates are Gregorian ISO strings ('YYYY-MM-DD') with LOCAL day
 *   semantics. Jalali conversion happens only at the display/picker boundary.
 * - Every persisted record carries createdAt/updatedAt and a soft-delete
 *   tombstone (deletedAt) so a future sync engine can do last-write-wins.
 */

/** Gregorian calendar date, 'YYYY-MM-DD', local semantics (never UTC-parsed). */
export type ISODate = string;

/** Full ISO datetime string (new Date().toISOString()). */
export type Timestamp = string;

export type Lang = 'fa' | 'en';
export type CalendarSystem = 'jalali' | 'gregorian';
export type AccentColor = 'teal' | 'emerald' | 'blue' | 'violet' | 'rose' | 'amber';
export type ThemeMode = 'light' | 'dark' | 'system';

/** 0 = Sunday … 6 = Saturday (matches Date#getDay). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Days before the due date an alert may fire. 0 = on the day itself. */
export type AlertOffset = 0 | 1 | 3 | 7;

export interface Reminder {
  id: string;
  title: string;
  /** NEXT upcoming occurrence. For recurring reminders this is regenerated on completion. */
  dueDate: ISODate;
  notes?: string;
  /** Currency-agnostic value; optional. */
  amount?: number;
  /** Display-only free text ('تومان', '$', …). */
  currency?: string;
  categoryId: string;
  /** null = one-time reminder. */
  recurrence: RecurrenceRule | null;
  /**
   * Installments already settled before tracking began (bounded recurring
   * series only). Progress counts them; the rule's `after` count holds only
   * the REMAINING occurrences.
   */
  paidCount?: number;
  alerts: AlertPolicy;
  pinned: boolean;
  /** true when a one-time reminder is settled or a series is exhausted/skipped to end. */
  done: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: Timestamp | null;
}

export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrenceRule {
  freq: RecurrenceFreq;
  /** Every N periods; 1 = every period. */
  interval: number;
  /** freq='weekly' only; e.g. [6, 2] = Saturday + Tuesday. */
  byWeekday?: Weekday[];
  /**
   * Arithmetic basis for monthly/yearly steps. 'jalali' keeps the same Jalali
   * day-of-month (۳۱ آبان → ۳۰ آذر); 'gregorian' uses Gregorian month math.
   */
  calendar: CalendarSystem;
  /** Immutable series anchor — occurrence counting for `after` ends. */
  start: ISODate;
  end: RecurrenceEnd;
}

export type RecurrenceEnd =
  | { type: 'never' }
  | { type: 'on'; date: ISODate }
  | { type: 'after'; count: number };

export interface AlertPolicy {
  /** Days BEFORE due date; [] = in-app badge only. */
  offsets: AlertOffset[];
}

export interface CompletionRecord {
  id: string;
  reminderId: string;
  /** Which occurrence this record settles. */
  dueDateCompleted: ISODate;
  completedAt: Timestamp;
  /** Skipped occurrences count against streaks/stats. */
  skipped: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: Timestamp | null;
}

export interface Category {
  id: string;
  /** i18n key for built-in categories ('cat.bills'). */
  nameKey?: string;
  /** Raw label for user-created categories. */
  name?: string;
  /** Lucide icon name; resolved via ICON_MAP. */
  icon: string;
  color: AccentColor;
  order: number;
  isBuiltIn: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: Timestamp | null;
}

export interface Settings {
  lang: Lang;
  calendar: CalendarSystem;
  themeMode: ThemeMode;
  accent: AccentColor;
  /** 'HH:mm', 24h local time. */
  notifyTime: string;
  /** User intent; OS-level permission tracked separately. */
  notificationsEnabled: boolean;
  /** 0 = Sunday, 1 = Monday, 6 = Saturday. */
  weekStart: Weekday;
  /** Preselected offsets in the new-reminder form. */
  defaultAlertOffsets: AlertOffset[];
}

export interface ReminderDraft {
  title: string;
  dueDate: ISODate;
  notes?: string;
  amount?: number;
  currency?: string;
  categoryId: string;
  recurrence: RecurrenceRule | null;
  /** See Reminder.paidCount — bounded series only. */
  paidCount?: number;
  alerts: AlertPolicy;
  pinned: boolean;
}

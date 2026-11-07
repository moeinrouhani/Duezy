import type { AlertOffset, ISODate, Reminder } from './types';
import { addDaysISO, dateAtTime, daysUntil } from './date';

export type ReminderSection = 'overdue' | 'today' | 'upcoming' | 'done';

export interface AlertSlot {
  /** Stable identity used for dedupe: reminder + occurrence + offset. */
  id: string;
  reminderId: string;
  dueDate: ISODate;
  offset: AlertOffset;
  /** Absolute fire time: (dueDate − offset days) at the global notify time. */
  at: Date;
}

export function slotId(reminderId: string, dueDate: ISODate, offset: AlertOffset): string {
  return `${reminderId}:${dueDate}:${offset}`;
}

export function alertSlotDate(dueDate: ISODate, offset: AlertOffset, notifyTime: string): Date {
  return dateAtTime(addDaysISO(dueDate, -offset), notifyTime);
}

export function buildSlot(reminder: Reminder, offset: AlertOffset, notifyTime: string): AlertSlot {
  return {
    id: slotId(reminder.id, reminder.dueDate, offset),
    reminderId: reminder.id,
    dueDate: reminder.dueDate,
    offset,
    at: alertSlotDate(reminder.dueDate, offset, notifyTime),
  };
}

/**
 * All alert slots for active reminders (caller filters by time / fired-log).
 *
 * Slots scheduled BEFORE the reminder's current `updatedAt` are skipped: a
 * reminder created on its due day with 3/1/0-day offsets would otherwise fire
 * every already-past stage at once. Completion advances the occurrence and
 * bumps `updatedAt`, so retroactive stages of the regenerated date are cut
 * too; genuinely future stages are untouched.
 */
export function computeAlertSlots(reminders: Reminder[], notifyTime: string): AlertSlot[] {
  const slots: AlertSlot[] = [];
  for (const reminder of reminders) {
    if (reminder.done || reminder.deletedAt) continue;
    const existsSinceMs = Date.parse(reminder.updatedAt);
    for (const offset of reminder.alerts.offsets) {
      const slot = buildSlot(reminder, offset, notifyTime);
      if (Number.isFinite(existsSinceMs) && slot.at.getTime() < existsSinceMs) continue;
      slots.push(slot);
    }
  }
  return slots;
}

/** Where a reminder belongs on the home screen. */
export function sectionOf(reminder: Reminder): ReminderSection {
  if (reminder.done) return 'done';
  const du = daysUntil(reminder.dueDate);
  if (du < 0) return 'overdue';
  if (du === 0) return 'today';
  return 'upcoming';
}

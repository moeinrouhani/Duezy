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

/** All alert slots for active reminders (caller filters by time / fired-log). */
export function computeAlertSlots(reminders: Reminder[], notifyTime: string): AlertSlot[] {
  const slots: AlertSlot[] = [];
  for (const reminder of reminders) {
    if (reminder.done || reminder.deletedAt) continue;
    for (const offset of reminder.alerts.offsets) {
      slots.push(buildSlot(reminder, offset, notifyTime));
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

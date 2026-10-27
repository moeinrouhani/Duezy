import type { Reminder } from '../domain/types';
import type { ReminderSection } from '../domain/alerts';
import { compareISO } from '../domain/date';
import { sectionOf } from '../domain/alerts';

function byDue(a: Reminder, b: Reminder): number {
  return compareISO(a.dueDate, b.dueDate) || a.createdAt.localeCompare(b.createdAt);
}

/** Pinned first, then chronological. */
export function sortReminders(list: Reminder[]): Reminder[] {
  return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || byDue(a, b));
}

export function splitBySections(reminders: Reminder[]): Record<ReminderSection, Reminder[]> {
  const result: Record<ReminderSection, Reminder[]> = {
    overdue: [],
    today: [],
    upcoming: [],
    done: [],
  };
  for (const r of reminders) {
    if (r.deletedAt) continue;
    result[sectionOf(r)].push(r);
  }
  result.overdue = sortReminders(result.overdue);
  result.today = sortReminders(result.today);
  result.upcoming = sortReminders(result.upcoming);
  result.done = [...result.done].sort((a, b) => byDue(b, a));
  return result;
}

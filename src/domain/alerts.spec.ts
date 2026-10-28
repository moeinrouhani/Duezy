import { describe, expect, it } from 'vitest';
import { alertSlotDate, computeAlertSlots, sectionOf, slotId } from './alerts';
import type { Reminder } from './types';
import { todayISO } from './date';

function reminder(partial: Partial<Reminder>): Reminder {
  return {
    id: 'r1',
    title: 'Loan installment',
    dueDate: todayISO(),
    categoryId: 'cat-bills',
    recurrence: null,
    alerts: { offsets: [7, 3, 1, 0] },
    pinned: false,
    done: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    ...partial,
  };
}

describe('domain/alerts', () => {
  const notifyTime = '09:00';

  it('slot ids are stable and occurrence-specific', () => {
    expect(slotId('r1', '2026-05-10', 3)).toBe('r1:2026-05-10:3');
  });

  it('builds a slot per offset, scheduled notifyTime minus offset days', () => {
    const slots = computeAlertSlots(
      [reminder({ dueDate: '2026-05-10', alerts: { offsets: [3, 0] } })],
      notifyTime,
    );
    expect(slots).toHaveLength(2);
    const at3 = slots.find((s) => s.offset === 3)!;
    expect(at3.at.getFullYear()).toBe(2026);
    expect(at3.at.getMonth()).toBe(4); // May
    expect(at3.at.getDate()).toBe(7); // 10 − 3
    expect(at3.at.getHours()).toBe(9);
    expect(at3.at.getMinutes()).toBe(0);
    const at0 = slots.find((s) => s.offset === 0)!;
    expect(at0.at.getDate()).toBe(10);
  });

  it('skips done, deleted, and alert-less reminders', () => {
    const slots = computeAlertSlots(
      [
        reminder({ id: 'a', done: true }),
        reminder({ id: 'b', deletedAt: '2026-01-02T00:00:00.000Z' }),
        reminder({ id: 'c', alerts: { offsets: [] } }),
        reminder({ id: 'd' }),
      ],
      notifyTime,
    );
    expect(slots).toHaveLength(4);
    expect(slots.every((s) => s.reminderId === 'd')).toBe(true);
  });

  it('sections: overdue/today/upcoming/done', () => {
    const today = todayISO();
    expect(sectionOf(reminder({ dueDate: today }))).toBe('today');
    expect(sectionOf(reminder({ dueDate: '2100-01-01' }))).toBe('upcoming');
    expect(sectionOf(reminder({ dueDate: '2000-01-01' }))).toBe('overdue');
    expect(sectionOf(reminder({ done: true, dueDate: '2000-01-01' }))).toBe('done');
  });

  it('a reminder created one minute before its due-day stage alerts ONLY that stage', () => {
    // Anchored to the computed stage instants so it holds in any timezone.
    const dueDayStage = alertSlotDate('2026-06-10', 0, '09:00').getTime();
    const r = reminder({
      dueDate: '2026-06-10',
      alerts: { offsets: [3, 1, 0] },
      updatedAt: new Date(dueDayStage - 60_000).toISOString(),
    });
    expect(computeAlertSlots([r], '09:00').map((s) => s.offset)).toEqual([0]);
  });

  it('stages scheduled after the reminder existed are untouched', () => {
    const dueDayStage = alertSlotDate('2026-06-10', 0, '09:00').getTime();
    const r = reminder({
      dueDate: '2026-06-10',
      alerts: { offsets: [3, 1, 0] },
      updatedAt: new Date(dueDayStage - 4 * 86_400_000).toISOString(),
    });
    expect(computeAlertSlots([r], '09:00')).toHaveLength(3);
  });
});

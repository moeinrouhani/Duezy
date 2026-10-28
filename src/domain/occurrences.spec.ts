import { describe, expect, it } from 'vitest';
import type { CompletionRecord, Reminder } from './types';
import {
  addCalendarMonths,
  calendarMonthOf,
  calendarMonthRange,
  occurrencesBetween,
  reminderProgress,
  summarizeOccurrences,
} from './occurrences';
import { jalaliToISO } from './jalali';

function reminder(partial: Partial<Reminder>): Reminder {
  return {
    id: 'r1',
    title: 'Loan installment',
    dueDate: '2100-01-15',
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

function completion(partial: Partial<CompletionRecord>): CompletionRecord {
  return {
    id: 'c1',
    reminderId: 'r1',
    dueDateCompleted: '2100-01-15',
    completedAt: '2100-01-15T10:00:00.000Z',
    skipped: false,
    createdAt: '2100-01-15T10:00:00.000Z',
    updatedAt: '2100-01-15T10:00:00.000Z',
    deletedAt: null,
    ...partial,
  };
}

describe('domain/occurrences', () => {
  it('calendarMonthRange: jalali months map to their gregorian span', () => {
    const range = calendarMonthRange({ y: 1405, m: 8 }, 'jalali'); // Aban
    expect(range.start).toBe(jalaliToISO(1405, 8, 1));
    expect(range.end).toBe(jalaliToISO(1405, 8, 30));
  });

  it('calendarMonthRange: gregorian months, including leap February', () => {
    expect(calendarMonthRange({ y: 2028, m: 2 }, 'gregorian').end).toBe('2028-02-29');
    expect(calendarMonthRange({ y: 2027, m: 2 }, 'gregorian').end).toBe('2027-02-28');
  });

  it('calendarMonthOf + addCalendarMonths round-trip across year boundaries', () => {
    expect(calendarMonthOf('2026-10-28', 'gregorian')).toEqual({ y: 2026, m: 10 });
    expect(addCalendarMonths({ y: 2026, m: 10 }, 3)).toEqual({ y: 2027, m: 1 });
    expect(addCalendarMonths({ y: 2026, m: 10 }, -10)).toEqual({ y: 2025, m: 12 });
    expect(calendarMonthOf(jalaliToISO(1405, 8, 15), 'jalali')).toEqual({ y: 1405, m: 8 });
    expect(addCalendarMonths({ y: 1405, m: 8 }, -8)).toEqual({ y: 1404, m: 12 });
  });

  it('one-time reminders contribute exactly their dueDate when in range', () => {
    const r = reminder({ dueDate: '2100-01-10' });
    const rows = occurrencesBetween([r], [], '2100-01-01', '2100-01-31');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ date: '2100-01-10', checked: false, overdue: false });
    expect(occurrencesBetween([r], [], '2100-02-01', '2100-02-28')).toHaveLength(0);
  });

  it('a 5-month series shows only the months inside the range, checked per completion', () => {
    const r = reminder({
      dueDate: '2100-01-15',
      recurrence: {
        freq: 'monthly',
        interval: 1,
        calendar: 'gregorian',
        start: '2100-01-15',
        end: { type: 'after', count: 5 },
      },
    });
    const completions = [completion({ reminderId: r.id, dueDateCompleted: '2100-01-15' })];
    const rows = occurrencesBetween([r], completions, '2100-01-01', '2100-03-31');
    expect(rows.map((o) => o.date)).toEqual(['2100-01-15', '2100-02-15', '2100-03-15']);
    expect(rows[0].checked).toBe(true);
    expect(rows[1].checked).toBe(false);
  });

  it('tombstoned completions do not check an occurrence', () => {
    const r = reminder({ dueDate: '2100-01-15' });
    const completions = [
      completion({ reminderId: r.id, dueDateCompleted: '2100-01-15', deletedAt: '2100-01-16T00:00:00.000Z' }),
    ];
    expect(occurrencesBetween([r], completions, '2100-01-01', '2100-01-31')[0].checked).toBe(false);
  });

  it('past unpaid occurrences are overdue; done one-timers count as checked', () => {
    const overdue = occurrencesBetween([reminder({ dueDate: '2000-01-01' })], [], '2000-01-01', '2000-01-31');
    expect(overdue[0].overdue).toBe(true);
    const legacyDone = occurrencesBetween(
      [reminder({ dueDate: '2100-01-10', done: true })],
      [],
      '2100-01-01',
      '2100-01-31',
    );
    expect(legacyDone[0].checked).toBe(true);
  });

  it('summarizeOccurrences groups money by currency', () => {
    const a = reminder({ id: 'a', amount: 100, currency: '$' });
    const b = reminder({ id: 'b', amount: 50, currency: '$' });
    const c = reminder({ id: 'c', amount: 7000 });
    const rows = [
      { reminder: a, date: '2100-01-01', checked: true, overdue: false },
      { reminder: b, date: '2100-01-02', checked: false, overdue: false },
      { reminder: c, date: '2100-01-03', checked: false, overdue: false },
    ];
    const summary = summarizeOccurrences(rows);
    expect(summary.count).toBe(3);
    expect(summary.paidCount).toBe(1);
    expect(summary.money).toHaveLength(2);
    expect(summary.money.find((m) => m.currency === '$')).toMatchObject({ total: 150, paid: 100, unpaid: 50 });
    expect(summary.money.find((m) => m.currency === undefined)).toMatchObject({ total: 7000, unpaid: 7000 });
  });

  it('reminderProgress: after-count, on-date, never-ending, one-time', () => {
    const four = {
      freq: 'monthly' as const,
      interval: 1,
      calendar: 'gregorian' as const,
      start: '2100-01-15',
      end: { type: 'after' as const, count: 4 },
    };
    expect(reminderProgress(reminder({ recurrence: four }), 1)).toBe(0.25);
    expect(reminderProgress(reminder({ recurrence: four }), 9)).toBe(1);
    expect(reminderProgress(reminder({ recurrence: null }), 0)).toBe(0);
    expect(reminderProgress(reminder({ recurrence: null, done: true }), 0)).toBe(1);
    const forever = {
      freq: 'monthly' as const,
      interval: 1,
      calendar: 'gregorian' as const,
      start: '2100-01-15',
      end: { type: 'never' as const },
    };
    expect(reminderProgress(reminder({ recurrence: forever }), 3)).toBeNull();
    const until = {
      freq: 'yearly' as const,
      interval: 1,
      calendar: 'gregorian' as const,
      start: '2100-01-15',
      end: { type: 'on' as const, date: '2103-01-15' },
    };
    expect(reminderProgress(reminder({ recurrence: until }), 2)).toBe(0.5);
  });
});

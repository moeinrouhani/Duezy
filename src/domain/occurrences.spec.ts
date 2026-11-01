import { describe, expect, it } from 'vitest';
import type { CompletionRecord, Reminder } from './types';
import {
  addCalendarMonths,
  calendarMonthOf,
  calendarMonthRange,
  occurrenceAmount,
  occurrencesBetween,
  positionOfOccurrence,
  reminderProgress,
  seriesTotal,
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

  it('reminderProgress counts installments paid before tracking began', () => {
    const eight = {
      freq: 'monthly' as const,
      interval: 1,
      calendar: 'gregorian' as const,
      start: '2100-01-15',
      end: { type: 'after' as const, count: 8 },
    };
    // 2 paid of 10 total: starts at 20%, finishes after the 8 tracked ones.
    expect(reminderProgress(reminder({ recurrence: eight, paidCount: 2 }), 0)).toBeCloseTo(0.2);
    expect(reminderProgress(reminder({ recurrence: eight, paidCount: 2 }), 3)).toBeCloseTo(0.5);
    expect(reminderProgress(reminder({ recurrence: eight, paidCount: 2 }), 8)).toBe(1);
  });

  it('seriesTotal: after-count includes pre-tracking installments; on-date counts the series', () => {
    const after = {
      freq: 'monthly' as const,
      interval: 1,
      calendar: 'gregorian' as const,
      start: '2100-01-15',
      end: { type: 'after' as const, count: 8 },
    };
    expect(seriesTotal(after, 2)).toBe(10);
    expect(seriesTotal(after, 0)).toBe(8);
    const until = { ...after, end: { type: 'on' as const, date: '2100-04-15' } };
    expect(seriesTotal(until, 0)).toBe(4);
    const forever = { ...after, end: { type: 'never' as const } };
    expect(seriesTotal(forever, 0)).toBeUndefined();
  });

  it('occurrencesBetween numbers installments 1..total, pre-tracking ones included', () => {
    // A 10-installment loan: count holds only the REMAINING occurrences.
    const ten = {
      freq: 'monthly' as const,
      interval: 1,
      calendar: 'gregorian' as const,
      start: '2100-01-15',
      end: { type: 'after' as const, count: 10 },
    };
    const rows = occurrencesBetween([reminder({ recurrence: ten })], [], '2100-01-01', '2100-02-28');
    expect(rows.map((o) => o.position)).toEqual([
      { current: 1, total: 10 },
      { current: 2, total: 10 },
    ]);

    // Same 10-installment loan, but 2 were paid before tracking began
    // (8 remaining): this January is really #3 of 10.
    const tenWithPaid = { ...ten, end: { type: 'after' as const, count: 8 } };
    const rowsWithPaid = occurrencesBetween(
      [reminder({ recurrence: tenWithPaid, paidCount: 2 })],
      [],
      '2100-01-01',
      '2100-01-31',
    );
    expect(rowsWithPaid[0].position).toEqual({ current: 3, total: 10 });
  });

  it('occurrencesBetween leaves unbounded and one-time occurrences without a position', () => {
    const forever = {
      freq: 'monthly' as const,
      interval: 1,
      calendar: 'gregorian' as const,
      start: '2100-01-15',
      end: { type: 'never' as const },
    };
    const recurring = occurrencesBetween([reminder({ recurrence: forever })], [], '2100-01-01', '2100-01-31');
    expect(recurring[0].position).toBeUndefined();
    const oneTime = occurrencesBetween([reminder({ dueDate: '2100-01-20' })], [], '2100-01-01', '2100-01-31');
    expect(oneTime[0].position).toBeUndefined();
  });

  it('occurrenceAmount resolves per-installment overrides by installment number', () => {
    // A 10-installment loan with 2 pre-tracking payments: tracked slots are 3..10.
    const ten = {
      freq: 'monthly' as const,
      interval: 1,
      calendar: 'gregorian' as const,
      start: '2100-01-15',
      end: { type: 'after' as const, count: 8 },
    };
    const r = reminder({ recurrence: ten, paidCount: 2, amount: 1000, installmentAmounts: { '1': 500, '10': 2000 } });

    // Display numbers: the tracked series runs 3..10 of 10.
    expect(occurrenceAmount(r, { current: 1, total: 10 })).toBe(500); // pre-tracking, never rendered
    expect(occurrenceAmount(r, { current: 3, total: 10 })).toBe(1000);
    expect(occurrenceAmount(r, { current: 9, total: 10 })).toBe(1000);
    expect(occurrenceAmount(r, { current: 10, total: 10 })).toBe(2000);
    expect(occurrenceAmount(r)).toBe(1000); // unpositioned falls back to base
    expect(occurrenceAmount(reminder({ amount: 1000 }), { current: 1, total: 1 })).toBe(1000);
  });

  it('positionOfOccurrence places dueDate within the series', () => {
    // A 10-installment loan with 2 pre-tracking payments.
    const ten = {
      freq: 'monthly' as const,
      interval: 1,
      calendar: 'gregorian' as const,
      start: '2100-01-15',
      end: { type: 'after' as const, count: 8 },
    };
    expect(positionOfOccurrence(reminder({ recurrence: ten, paidCount: 2 }), '2100-01-15')).toEqual({
      current: 3,
      total: 10,
    });
    expect(positionOfOccurrence(reminder({ recurrence: ten, paidCount: 2 }), '2100-02-15')).toEqual({
      current: 4,
      total: 10,
    });
    expect(positionOfOccurrence(reminder({ recurrence: ten }), '2100-01-15')).toEqual({ current: 1, total: 8 });
    expect(positionOfOccurrence(reminder({ dueDate: '2100-01-15' }), '2100-01-15')).toBeNull();
  });

  it('summarizeOccurrences prices each occurrence with its override', () => {
    const r = reminder({
      amount: 1000,
      currency: '$',
      installmentAmounts: { '2': 3000 },
    });
    const rows = [
      { reminder: r, date: '2100-01-01', checked: true, overdue: false },
      { reminder: r, date: '2100-02-01', checked: false, overdue: false, amount: 3000 },
    ];
    const summary = summarizeOccurrences(rows);
    expect(summary.money[0]).toMatchObject({ total: 4000, paid: 1000, unpaid: 3000 });
  });
});

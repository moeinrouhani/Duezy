import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { DuezyDB } from '../db/db';
import { DexieReminderRepository } from './dexieReminderRepository';
import type { ReminderDraft } from '../domain/types';

/**
 * Regression tests for the dashboard's check/uncheck pointer dance: completing
 * an occurrence advances `dueDate`, and undoing it must walk the pointer back
 * — otherwise the series silently skips forward and the "next occurrences"
 * preview loses installments.
 */

let db: DuezyDB;
let repo: DexieReminderRepository;

const TEN_INSTALLMENTS: ReminderDraft = {
  title: 'Loan',
  dueDate: '2100-01-15',
  categoryId: 'cat-bills',
  recurrence: {
    freq: 'monthly',
    interval: 1,
    calendar: 'gregorian',
    start: '2100-01-15',
    end: { type: 'after', count: 10 },
  },
  alerts: { offsets: [] },
  pinned: false,
};

const month = (n: number): string => `2100-${String(n).padStart(2, '0')}-15`;

async function createLoan(): Promise<string> {
  const { id } = await repo.create({ ...TEN_INSTALLMENTS });
  return id;
}

beforeEach(async () => {
  db = new DuezyDB(`duezy-test-${Math.random().toString(36).slice(2)}`);
  await db.open();
  repo = new DexieReminderRepository(db);
});

describe('repositories/dexieReminderRepository occurrence undo', () => {
  it('check + uncheck of the current occurrence restores the due-date pointer', async () => {
    const id = await createLoan();

    await repo.completeOccurrence(id, month(1));
    expect((await repo.get(id))!.dueDate).toBe(month(2));

    const restored = await repo.undoOccurrence(id, month(1));
    expect(restored.dueDate).toBe(month(1));
    expect(restored.done).toBe(false);
  });

  it('unchecking a future occurrence never drags the pointer forward', async () => {
    const id = await createLoan();
    await repo.completeOccurrence(id, month(1)); // pointer → #2

    // Settling #4 ahead of the pointer leaves it where it is…
    await repo.completeOccurrence(id, month(4));
    expect((await repo.get(id))!.dueDate).toBe(month(2));
    // …and unchecking it must not skip the pointer past #2/#3.
    await repo.undoOccurrence(id, month(4));
    expect((await repo.get(id))!.dueDate).toBe(month(2));
  });

  it('unchecking in reverse order walks the pointer all the way back', async () => {
    const id = await createLoan();
    await repo.completeOccurrence(id, month(1));
    await repo.completeOccurrence(id, month(2));
    await repo.completeOccurrence(id, month(3));
    expect((await repo.get(id))!.dueDate).toBe(month(4));

    await repo.undoOccurrence(id, month(3));
    expect((await repo.get(id))!.dueDate).toBe(month(3));
    await repo.undoOccurrence(id, month(2));
    expect((await repo.get(id))!.dueDate).toBe(month(2));
    await repo.undoOccurrence(id, month(1));
    expect((await repo.get(id))!.dueDate).toBe(month(1));
  });

  it('unchecking the final occurrence revives a finished series at the same slot', async () => {
    const id = await createLoan();
    for (let m = 1; m <= 10; m++) await repo.completeOccurrence(id, month(m));
    expect((await repo.get(id))!.done).toBe(true);

    const revived = await repo.undoOccurrence(id, month(10));
    expect(revived.done).toBe(false);
    expect(revived.dueDate).toBe(month(10));
  });
});

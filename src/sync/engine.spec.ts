import { describe, expect, it } from 'vitest';
import { acceptRemote, filterChangedSince, shouldApplyRemote, toEnvelope } from './engine';
import { parseEnvelope, parseSince } from '../../api/_lib/sync';

interface Row {
  id: string;
  updatedAt: string;
}

describe('sync/engine merge rules', () => {
  const sinceMs = Date.parse('2026-10-27T09:00:00.000Z');

  it('filterChangedSince: full set when no marker, strictly-newer afterwards', () => {
    const rows: Row[] = [
      { id: 'a', updatedAt: '2026-10-27T08:00:00.000Z' },
      { id: 'b', updatedAt: '2026-10-27T09:00:00.000Z' }, // == marker → excluded
      { id: 'c', updatedAt: '2026-10-27T10:00:00.000Z' },
      { id: 'd', updatedAt: 'not-a-date' }, // unparsable → excluded
    ];
    expect(filterChangedSince(rows, null)).toHaveLength(4);
    expect(filterChangedSince(rows, sinceMs).map((r) => r.id)).toEqual(['c']);
  });

  it('shouldApplyRemote: remote must be strictly newer than local', () => {
    const local: Row = { id: 'a', updatedAt: '2026-10-27T09:00:00.000Z' };
    expect(shouldApplyRemote({ id: 'a', updatedAt: '2026-10-27T10:00:00.000Z' }, local)).toBe(true);
    expect(shouldApplyRemote({ id: 'a', updatedAt: '2026-10-27T09:00:00.000Z' }, local)).toBe(false); // echo
    expect(shouldApplyRemote({ id: 'a', updatedAt: '2026-10-27T08:00:00.000Z' }, local)).toBe(false);
    expect(shouldApplyRemote({ id: 'a', updatedAt: '2026-10-27T08:00:00.000Z' }, undefined)).toBe(true);
  });

  it('toEnvelope wraps the full record as the data payload', () => {
    const record = {
      id: 'r1',
      title: 'Loan installment',
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-27T10:00:00.000Z',
      deletedAt: null,
    };
    expect(toEnvelope(record)).toEqual({
      id: 'r1',
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-27T10:00:00.000Z',
      deletedAt: null,
      data: record,
    });
  });
});

describe('acceptRemote — pull merge against the full local table', () => {
  interface Row {
    id: string;
    updatedAt: string;
    deletedAt: string | null;
  }

  const live = (id: string, updatedAt: string): Row => ({ id, updatedAt, deletedAt: null });
  const tombstone = (id: string, updatedAt: string): Row => ({ id, updatedAt, deletedAt: updatedAt });

  it('a stale live copy must NOT resurrect a locally-deleted record', () => {
    // Category deleted on this device at 12:00; another device still holds
    // the pre-deletion copy (edited 08:00) and the server re-delivers it.
    const local = [tombstone('cat-1', '2026-10-27T12:00:00.000Z')];
    const remote = [live('cat-1', '2026-10-27T08:00:00.000Z')];
    expect(acceptRemote(local, remote)).toEqual([]);
  });

  it('a fresher remote tombstone replaces a live local row (deletion propagates)', () => {
    const local = [live('cat-1', '2026-10-27T08:00:00.000Z')];
    const remote = [tombstone('cat-1', '2026-10-27T12:00:00.000Z')];
    expect(acceptRemote(local, remote)).toEqual([tombstone('cat-1', '2026-10-27T12:00:00.000Z')]);
  });

  it('a genuinely fresher remote edit still wins over a stale local copy', () => {
    const local = [live('cat-1', '2026-10-27T08:00:00.000Z')];
    const remote = [live('cat-1', '2026-10-27T12:00:00.000Z')];
    expect(acceptRemote(local, remote)).toEqual([live('cat-1', '2026-10-27T12:00:00.000Z')]);
  });

  it('tombstones absent from the local list are still matched by id — the resurrection bug', () => {
    // The old bug: the local map was built from the UI's live-only list, so
    // the deleted category wasn't in it and ANY remote copy was accepted.
    const local: Row[] = []; // UI list() hides the tombstone
    const remote = [live('cat-1', '2026-10-27T08:00:00.000Z')];
    // With the tombstone missing entirely, acceptance is unavoidable — which
    // is exactly why the sync gather must pass the FULL table (listAll).
    expect(acceptRemote(local, remote)).toHaveLength(1);
  });

  it('malformed remote records are skipped, valid ones still applied', () => {
    const local = [live('a', '2026-10-27T08:00:00.000Z')];
    const remote = [
      { id: 'bad' }, // no updatedAt
      null,
      live('a', '2026-10-27T12:00:00.000Z'),
      { id: 'b', updatedAt: '2026-10-27T09:00:00.000Z' }, // new record → accepted
    ];
    expect(acceptRemote(local, remote)).toEqual([
      live('a', '2026-10-27T12:00:00.000Z'),
      { id: 'b', updatedAt: '2026-10-27T09:00:00.000Z' }, // passes through as-is
    ]);
  });
});

describe('api/_lib/sync envelope validation', () => {
  const valid = {
    id: 'abc-123',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-27T10:00:00.000Z',
    deletedAt: null,
    data: { title: 'Loan installment', dueDate: '2026-11-01' },
  };

  it('accepts a well-formed record and normalizes timestamps', () => {
    const parsed = parseEnvelope({ ...valid, updatedAt: '2026-10-27T13:30:00+03:30' }, 32_768);
    expect(parsed).not.toBeNull();
    expect(parsed?.updatedAt).toBe('2026-10-27T10:00:00.000Z');
  });

  it('treats undefined deletedAt as null', () => {
    const { deletedAt, ...withoutDeleted } = valid;
    expect(parseEnvelope(withoutDeleted, 32_768)?.deletedAt).toBeNull();
  });

  it('rejects bad ids, bad timestamps and oversized payloads', () => {
    expect(parseEnvelope({ ...valid, id: '' }, 32_768)).toBeNull();
    expect(parseEnvelope({ ...valid, id: 'has space' }, 32_768)).toBeNull();
    expect(parseEnvelope({ ...valid, updatedAt: 'not-a-date' }, 32_768)).toBeNull();
    expect(parseEnvelope({ ...valid, updatedAt: '2026-10-27' }, 32_768)).toBeNull(); // date, not datetime
    expect(parseEnvelope({ ...valid, deletedAt: 17 }, 32_768)).toBeNull();
    expect(parseEnvelope(valid, 10)).toBeNull(); // payload over the cap
    expect(parseEnvelope('nope', 32_768)).toBeNull();
  });

  it('rejects bare records without an object data payload (silent-sync killer)', () => {
    const { data, ...bare } = valid;
    expect(parseEnvelope(bare, 32_768)).toBeNull(); // no data at all
    expect(parseEnvelope({ ...valid, data: null }, 32_768)).toBeNull();
    expect(parseEnvelope({ ...valid, data: 'just a string' }, 32_768)).toBeNull();
    expect(parseEnvelope({ ...valid, data: [valid] }, 32_768)).toBeNull(); // array, not object
  });

  it('parses the since cursor (null = initial sync, undefined = invalid)', () => {
    expect(parseSince(null)).toBeNull();
    expect(parseSince(undefined)).toBeNull();
    expect(parseSince('2026-10-27T09:00:00.000Z')).toBe('2026-10-27T09:00:00.000Z');
    expect(parseSince('garbage')).toBeUndefined();
    expect(parseSince(42)).toBeUndefined();
  });
});

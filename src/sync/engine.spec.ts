import { describe, expect, it } from 'vitest';
import { filterNewer, shouldApplyRemote } from './engine';
import { parseEnvelope, parseSince } from '../../api/_lib/sync';

interface Row {
  id: string;
  updatedAt: string;
}

describe('sync/engine merge rules', () => {
  const since = '2026-10-27T09:00:00.000Z';

  it('filterNewer: full set on initial sync, strict > afterwards', () => {
    const rows: Row[] = [
      { id: 'a', updatedAt: '2026-10-27T08:00:00.000Z' },
      { id: 'b', updatedAt: '2026-10-27T09:00:00.000Z' }, // == cursor → excluded
      { id: 'c', updatedAt: '2026-10-27T10:00:00.000Z' },
    ];
    expect(filterNewer(rows, null)).toHaveLength(3);
    expect(filterNewer(rows, since).map((r) => r.id)).toEqual(['c']);
  });

  it('shouldApplyRemote: remote must be strictly newer than local', () => {
    const local: Row = { id: 'a', updatedAt: '2026-10-27T09:00:00.000Z' };
    expect(shouldApplyRemote({ id: 'a', updatedAt: '2026-10-27T10:00:00.000Z' }, local)).toBe(true);
    expect(shouldApplyRemote({ id: 'a', updatedAt: '2026-10-27T09:00:00.000Z' }, local)).toBe(false); // echo
    expect(shouldApplyRemote({ id: 'a', updatedAt: '2026-10-27T08:00:00.000Z' }, local)).toBe(false);
    expect(shouldApplyRemote({ id: 'a', updatedAt: '2026-10-27T08:00:00.000Z' }, undefined)).toBe(true);
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

  it('parses the since cursor (null = initial sync, undefined = invalid)', () => {
    expect(parseSince(null)).toBeNull();
    expect(parseSince(undefined)).toBeNull();
    expect(parseSince('2026-10-27T09:00:00.000Z')).toBe('2026-10-27T09:00:00.000Z');
    expect(parseSince('garbage')).toBeUndefined();
    expect(parseSince(42)).toBeUndefined();
  });
});

// @vitest-environment node
// (the Neon HTTP driver needs a node env — under jsdom it sees `window` and
// switches to its WebSocket path, which can't reach the database)
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import type { VercelRequest } from '@vercel/node';

/**
 * End-to-end probe of the sync server against a REAL Postgres.
 *
 * Reads DATABASE_URL from the repo-root .env (gitignored) or the process
 * environment; SKIPS when neither is present, so CI/plain test runs are
 * unaffected. Creates a throwaway user (cascade-deleted afterwards) and
 * verifies: schema bootstrap, session lifecycle, LWW upserts, and cursor
 * pulls — the exact code paths the deployed /api functions run.
 */

function loadDatabaseUrl(): string | null {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    // process.cwd(), not import.meta.url — jsdom's URL patch mangles file: bases.
    const raw = readFileSync(resolve(process.cwd(), '.env'), 'utf8');
    const line = raw.split('\n').find((l) => l.startsWith('DATABASE_URL='));
    const value = line?.slice('DATABASE_URL='.length).trim();
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

const DATABASE_URL = loadDatabaseUrl();
if (DATABASE_URL && !process.env.DATABASE_URL) process.env.DATABASE_URL = DATABASE_URL;

const hasDatabase = DATABASE_URL !== null;
const suite = hasDatabase ? describe : describe.skip;

suite('sync server integration', () => {
  let userId = '';
  let username = '';

  // Cascade delete wipes the probe's records and sessions with it.
  afterAll(async () => {
    if (!userId) return;
    const { getSql } = await import('./db.js');
    await getSql()`DELETE FROM users WHERE id = ${userId}`;
    // Sweep any probe users left behind by interrupted earlier runs.
    await getSql()`DELETE FROM users WHERE username ~ '^probe_[0-9a-f]{8}$'`;
  });

  it('boots the schema and runs a full push/pull/LWW round trip', { timeout: 120_000 }, async () => {
    const { ensureSchema, getSql } = await import('./db.js');
    const { hashPassword } = await import('./auth.js');
    const { parseEnvelope } = await import('./sync.js');
    const { pullRecords, upsertRecords, serverNowIso } = await import('./records.js');
    const { createSession, destroySession, getUserFromRequest } = await import('./session.js');

    await ensureSchema();
    console.log('[probe] schema ready');
    const sql = getSql();

    // -- user + session lifecycle -------------------------------------------
    userId = randomUUID();
    username = `probe_${randomUUID().slice(0, 8)}`;
    await sql`
      INSERT INTO users (id, username, display_name, password_hash)
      VALUES (${userId}, ${username}, ${'Sync Probe'}, ${await hashPassword('probe-password-123')})`;

    const token = await createSession(userId);
    const fakeReq = {
      headers: { cookie: `duezy_session=${token}` },
    } as unknown as VercelRequest;
    const sessionUser = await getUserFromRequest(fakeReq);
    expect(sessionUser?.id).toBe(userId);

    // -- push a reminder + category, then pull everything back ---------------
    const reminder = {
      id: `probe-r-${userId.slice(0, 8)}`,
      createdAt: '2026-10-27T08:00:00.000Z',
      updatedAt: '2026-10-27T09:00:00.000Z',
      deletedAt: null,
      data: {
        id: `probe-r-${userId.slice(0, 8)}`,
        title: 'SYNC PROBE reminder',
        dueDate: '2026-11-15',
        updatedAt: '2026-10-27T09:00:00.000Z',
      },
    };
    const category = {
      id: `probe-c-${userId.slice(0, 8)}`,
      createdAt: '2026-10-27T08:00:00.000Z',
      updatedAt: '2026-10-27T09:00:00.000Z',
      deletedAt: null,
      data: { id: `probe-c-${userId.slice(0, 8)}`, name: 'SYNC PROBE category', updatedAt: '2026-10-27T09:00:00.000Z' },
    };
    const parsedReminder = parseEnvelope(reminder, 32_768);
    const parsedCategory = parseEnvelope(category, 32_768);
    expect(parsedReminder).not.toBeNull();
    expect(parsedCategory).not.toBeNull();

    await upsertRecords('reminders', userId, [parsedReminder!]);
    await upsertRecords('categories', userId, [parsedCategory!]);

    const pulledReminders = await pullRecords('reminders', userId, null);
    const pulledCategories = await pullRecords('categories', userId, null);
    expect(pulledReminders).toHaveLength(1);
    expect((pulledReminders[0] as { title: string }).title).toBe('SYNC PROBE reminder');
    expect(pulledCategories).toHaveLength(1);

    // -- LWW: an OLDER copy of the same record must not win -------------------
    const stale = parseEnvelope({ ...reminder, updatedAt: '2026-10-27T07:00:00.000Z' }, 32_768);
    await upsertRecords('reminders', userId, [stale!]);
    const afterStale = await pullRecords('reminders', userId, null);
    expect(afterStale).toHaveLength(1);
    expect((afterStale[0] as { updatedAt: string }).updatedAt).toBe('2026-10-27T09:00:00.000Z');

    // -- a NEWER copy does win ------------------------------------------------
    const fresher = parseEnvelope(
      { ...reminder, updatedAt: '2026-10-27T10:00:00.000Z', data: { ...reminder.data, title: 'SYNC PROBE v2' } },
      32_768,
    );
    await upsertRecords('reminders', userId, [fresher!]);
    const afterFresher = await pullRecords('reminders', userId, null);
    expect((afterFresher[0] as { title: string }).title).toBe('SYNC PROBE v2');

    // -- incremental cursor: nothing changed since `now` ----------------------
    const cursor = new Date().toISOString();
    expect(await pullRecords('reminders', userId, cursor)).toHaveLength(0);
    expect(await pullRecords('categories', userId, cursor)).toHaveLength(0);

    // -- REGRESSION (clock skew, lagging device): a push stamped by a client
    // clock far behind the server must still be pulled — updated_at is a
    // SERVER write stamp, so the pull cursor never compares across clocks.
    const skewCursor = await serverNowIso();
    const lagging = parseEnvelope(
      {
        ...reminder,
        id: `probe-skew-${userId.slice(0, 8)}`,
        updatedAt: '2020-01-01T00:00:00.000Z',
        data: { ...reminder.data, id: `probe-skew-${userId.slice(0, 8)}`, title: 'SYNC PROBE laggy clock' },
      },
      32_768,
    );
    await upsertRecords('reminders', userId, [lagging!]);
    const pulledSkew = await pullRecords('reminders', userId, skewCursor);
    expect(pulledSkew).toHaveLength(1);
    expect((pulledSkew[0] as { title: string }).title).toBe('SYNC PROBE laggy clock');

    // -- REGRESSION (clock skew, fast device): a far-future client stamp is
    // clamped to server time, so the record stays visible to cursor pulls.
    const futureCursor = await serverNowIso();
    const future = parseEnvelope(
      {
        ...reminder,
        id: `probe-future-${userId.slice(0, 8)}`,
        updatedAt: '2100-01-01T00:00:00.000Z',
        data: { ...reminder.data, id: `probe-future-${userId.slice(0, 8)}`, title: 'SYNC PROBE future clock' },
      },
      32_768,
    );
    await upsertRecords('reminders', userId, [future!]);
    expect(await pullRecords('reminders', userId, futureCursor)).toHaveLength(1);

    // -- tombstones: newer stamp + deletedAt in column AND payload ------------
    const deletedAt = '2026-10-27T11:00:00.000Z';
    const tombstoned = parseEnvelope(
      {
        ...category,
        updatedAt: deletedAt,
        deletedAt,
        data: { ...category.data, updatedAt: deletedAt, deletedAt },
      },
      32_768,
    );
    await upsertRecords('categories', userId, [tombstoned!]);
    const pulledTombstone = await pullRecords('categories', userId, null);
    expect((pulledTombstone[0] as { deletedAt: string | null }).deletedAt).toBe(deletedAt);

    // -- logout kills the session server-side ---------------------------------
    await destroySession(fakeReq);
    expect(await getUserFromRequest(fakeReq)).toBeNull();
  });

  it('rejects malformed envelopes instead of storing them', async () => {
    const { parseEnvelope } = await import('./sync.js');
    expect(parseEnvelope({ id: 'bad id!', createdAt: '2026-10-27T08:00:00.000Z', updatedAt: '2026-10-27T08:00:00.000Z', deletedAt: null, data: {} }, 1000)).toBeNull();
    expect(parseEnvelope({ id: 'ok-id', createdAt: 'yesterday', updatedAt: '2026-10-27T08:00:00.000Z', deletedAt: null, data: {} }, 1000)).toBeNull();
    // Bare record with no data payload — the shape old broken clients sent.
    expect(parseEnvelope({ id: 'ok-id', createdAt: '2026-10-27T08:00:00.000Z', updatedAt: '2026-10-27T08:00:00.000Z', deletedAt: null }, 1000)).toBeNull();
  });
});

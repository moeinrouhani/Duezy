import { getSql, queryRows } from './db.js';
import type { ParsedRecord } from './sync.js';

/** Server-side record storage: LWW upserts and cursor pulls. */

export type TableName = 'reminders' | 'categories' | 'completions';

const UPSERT_PARALLELISM = 20;

/**
 * Last-write-wins upsert: a pushed record only lands if it's newer than what's
 * stored. Two clocks, two columns:
 * - `updated_at` is stamped by the SERVER on every accepted write — the pull
 *   cursor compares against it, so pulls never mix client and server clocks.
 * - `client_updated_at` carries the client's edit stamp — the LWW basis.
 *   Clamped to the server's now() so a misconfigured device clock can't
 *   poison the ordering for everyone else.
 */
export async function upsertRecords(table: TableName, userId: string, records: ParsedRecord[]): Promise<void> {
  const sql = getSql();
  for (let i = 0; i < records.length; i += UPSERT_PARALLELISM) {
    await Promise.all(
      records.slice(i, i + UPSERT_PARALLELISM).map((record) => {
        const payload = JSON.stringify(record.data);
        // Table names come from the closed TableName union, never from user input.
        if (table === 'reminders') {
          return sql`INSERT INTO reminders (user_id, id, created_at, updated_at, client_updated_at, deleted_at, data)
               VALUES (${userId}, ${record.id}, ${record.createdAt}, now(), LEAST(${record.updatedAt}::timestamptz, now()), ${record.deletedAt}, ${payload}::jsonb)
               ON CONFLICT (user_id, id) DO UPDATE SET
                 created_at = EXCLUDED.created_at,
                 updated_at = now(),
                 client_updated_at = EXCLUDED.client_updated_at,
                 deleted_at = EXCLUDED.deleted_at,
                 data = EXCLUDED.data
               WHERE EXCLUDED.client_updated_at > reminders.client_updated_at`;
        }
        if (table === 'categories') {
          return sql`INSERT INTO categories (user_id, id, created_at, updated_at, client_updated_at, deleted_at, data)
               VALUES (${userId}, ${record.id}, ${record.createdAt}, now(), LEAST(${record.updatedAt}::timestamptz, now()), ${record.deletedAt}, ${payload}::jsonb)
               ON CONFLICT (user_id, id) DO UPDATE SET
                 created_at = EXCLUDED.created_at,
                 updated_at = now(),
                 client_updated_at = EXCLUDED.client_updated_at,
                 deleted_at = EXCLUDED.deleted_at,
                 data = EXCLUDED.data
               WHERE EXCLUDED.client_updated_at > categories.client_updated_at`;
        }
        return sql`INSERT INTO completions (user_id, id, created_at, updated_at, client_updated_at, deleted_at, data)
             VALUES (${userId}, ${record.id}, ${record.createdAt}, now(), LEAST(${record.updatedAt}::timestamptz, now()), ${record.deletedAt}, ${payload}::jsonb)
             ON CONFLICT (user_id, id) DO UPDATE SET
               created_at = EXCLUDED.created_at,
               updated_at = now(),
               client_updated_at = EXCLUDED.client_updated_at,
               deleted_at = EXCLUDED.deleted_at,
               data = EXCLUDED.data
             WHERE EXCLUDED.client_updated_at > completions.client_updated_at`;
      }),
    );
  }
}

/**
 * One server-clock timestamp for the pull cursor — read from the DATABASE
 * clock, not the function's, so the cursor can never drift from the stamps
 * the pulls compare against.
 */
export async function serverNowIso(): Promise<string> {
  const rows = await queryRows<{ now: string }>(
    getSql()`SELECT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS now`,
  );
  return rows[0].now;
}

export async function pullRecords(table: TableName, userId: string, since: string | null): Promise<unknown[]> {
  const sql = getSql();
  // Table names come from the closed TableName union, never from user input.
  const rows = await queryRows<{ data: unknown }>(
    table === 'reminders'
      ? sql`SELECT data FROM reminders
            WHERE user_id = ${userId} AND (${since}::timestamptz IS NULL OR updated_at > ${since}::timestamptz)`
      : table === 'categories'
        ? sql`SELECT data FROM categories
              WHERE user_id = ${userId} AND (${since}::timestamptz IS NULL OR updated_at > ${since}::timestamptz)`
        : sql`SELECT data FROM completions
              WHERE user_id = ${userId} AND (${since}::timestamptz IS NULL OR updated_at > ${since}::timestamptz)`,
  );
  return rows.map((row) => row.data);
}

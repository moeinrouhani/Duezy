import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureSchema, getSql, NotConfiguredError } from './_lib/db';
import { getUserFromRequest } from './_lib/session';
import { isRateLimited, clientIp, readJsonBody, sendError, sendJson } from './_lib/http';
import { parseEnvelope, parseSince, type ParsedRecord } from './_lib/sync';
import { queryRows } from './_lib/session';
import type { SyncChanges, SyncResponse } from './_lib/types';

type TableName = 'reminders' | 'categories' | 'completions';

const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MB per request
const MAX_RECORDS_PER_TABLE = 1000;
const MAX_RECORD_BYTES = 32 * 1024; // 32 KB per record
const UPSERT_PARALLELISM = 20;

/** Last-write-wins upsert: a pushed record only lands if it's newer than what's stored. */
async function upsertRecords(table: TableName, userId: string, records: ParsedRecord[]): Promise<void> {
  const sql = getSql();
  for (let i = 0; i < records.length; i += UPSERT_PARALLELISM) {
    await Promise.all(
      records.slice(i, i + UPSERT_PARALLELISM).map((record) => {
        const payload = JSON.stringify(record.data);
        // Table names come from the closed TableName union, never from user input.
        if (table === 'reminders') {
          return sql`INSERT INTO reminders (user_id, id, created_at, updated_at, deleted_at, data)
               VALUES (${userId}, ${record.id}, ${record.createdAt}, ${record.updatedAt}, ${record.deletedAt}, ${payload}::jsonb)
               ON CONFLICT (user_id, id) DO UPDATE SET
                 created_at = EXCLUDED.created_at,
                 updated_at = EXCLUDED.updated_at,
                 deleted_at = EXCLUDED.deleted_at,
                 data = EXCLUDED.data
               WHERE EXCLUDED.updated_at > reminders.updated_at`;
        }
        if (table === 'categories') {
          return sql`INSERT INTO categories (user_id, id, created_at, updated_at, deleted_at, data)
               VALUES (${userId}, ${record.id}, ${record.createdAt}, ${record.updatedAt}, ${record.deletedAt}, ${payload}::jsonb)
               ON CONFLICT (user_id, id) DO UPDATE SET
                 created_at = EXCLUDED.created_at,
                 updated_at = EXCLUDED.updated_at,
                 deleted_at = EXCLUDED.deleted_at,
                 data = EXCLUDED.data
               WHERE EXCLUDED.updated_at > categories.updated_at`;
        }
        return sql`INSERT INTO completions (user_id, id, created_at, updated_at, deleted_at, data)
             VALUES (${userId}, ${record.id}, ${record.createdAt}, ${record.updatedAt}, ${record.deletedAt}, ${payload}::jsonb)
             ON CONFLICT (user_id, id) DO UPDATE SET
               created_at = EXCLUDED.created_at,
               updated_at = EXCLUDED.updated_at,
               deleted_at = EXCLUDED.deleted_at,
               data = EXCLUDED.data
             WHERE EXCLUDED.updated_at > completions.updated_at`;
      }),
    );
  }
}

async function pullRecords(table: TableName, userId: string, since: string | null): Promise<unknown[]> {
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

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendError(res, 405, 'method_not_allowed');
    return;
  }
  if (isRateLimited(`sync:${clientIp(req)}`, 120, 60_000)) {
    sendError(res, 429, 'rate_limited');
    return;
  }

  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      sendError(res, 401, 'unauthorized');
      return;
    }

    const body = await readJsonBody(req, MAX_BODY_BYTES);
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      sendError(res, 400, 'bad_request');
      return;
    }
    const since = parseSince((body as { since?: unknown }).since);
    if (since === undefined) {
      sendError(res, 400, 'bad_request');
      return;
    }
    const rawChanges = (body as { changes?: unknown }).changes;
    if (typeof rawChanges !== 'object' || rawChanges === null || Array.isArray(rawChanges)) {
      sendError(res, 400, 'bad_request');
      return;
    }

    await ensureSchema();

    const tables: TableName[] = ['reminders', 'categories', 'completions'];
    const parsed: Record<TableName, ParsedRecord[]> = { reminders: [], categories: [], completions: [] };

    for (const table of tables) {
      const rawRecords = (rawChanges as Record<string, unknown>)[table];
      if (rawRecords === undefined || rawRecords === null) continue;
      if (!Array.isArray(rawRecords) || rawRecords.length > MAX_RECORDS_PER_TABLE) {
        sendError(res, 400, 'bad_request');
        return;
      }
      for (const raw of rawRecords) {
        const record = parseEnvelope(raw, MAX_RECORD_BYTES);
        if (record) parsed[table].push(record);
      }
    }

    for (const table of tables) {
      if (parsed[table].length > 0) await upsertRecords(table, user.id, parsed[table]);
    }

    const changes: SyncChanges = {
      reminders: await pullRecords('reminders', user.id, since),
      categories: await pullRecords('categories', user.id, since),
      completions: await pullRecords('completions', user.id, since),
    };

    const response: SyncResponse = { now: new Date().toISOString(), changes };
    sendJson(res, 200, response);
  } catch (error) {
    if (error instanceof NotConfiguredError) {
      sendError(res, 503, 'not_configured');
      return;
    }
    console.error('sync failed:', error);
    sendError(res, 500, 'server_error');
  }
}

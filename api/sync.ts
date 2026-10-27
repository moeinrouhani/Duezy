import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureSchema, NotConfiguredError } from './_lib/db.js';
import { getUserFromRequest } from './_lib/session.js';
import { isRateLimited, clientIp, readJsonBody, sendError, sendJson } from './_lib/http.js';
import { parseEnvelope, parseSince, type ParsedRecord } from './_lib/sync.js';
import { pullRecords, upsertRecords, type TableName } from './_lib/records.js';
import type { SyncChanges, SyncResponse } from './_lib/types.js';

const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MB per request
const MAX_RECORDS_PER_TABLE = 1000;
const MAX_RECORD_BYTES = 32 * 1024; // 32 KB per record

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
    let rejected = 0;

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
        else rejected += 1;
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
    console.log(
      `[sync] ${user.username}: pushed ` +
        `${parsed.reminders.length}r/${parsed.categories.length}c/${parsed.completions.length}x ` +
        `(${rejected} rejected), pulled ` +
        `${changes.reminders.length}r/${changes.categories.length}c/${changes.completions.length}x`,
    );
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

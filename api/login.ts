import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureSchema, getSql, NotConfiguredError } from './_lib/db.js';
import { equalizeVerifyTiming, normalizeUsername, verifyPassword } from './_lib/auth.js';
import { createSession, pruneExpiredSessions, sessionCookieHeader } from './_lib/session.js';
import { clientIp, isRateLimited, readJsonBody, sendError, sendJson } from './_lib/http.js';
import { queryRows } from './_lib/session.js';
import type { UserPublic } from './_lib/types.js';

const MAX_BODY_BYTES = 8 * 1024;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendError(res, 405, 'method_not_allowed');
    return;
  }
  if (isRateLimited(`login:${clientIp(req)}`, 10, 15 * 60_000)) {
    sendError(res, 429, 'rate_limited');
    return;
  }

  try {
    const body = await readJsonBody(req, MAX_BODY_BYTES);
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      sendError(res, 400, 'bad_request');
      return;
    }
    const username = normalizeUsername((body as { username?: unknown }).username);
    const password = (body as { password?: unknown }).password;
    if (!username || typeof password !== 'string') {
      sendError(res, 401, 'invalid_credentials');
      return;
    }

    await ensureSchema();
    const sql = getSql();
    const rows = await queryRows<{ id: string; username: string; display_name: string | null; password_hash: string }>(sql`
      SELECT id, username, display_name, password_hash
      FROM users
      WHERE username = ${username}
      LIMIT 1`);

    const row = rows[0];
    if (!row) {
      // Burn the same scrypt cost as a real check so timing doesn't reveal
      // which usernames exist.
      await equalizeVerifyTiming(password);
      sendError(res, 401, 'invalid_credentials');
      return;
    }
    const ok = await verifyPassword(password, row.password_hash);
    if (!ok) {
      sendError(res, 401, 'invalid_credentials');
      return;
    }

    void pruneExpiredSessions().catch(() => undefined);

    const token = await createSession(row.id);
    res.setHeader('Set-Cookie', sessionCookieHeader(token));
    const user: UserPublic = { id: row.id, username: row.username, displayName: row.display_name };
    sendJson(res, 200, { user });
  } catch (error) {
    if (error instanceof NotConfiguredError) {
      sendError(res, 503, 'not_configured');
      return;
    }
    console.error('login failed:', error);
    sendError(res, 500, 'server_error');
  }
}

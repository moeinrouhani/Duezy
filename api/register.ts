import { randomUUID } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureSchema, getSql, NotConfiguredError } from './_lib/db';
import {
  hashPassword,
  isValidPassword,
  normalizeDisplayName,
  normalizeUsername,
} from './_lib/auth';
import { createSession, pruneExpiredSessions, sessionCookieHeader } from './_lib/session';
import { clientIp, isRateLimited, readJsonBody, sendError, sendJson } from './_lib/http';
import type { UserPublic } from './_lib/types';

const MAX_BODY_BYTES = 8 * 1024;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendError(res, 405, 'method_not_allowed');
    return;
  }
  if (isRateLimited(`register:${clientIp(req)}`, 5, 15 * 60_000)) {
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
    if (!username) {
      sendError(res, 400, 'invalid_username');
      return;
    }
    const password = (body as { password?: unknown }).password;
    if (!isValidPassword(password)) {
      sendError(res, 400, 'weak_password');
      return;
    }
    const displayName = normalizeDisplayName((body as { displayName?: unknown }).displayName);

    await ensureSchema();
    const sql = getSql();

    const userId = randomUUID();
    const passwordHash = await hashPassword(password);
    try {
      await sql`
        INSERT INTO users (id, username, display_name, password_hash)
        VALUES (${userId}, ${username}, ${displayName}, ${passwordHash})`;
    } catch (error) {
      // Unique violation → the username is already taken.
      if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505') {
        sendError(res, 409, 'username_taken');
        return;
      }
      throw error;
    }

    void pruneExpiredSessions().catch(() => undefined);

    const token = await createSession(userId);
    res.setHeader('Set-Cookie', sessionCookieHeader(token));
    const user: UserPublic = { id: userId, username, displayName };
    sendJson(res, 200, { user });
  } catch (error) {
    if (error instanceof NotConfiguredError) {
      sendError(res, 503, 'not_configured');
      return;
    }
    console.error('register failed:', error);
    sendError(res, 500, 'server_error');
  }
}

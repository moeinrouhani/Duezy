import { createHash, randomBytes } from 'node:crypto';
import type { VercelRequest } from '@vercel/node';
import { getSql, ensureSchema } from './db.js';
import type { UserPublic } from './types.js';

/**
 * Cookie sessions with opaque random tokens. Only sha256(token) is stored, so
 * a database leak never yields a usable credential. 30-day sliding window;
 * logout deletes the row so the token dies server-side.
 */

export const SESSION_COOKIE = 'duezy_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function isSecureDeployment(): boolean {
  return process.env.VERCEL_ENV === 'production';
}

export function sessionCookieHeader(token: string): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (isSecureDeployment()) parts.push('Secure');
  return parts.join('; ');
}

export function clearSessionCookieHeader(): string {
  const parts = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (isSecureDeployment()) parts.push('Secure');
  return parts.join('; ');
}

export function readSessionToken(req: VercelRequest): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const pair of header.split(';')) {
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    if (pair.slice(0, eq).trim() === SESSION_COOKIE) {
      const token = pair.slice(eq + 1).trim();
      return token.length > 0 ? token : null;
    }
  }
  return null;
}

/** Create a session row and return the raw token (only ever seen here). */
export async function createSession(userId: string): Promise<string> {
  const sql = getSql();
  await ensureSchema();
  const token = randomBytes(32).toString('base64url');
  await sql`
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES (${sha256(token)}, ${userId}, now() + make_interval(secs => ${SESSION_TTL_MS / 1000}))`;
  return token;
}

/** The neon driver returns an untyped union; every call site narrows it here. */
export async function queryRows<T>(promise: Promise<unknown>): Promise<T[]> {
  return (await promise) as T[];
}

export async function getUserFromRequest(req: VercelRequest): Promise<UserPublic | null> {
  const token = readSessionToken(req);
  if (!token) return null;
  const sql = getSql();
  await ensureSchema();
  const rows = await queryRows<{ id: string; username: string; display_name: string | null }>(sql`
    SELECT u.id, u.username, u.display_name
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ${sha256(token)} AND s.expires_at > now()
    LIMIT 1`);
  const row = rows[0];
  return row ? { id: row.id, username: row.username, displayName: row.display_name } : null;
}

export async function destroySession(req: VercelRequest): Promise<void> {
  const token = readSessionToken(req);
  if (!token) return;
  const sql = getSql();
  await ensureSchema();
  await sql`DELETE FROM sessions WHERE id = ${sha256(token)}`;
}

/** Opportunistic cleanup — runs on login/register so expired rows don't pile up. */
export async function pruneExpiredSessions(): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM sessions WHERE expires_at < now()`;
}

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { NotConfiguredError } from './_lib/db.js';
import { clearSessionCookieHeader, destroySession } from './_lib/session.js';
import { sendError, sendJson } from './_lib/http.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendError(res, 405, 'method_not_allowed');
    return;
  }
  try {
    await destroySession(req);
  } catch (error) {
    if (error instanceof NotConfiguredError) {
      sendError(res, 503, 'not_configured');
      return;
    }
    console.error('logout failed:', error);
    sendError(res, 500, 'server_error');
    return;
  }
  res.setHeader('Set-Cookie', clearSessionCookieHeader());
  sendJson(res, 200, { ok: true });
}

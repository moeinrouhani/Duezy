import type { VercelRequest, VercelResponse } from '@vercel/node';
import { NotConfiguredError } from './_lib/db.js';
import { getUserFromRequest } from './_lib/session.js';
import { sendError, sendJson } from './_lib/http.js';

/** Restore the session on app boot: 200 {user} or 401. */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    sendError(res, 405, 'method_not_allowed');
    return;
  }
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      sendError(res, 401, 'unauthorized');
      return;
    }
    sendJson(res, 200, { user });
  } catch (error) {
    if (error instanceof NotConfiguredError) {
      sendError(res, 503, 'not_configured');
      return;
    }
    console.error('me failed:', error);
    sendError(res, 500, 'server_error');
  }
}

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { ApiErrorCode } from './types';

/** Small HTTP helpers shared by the /api endpoints. */

export function sendJson(res: VercelResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export function sendError(res: VercelResponse, status: number, code: ApiErrorCode): void {
  sendJson(res, status, { error: code });
}

/** Read and parse a JSON body with a hard size cap. Returns null on bad input. */
export function readJsonBody(req: VercelRequest, maxBytes: number): Promise<unknown | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let done = false;
    const finish = (value: unknown | null) => {
      if (!done) {
        done = true;
        resolve(value);
      }
    };
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        finish(null);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        finish(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        finish(null);
      }
    });
    req.on('error', () => finish(null));
  });
}

/**
 * Best-effort in-memory rate limiter. Lambda instances don't share state, so
 * this thuds a single flood source per instance — enough to blunt credential
 * stuffing without external infrastructure.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function isRateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size > 10_000) {
    for (const [k, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(k);
    }
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  bucket.count += 1;
  return bucket.count > max;
}

export function clientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return 'local';
}

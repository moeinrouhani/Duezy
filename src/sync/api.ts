import type { Category, CompletionRecord, Reminder, Timestamp } from '../domain/types';

/** Thin fetch wrapper around the /api endpoints (same-origin, cookie auth). */

export interface AuthUser {
  id: string;
  username: string;
  displayName: string | null;
}

export class ApiError extends Error {
  constructor(
    /** Machine-readable code from the server ('network' when unreachable). */
    readonly code: string,
    readonly status: number,
  ) {
    super(`API ${status}: ${code}`);
  }
}

export interface SyncPayload {
  reminders: Reminder[];
  categories: Category[];
  completions: CompletionRecord[];
}

export interface SyncResult {
  now: string;
  changes: SyncPayload;
}

function errorCode(body: unknown, status: number): ApiError {
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const code = (body as { error?: unknown }).error;
    if (typeof code === 'string') return new ApiError(code, status);
  }
  return new ApiError('server_error', status);
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('network', 0);
  }
  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch {
    // Non-JSON error page — fall through to the status mapping below.
  }
  if (!response.ok) throw errorCode(parsed, response.status);
  return parsed as T;
}

export const api = {
  register: (username: string, password: string, displayName?: string) =>
    request<{ user: AuthUser }>('POST', '/api/register', { username, password, displayName }),
  login: (username: string, password: string) =>
    request<{ user: AuthUser }>('POST', '/api/login', { username, password }),
  logout: () => request<{ ok: boolean }>('POST', '/api/logout'),
  me: () => request<{ user: AuthUser }>('GET', '/api/me'),
  sync: (since: Timestamp | null, changes: SyncPayload) =>
    request<SyncResult>('POST', '/api/sync', { since, changes }),
};

/**
 * Wire types shared by the /api endpoints.
 *
 * Deliberately schema-agnostic about the synced records themselves: the server
 * treats reminder/category/completion payloads as opaque JSON envelopes with
 * four well-known sync columns (id + timestamps). The client owns the record
 * schema — see src/domain/types.ts.
 */

export interface UserPublic {
  id: string;
  /** Lowercase canonical username (what you log in with). */
  username: string;
  /** Optional display name as entered at registration. */
  displayName: string | null;
}

/** One record pushed or pulled through /api/sync. */
export interface SyncEnvelope {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  /** Full client record (Reminder | Category | CompletionRecord) as-is. */
  data: unknown;
}

export interface SyncChanges {
  reminders: unknown[];
  categories: unknown[];
  completions: unknown[];
}

export interface SyncRequest {
  /** Server cursor from the previous response; null = initial full sync. */
  since: string | null;
  changes: SyncChanges;
}

export interface SyncResponse {
  /** Server time — the next request's `since` cursor. */
  now: string;
  changes: SyncChanges;
}

/** Machine-readable error codes; the client maps them to i18n keys. */
export type ApiErrorCode =
  | 'method_not_allowed'
  | 'bad_request'
  | 'invalid_username'
  | 'weak_password'
  | 'username_taken'
  | 'invalid_credentials'
  | 'unauthorized'
  | 'rate_limited'
  | 'payload_too_large'
  | 'not_configured'
  | 'server_error';

import { neon } from '@neondatabase/serverless';

/**
 * Postgres access over the Neon HTTP driver (stateless — no connection pooling
 * to manage inside serverless functions). Works with Vercel Postgres and any
 * Neon database; the SQL itself is portable to any Postgres.
 */

export class NotConfiguredError extends Error {
  constructor() {
    super('DATABASE_URL is not set');
  }
}

type SqlClient = ReturnType<typeof neon>;

let sqlClient: SqlClient | null = null;

/**
 * Resolve the connection string. Prefers DATABASE_URL (what the docs tell you
 * to set), then Vercel Postgres' pooled URL (required by the HTTP driver),
 * then the plain POSTGRES_URL.
 */
export function resolveDatabaseUrl(): string | null {
  const env = process.env;
  if (env.DATABASE_URL) return env.DATABASE_URL;
  const pooledKey = Object.keys(env).find((key) => /POSTGRES_URL.*POOL/i.test(key) && env[key]);
  if (pooledKey) return env[pooledKey] as string;
  if (env.POSTGRES_URL) return env.POSTGRES_URL;
  return null;
}

export function getSql(): SqlClient {
  if (!sqlClient) {
    const url = resolveDatabaseUrl();
    if (!url) throw new NotConfiguredError();
    sqlClient = neon(url);
  }
  return sqlClient;
}

/** The neon driver returns an untyped union; every call site narrows it here. */
export async function queryRows<T>(promise: Promise<unknown>): Promise<T[]> {
  return (await promise) as T[];
}

/**
 * Idempotent schema bootstrap — runs once per lambda instance, before the
 * first query that needs a table. CREATE TABLE IF NOT EXISTS keeps deployment
 * zero-config: point DATABASE_URL at an empty database and everything appears.
 *
 * Sync tables use relational sync columns (per-user scoping, LWW cursor
 * queries, tombstones) plus the full client record as a JSONB payload — the
 * server stays schema-agnostic while queries stay indexable.
 */
let schemaPromise: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const sql = getSql();
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id            TEXT PRIMARY KEY,
          username      TEXT NOT NULL UNIQUE,
          display_name  TEXT,
          password_hash TEXT NOT NULL,
          created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS sessions (
          id           TEXT PRIMARY KEY,
          user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
          last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          expires_at   TIMESTAMPTZ NOT NULL
        )`;
      await sql`CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions (expires_at)`;

      await sql`
        CREATE TABLE IF NOT EXISTS reminders (
          user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          id         TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL,
          deleted_at TIMESTAMPTZ,
          data       JSONB NOT NULL,
          PRIMARY KEY (user_id, id)
        )`;
      await sql`CREATE INDEX IF NOT EXISTS reminders_sync_idx ON reminders (user_id, updated_at)`;

      await sql`
        CREATE TABLE IF NOT EXISTS categories (
          user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          id         TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL,
          deleted_at TIMESTAMPTZ,
          data       JSONB NOT NULL,
          PRIMARY KEY (user_id, id)
        )`;
      await sql`CREATE INDEX IF NOT EXISTS categories_sync_idx ON categories (user_id, updated_at)`;

      await sql`
        CREATE TABLE IF NOT EXISTS completions (
          user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          id         TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL,
          deleted_at TIMESTAMPTZ,
          data       JSONB NOT NULL,
          PRIMARY KEY (user_id, id)
        )`;
      await sql`CREATE INDEX IF NOT EXISTS completions_sync_idx ON completions (user_id, updated_at)`;
    })().catch((error) => {
      schemaPromise = null; // allow a retry on the next request
      throw error;
    });
  }
  return schemaPromise;
}

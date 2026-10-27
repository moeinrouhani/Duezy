/**
 * Envelope validation for /api/sync.
 *
 * The server is schema-agnostic about record contents (they're stored as
 * JSONB) but MUST validate the four sync columns it indexes and compares:
 * id + createdAt/updatedAt/deletedAt. Everything else rides along untouched.
 */

export interface ParsedRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  data: unknown;
}

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const ISO_LIKE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseTimestamp(raw: unknown): string | null {
  if (typeof raw !== 'string' || !ISO_LIKE.test(raw)) return null;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

/** Validate one synced record; null = reject (silently dropped by the caller). */
export function parseEnvelope(raw: unknown, maxRecordBytes: number): ParsedRecord | null {
  if (!isRecord(raw)) return null;
  const { id, createdAt, updatedAt, deletedAt, data } = raw;
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) return null;

  const createdAtIso = parseTimestamp(createdAt);
  const updatedAtIso = parseTimestamp(updatedAt);
  if (!createdAtIso || !updatedAtIso) return null;

  let deletedAtIso: string | null = null;
  if (deletedAt !== null && deletedAt !== undefined) {
    deletedAtIso = parseTimestamp(deletedAt);
    if (!deletedAtIso) return null;
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(data ?? null);
  } catch {
    return null;
  }
  if (serialized.length > maxRecordBytes) return null;

  return {
    id,
    createdAt: createdAtIso,
    updatedAt: updatedAtIso,
    deletedAt: deletedAtIso,
    data: data ?? null,
  };
}

/** Parse the `since` cursor; undefined = invalid (→ 400), null = explicit initial sync. */
export function parseSince(raw: unknown): string | null | undefined {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'string') return undefined;
  return parseTimestamp(raw) ?? undefined;
}

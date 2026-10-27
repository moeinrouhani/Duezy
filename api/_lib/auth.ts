import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

/**
 * Password hashing and credential validation.
 *
 * scrypt (Node built-in, OWASP-recommended parameters) instead of bcrypt —
 * no native module to compile inside serverless bundles. Stored format:
 *   scrypt$<N>$<r>$<p>$<salt b64>$<hash b64>
 * so parameters can be raised later without invalidating existing hashes.
 */

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem?: number },
) => Promise<Buffer>;

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
/** 128·N·r bytes; Node's 32 MB default is too small for these parameters. */
const MAXMEM = 128 * SCRYPT_N * SCRYPT_R * 2;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: MAXMEM,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, salt, hash] = parts;
  const params = { N: Number(n), r: Number(r), p: Number(p) };
  if (!Number.isInteger(params.N) || !Number.isInteger(params.r) || !Number.isInteger(params.p)) {
    return false;
  }
  try {
    const expected = Buffer.from(hash, 'base64');
    const actual = await scrypt(password.normalize('NFKC'), Buffer.from(salt, 'base64'), expected.length, {
      ...params,
      maxmem: 128 * params.N * params.r * 2,
    });
    return expected.length === actual.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/**
 * Burn ~the same CPU as a real verification when the username doesn't exist,
 * so login timing doesn't reveal which usernames are taken.
 */
const DUMMY_HASH_PROMISE = hashPassword('!dummy-password-for-timing!');

export async function equalizeVerifyTiming(password: string): Promise<void> {
  await verifyPassword(password, await DUMMY_HASH_PROMISE);
}

/** 3–32 chars; ASCII letters, digits, dot, underscore, hyphen. */
export function normalizeUsername(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const username = raw.trim().toLowerCase();
  return /^[a-z0-9_.-]{3,32}$/.test(username) ? username : null;
}

export function isValidPassword(raw: unknown): raw is string {
  return typeof raw === 'string' && raw.length >= 8 && raw.length <= 200;
}

export function normalizeDisplayName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const displayName = raw.trim().replace(/\s+/g, ' ').slice(0, 60);
  return displayName.length > 0 ? displayName : null;
}

import { describe, expect, it } from 'vitest';
import {
  hashPassword,
  isValidPassword,
  normalizeDisplayName,
  normalizeUsername,
  verifyPassword,
} from './auth';

describe('api/_lib/auth', () => {
  it('hash → verify round-trips', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
  });

  it('rejects wrong passwords and malformed stored hashes', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staples', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('x', 'bcrypt$2a$10$whatever')).toBe(false);
  });

  it('produces a unique salt per hash', async () => {
    const [a, b] = await Promise.all([hashPassword('same-password'), hashPassword('same-password')]);
    expect(a).not.toBe(b);
  });

  it('normalizes usernames to lowercase and enforces the character set', () => {
    expect(normalizeUsername('  Mina.Rahimi ')).toBe('mina.rahimi');
    expect(normalizeUsername('user_01-x')).toBe('user_01-x');
    expect(normalizeUsername('ab')).toBeNull(); // too short
    expect(normalizeUsername('a'.repeat(33))).toBeNull(); // too long
    expect(normalizeUsername('has space')).toBeNull();
    expect(normalizeUsername('سلام')).toBeNull(); // non-ASCII
    expect(normalizeUsername(42)).toBeNull();
  });

  it('validates password length bounds', () => {
    expect(isValidPassword('12345678')).toBe(true);
    expect(isValidPassword('1234567')).toBe(false);
    expect(isValidPassword('x'.repeat(200))).toBe(true);
    expect(isValidPassword('x'.repeat(201))).toBe(false);
    expect(isValidPassword(12345678)).toBe(false);
  });

  it('trims and caps display names, collapsing blank ones to null', () => {
    expect(normalizeDisplayName('  Mina   Rahimi ')).toBe('Mina Rahimi');
    expect(normalizeDisplayName('   ')).toBeNull();
    expect(normalizeDisplayName(undefined)).toBeNull();
    expect(normalizeDisplayName('x'.repeat(100))).toHaveLength(60);
  });
});

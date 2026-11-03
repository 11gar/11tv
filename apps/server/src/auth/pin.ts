import { PIN_PATTERN } from '@11tv/shared';
import { randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>;

const KEY_LENGTH = 32;
const PARAMS = { N: 2 ** 14, r: 8, p: 1 };

export function isValidPin(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

export function generatePin(length = 6): string {
  return Array.from({ length }, () => String(randomInt(10))).join('');
}

/** Format stocké : scrypt$N$r$p$sel$empreinte (base64url). */
export async function hashPin(pin: string): Promise<string> {
  if (!isValidPin(pin)) throw new Error('PIN invalide');
  const salt = randomBytes(16);
  const hash = await scrypt(pin, salt, KEY_LENGTH, PARAMS);
  return [
    'scrypt',
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString('base64url'),
    hash.toString('base64url'),
  ].join('$');
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, salt, hash] = stored.split('$');
  if (algo !== 'scrypt' || !n || !r || !p || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = await scrypt(pin, Buffer.from(salt, 'base64url'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return timingSafeEqual(actual, expected);
}

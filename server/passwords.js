import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const deriveKey = promisify(scrypt);

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await deriveKey(password, salt, 64);
  return `${salt}:${key.toString('hex')}`;
}

export async function verifyPassword(password, passwordHash) {
  const validHash =
    typeof passwordHash === 'string' &&
    /^[a-f0-9]{32}:[a-f0-9]{128}$/.test(passwordHash);
  // Unknown accounts still perform the password derivation.
  const [salt, storedHash] = (
    validHash ? passwordHash : `${'0'.repeat(32)}:${'0'.repeat(128)}`
  ).split(':');
  const key = await deriveKey(password, salt, 64);
  return timingSafeEqual(key, Buffer.from(storedHash, 'hex')) && validHash;
}

/**
 * Session Cookie Encryption
 *
 * Provides AES-256-GCM authenticated encryption for Riot session cookies stored
 * in SQLite. Each encryption call generates a fresh 12-byte IV, so the same
 * plaintext produces different ciphertext every time.
 *
 * Output format: `${iv_hex}:${authTag_hex}:${ciphertext_hex}`
 *
 * Usage:
 *   import { encrypt, decrypt, isEncrypted } from "@/lib/session-crypto";
 *   const ct = encrypt(cookieString, keyHex);
 *   const pt = decrypt(ct, keyHex);
 *   isEncrypted(ct); // true
 */

import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { createLogger } from '@/lib/logger';

const log = createLogger('session-crypto');

/**
 * Encrypts a plaintext string using AES-256-GCM.
 *
 * @param plaintext  UTF-8 string to encrypt (e.g., a Riot cookie string)
 * @param keyHex     64-character hex string representing 32 bytes (256 bits)
 * @returns          Colon-delimited hex string: `iv:authTag:ciphertext`
 */
export function encrypt(plaintext: string, keyHex: string): string {
  const iv = randomBytes(12);
  const key = Buffer.from(keyHex, 'hex');

  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  const result = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  log.debug('Encrypted value, length:', result.length);
  return result;
}

/**
 * Decrypts an AES-256-GCM ciphertext string.
 *
 * @param encryptedValue  Colon-delimited hex string: `iv:authTag:ciphertext`
 * @param keyHex          64-character hex string representing 32 bytes
 * @returns               Decrypted UTF-8 string
 * @throws                On bad format, wrong key, or tampered data
 */
export function decrypt(encryptedValue: string, keyHex: string): string {
  const parts = encryptedValue.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted value format — expected iv:authTag:ciphertext');
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Returns true if the given value looks like an AES-256-GCM ciphertext
 * produced by `encrypt()`. Distinguishes encrypted values from plaintext
 * cookie strings (which contain `=` and `;` characters).
 *
 * @param value  Any string (could be encrypted or legacy plaintext)
 */
export function isEncrypted(value: string): boolean {
  return /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/i.test(value);
}

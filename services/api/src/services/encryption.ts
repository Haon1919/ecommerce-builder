/**
 * AES-256-CBC encryption for PII data at rest.
 * Customer names, emails, phone numbers, and addresses are encrypted
 * before storage so even database access does not expose raw PII.
 *
 * Super admins see only anonymized/aggregated data. Store owners
 * can decrypt their own customers' data using the store's key.
 */

import crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-cbc';

// config.ts already validates the key is exactly 32 chars at startup.
// Convert directly — do NOT slice, which would silently accept wrong-length keys.
const KEY = Buffer.from(config.encryption.key, 'utf8');

/**
 * Encrypt a plaintext string.
 * Returns "iv:ciphertext" as a single hex string.
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return '';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt an encrypted string produced by encrypt().
 */
export function decrypt(ciphertext: string): string {
  if (!ciphertext) return '';
  try {
    const [ivHex, encrypted] = ciphertext.split(':');
    if (!ivHex || !encrypted) return '';
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return '';
  }
}

/**
 * Anonymize an email for logging (user@example.com -> u***@e***.com)
 * Safe to log — reveals no PII.
 */
export function anonymizeEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const [domainName, ...rest] = domain.split('.');
  return `${local[0]}***@${domainName[0]}***.${rest.join('.')}`;
}

/**
 * Anonymize a name for logging.
 */
export function anonymizeName(name: string): string {
  return name[0] + '***';
}

/**
 * Hash a value with HMAC-SHA256 for consistent anonymous lookups.
 * (e.g., count unique customers without knowing their emails)
 */
export function hashForAnalytics(value: string): string {
  return crypto
    .createHmac('sha256', config.encryption.key)
    .update(value.toLowerCase().trim())
    .digest('hex');
}

/**
 * Encrypt JSON object (e.g., shipping address).
 */
export function encryptJson(obj: Record<string, unknown>): string {
  return encrypt(JSON.stringify(obj));
}

/**
 * Decrypt JSON object.
 */
export function decryptJson<T = Record<string, unknown>>(ciphertext: string): T | null {
  try {
    const str = decrypt(ciphertext);
    if (!str) return null;
    return JSON.parse(str) as T;
  } catch {
    return null;
  }
}

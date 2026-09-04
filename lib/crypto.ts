import crypto from 'crypto';
import { ConfigError } from './api';

// AES-256-GCM for national ID numbers at rest.
//
// Changed from the JSON-file version: the key now comes from ENCRYPTION_KEY
// only. The old code generated one on first run and wrote it to
// data/.encryption_key, which on serverless meant a *new random key on every
// cold start* — every previously encrypted ID became permanently unreadable.
// Failing loudly at boot is far better than silently shredding patient data.
function loadKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new ConfigError(
      'ไม่พบ ENCRYPTION_KEY — ตั้งค่าใน Vercel Project Settings ' +
        '(สุ่มด้วย: openssl rand -base64 32) ถ้าคีย์นี้เปลี่ยน เลขบัตรที่เข้ารหัสไว้เดิมจะอ่านไม่ออกอีกเลย'
    );
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new ConfigError(
      `ENCRYPTION_KEY ต้องเป็น base64 ของข้อมูล 32 ไบต์พอดี (ตอนนี้ได้ ${key.length} ไบต์) ` +
        'สุ่มใหม่ด้วย: openssl rand -base64 32'
    );
  }
  return key;
}

let cachedKey: Buffer | null = null;
function key(): Buffer {
  if (!cachedKey) cachedKey = loadKey();
  return cachedKey;
}

export function encrypt(plainText: string): string {
  if (!plainText) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':');
}

export function decrypt(payload: string | null | undefined): string {
  if (!payload) return '';
  const parts = String(payload).split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') return String(payload);
  const [, ivB64, tagB64, dataB64] = parts;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return '';
  }
}

// Deterministic hash used only to look up "is this person already registered?"
// without decrypting every borrower row. Keyed with the encryption key so the
// hash is useless to anyone who gets the database alone.
export function nationalIdHash(nationalId: string): string {
  return crypto.createHmac('sha256', key()).update(nationalId).digest('hex');
}

// Display form: 110xxxxxxx366
export function mask(nationalId: string): string {
  if (!nationalId || nationalId.length < 7) return '•••••••••••••';
  return `${nationalId.slice(0, 3)}xxxxxxx${nationalId.slice(-3)}`;
}

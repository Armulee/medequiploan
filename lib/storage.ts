import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { del, head, put } from '@vercel/blob';

// ID-card and illness photos are health data. They are stored under an
// unguessable key and never exposed by direct URL — /api/files/[id] checks the
// session and streams them, so the requireAuth guarantee the Express version
// had via `app.use('/uploads', requireAuth, ...)` is preserved.

const ALLOWED = new Map<string, string>([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/heic', '.heic'],
  ['image/heif', '.heif'],
]);

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const useBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const localRoot = path.join(process.cwd(), 'uploads');

export type Folder = 'id_cards' | 'illness_photos';

/**
 * The extension comes from the sniffed MIME type, never from the uploaded
 * filename. The old code took `path.extname(file.originalname)` verbatim, so a
 * file claiming to be an image but named `x.html` was stored as .html and later
 * served as HTML to a logged-in staff member — stored XSS.
 */
export async function saveUpload(folder: Folder, file: File): Promise<string> {
  const ext = ALLOWED.get(file.type);
  if (!ext) {
    throw new Error('รองรับเฉพาะไฟล์รูปภาพ (jpg, png, webp, heic)');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('ไฟล์ใหญ่เกิน 8MB กรุณาย่อรูปก่อนอัปโหลด');
  }

  const id = `${folder}/${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  if (useBlob()) {
    await put(id, bytes, {
      access: 'public', // unguessable key; access is gated by /api/files/[id]
      contentType: file.type,
      addRandomSuffix: false,
    });
  } else {
    // Local dev fallback so the app runs without a Blob token.
    const target = path.join(localRoot, id);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes);
  }

  return id;
}

export async function readUpload(
  id: string
): Promise<{ body: ReadableStream | Buffer; contentType: string } | null> {
  // Reject traversal before the id ever reaches the filesystem or Blob.
  if (!/^(id_cards|illness_photos)\/[A-Za-z0-9_]+\.(jpg|png|webp|heic|heif)$/.test(id)) {
    return null;
  }

  if (useBlob()) {
    try {
      const meta = await head(blobUrl(id));
      const res = await fetch(meta.url);
      if (!res.ok || !res.body) return null;
      return { body: res.body, contentType: meta.contentType || 'application/octet-stream' };
    } catch {
      return null;
    }
  }

  try {
    const buf = await fs.readFile(path.join(localRoot, id));
    const ext = path.extname(id);
    const contentType =
      [...ALLOWED.entries()].find(([, e]) => e === ext)?.[0] ?? 'application/octet-stream';
    return { body: buf, contentType };
  } catch {
    return null;
  }
}

export async function deleteUpload(id: string): Promise<void> {
  if (useBlob()) {
    await del(blobUrl(id)).catch(() => {});
  } else {
    await fs.unlink(path.join(localRoot, id)).catch(() => {});
  }
}

function blobUrl(id: string): string {
  const base = process.env.BLOB_PUBLIC_BASE_URL;
  return base ? `${base.replace(/\/$/, '')}/${id}` : id;
}

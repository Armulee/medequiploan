import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { del, get, put } from '@vercel/blob';
import sharp from 'sharp';

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

/**
 * Is a Blob store connected?
 *
 * Two ways, because Vercel now offers two. The classic one is a read-write
 * token. The current one is OIDC: connecting a store injects `BLOB_STORE_ID`
 * and the platform hands the function a short-lived `VERCEL_OIDC_TOKEN` at
 * runtime — which never appears in the project's Environment Variables list,
 * so a correctly connected store can look, from that screen, like a store with
 * no credentials at all.
 *
 * Checking only for the token was therefore a silent data-loss bug: a properly
 * connected store fell through to `localRoot`, and every ID-card photograph
 * went to a container disk that Vercel throws away on the next cold start.
 * Either signal now counts, and if the credential behind it turns out to be
 * bad the SDK throws — which is far better than quietly succeeding into a
 * directory that is about to evaporate.
 */
const useBlob = () =>
  Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
const localRoot = path.join(process.cwd(), 'uploads');

/**
 * The disk fallback is a development convenience and nothing more. On a real
 * deployment it means the photographs are being written somewhere that will
 * not exist tomorrow, and the ID card attached to a loan is the evidence the
 * whole approval process rests on — so say so, loudly, once per cold start,
 * rather than letting it look like everything worked.
 */
let warnedAboutDisk = false;
function warnDiskFallback(): void {
  if (warnedAboutDisk || process.env.NODE_ENV !== 'production') return;
  warnedAboutDisk = true;
  console.error(
    '[storage] ไม่พบ Blob store — กำลังเขียนรูปลงดิสก์ของ instance ซึ่งจะหายทุก cold start · ' +
      'ต่อ Blob store ใน Vercel (จะได้ BLOB_STORE_ID) หรือตั้ง BLOB_READ_WRITE_TOKEN'
  );
}

/**
 * `equipment` is the odd one out: catalogue photographs are not health data
 * and are shown to the public on the landing page, so they are served by
 * /api/equipment-photo without a session. The other two are health data and
 * only ever leave through /api/files, which checks one.
 */
export type Folder = 'id_cards' | 'illness_photos' | 'equipment';

/**
 * Which folders are stored as private blobs.
 *
 * Everything used to be `access: 'public'`, with security resting entirely on
 * a 64-bit random key in the URL. That is fine until the URL escapes — a log
 * line, an error report, a screenshot, a Referer — and then the ID card of a
 * named person is readable by anyone on the internet, permanently, with no way
 * to revoke it. Private blobs are fetched with the store's token, so a leaked
 * URL is worth nothing on its own.
 *
 * Equipment photographs stay public: they are catalogue pictures shown on the
 * public landing page, and serving them through a signed fetch would put every
 * home-page image through a function for no benefit.
 */
const isPrivate = (folder: Folder) => folder !== 'equipment';
const folderOf = (id: string) => id.split('/')[0] as Folder;

/**
 * The extension comes from the sniffed MIME type, never from the uploaded
 * filename. The old code took `path.extname(file.originalname)` verbatim, so a
 * file claiming to be an image but named `x.html` was stored as .html and later
 * served as HTML to a logged-in staff member — stored XSS.
 */
export async function saveUpload(folder: Folder, file: File): Promise<string> {
  if (!ALLOWED.has(file.type)) {
    throw new Error('รองรับเฉพาะไฟล์รูปภาพ (jpg, png, webp, heic)');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('ไฟล์ใหญ่เกิน 8MB กรุณาย่อรูปก่อนอัปโหลด');
  }

  // Everything above came from the client. `file.type` is a claim, and a
  // claim was the only check: send any bytes at all with type image/png and
  // they were stored. Re-encoding is what turns the claim into a fact — a
  // file sharp cannot decode as an image is not an image — and it strips EXIF
  // on the way through, which matters because a photograph of an ID card
  // taken at home carries the GPS coordinates of that home.
  const bytes = await reencode(Buffer.from(await file.arrayBuffer()));
  const id = `${folder}/${Date.now()}_${crypto.randomBytes(8).toString('hex')}.webp`;

  if (useBlob()) {
    await put(id, bytes, {
      access: isPrivate(folder) ? 'private' : 'public',
      contentType: 'image/webp',
      addRandomSuffix: false,
    });
  } else {
    // Local dev fallback so the app runs without a Blob store connected.
    warnDiskFallback();
    const target = path.join(localRoot, id);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes);
  }

  return id;
}

/**
 * Decode whatever arrived and write a clean WebP back out.
 *
 * Three things at once: it proves the bytes really are an image, it discards
 * every metadata block including EXIF and GPS, and it bounds what is stored —
 * the browser already downscales, but the browser is not the only thing that
 * can post to this endpoint.
 *
 * `failOn: 'none'` keeps a slightly malformed but readable photo from a cheap
 * phone camera working; a file that is not an image at all still throws,
 * which is the check that matters.
 */
async function reencode(input: Buffer): Promise<Buffer> {
  try {
    return await sharp(input, { failOn: 'none', limitInputPixels: 50_000_000 })
      // Honour the camera's orientation flag before the flag is thrown away.
      .rotate()
      .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new Error('ไฟล์นี้ไม่ใช่รูปภาพที่อ่านได้ กรุณาเลือกรูปใหม่');
  }
}

export async function readUpload(
  id: string
): Promise<{ body: ReadableStream | Buffer; contentType: string } | null> {
  // Reject traversal before the id ever reaches the filesystem or Blob. The
  // older extensions stay accepted because files stored before uploads were
  // re-encoded still carry them.
  if (!/^(id_cards|illness_photos|equipment)\/[A-Za-z0-9_]+\.(jpg|png|webp|heic|heif)$/.test(id)) {
    return null;
  }

  if (useBlob()) {
    try {
      // A private blob is read with the store's token rather than by URL, so
      // knowing the path is not enough to fetch it.
      const result = await get(id, { access: isPrivate(folderOf(id)) ? 'private' : 'public' });
      if (!result || !result.stream) return null;
      return {
        body: result.stream,
        contentType: result.blob.contentType || 'application/octet-stream',
      };
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
    await del(id).catch(() => {});
  } else {
    await fs.unlink(path.join(localRoot, id)).catch(() => {});
  }
}

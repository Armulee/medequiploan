'use client';

/**
 * Downscales and re-encodes a photo in the browser before it is uploaded.
 *
 * A photo straight from a phone camera is commonly 2-5MB, which is slow to
 * send over mobile data — the situation most people filling in the public form
 * are actually in — and eats the blob storage quota for no benefit: these
 * images are only ever viewed on screen to check an ID card or an injury.
 *
 * The server still decides what it will accept; this only reduces what gets
 * sent. If anything here fails the original file is returned unchanged, so a
 * browser without canvas support or an unusual image still uploads.
 */

const MAX_EDGE = 1600;
const QUALITY = 0.82;
/** Below this, re-encoding tends to cost more than it saves. */
const SKIP_UNDER_BYTES = 400 * 1024;

export async function resizeImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= SKIP_UNDER_BYTES) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', QUALITY)
    );
    // Some browsers ignore an unsupported type and hand back PNG, which can be
    // larger than the JPEG we started with. Only take the result if it wins.
    if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) return file;

    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', {
      type: 'image/webp',
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

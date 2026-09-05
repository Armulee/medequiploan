'use client';

/**
 * A cheap readability check on a photo before it is sent.
 *
 * The point of the ID-card photograph is that a staff member can read it. A
 * dark, blurred or thumbnail-sized picture passes every server-side check —
 * it is a valid JPEG of the right size — and is only discovered to be useless
 * later, when the person is no longer standing there to take another one.
 *
 * This is a hint, never a gate: it warns and still lets the upload through.
 * Blur measured this way is a heuristic, and refusing a real submission from
 * an old phone would be a much worse failure than accepting a soft photo.
 */

export type PhotoQuality = {
  width: number;
  height: number;
  /** Variance of the Laplacian: higher is sharper. Flat/blurred images tend near zero. */
  sharpness: number;
  /** Mean luminance 0-255, to catch a photo taken in the dark. */
  brightness: number;
};

/** Long edge below this and small print stops being legible on screen. */
const MIN_LONG_EDGE = 900;
const BLURRY_UNDER = 25;
const DARK_UNDER = 55;

export async function inspectPhoto(file: File): Promise<PhotoQuality | null> {
  if (!file.type.startsWith('image/')) return null;
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;

    // Measured on a fixed-width copy so the numbers mean the same thing
    // whatever the camera resolution was.
    const w = 512;
    const h = Math.max(1, Math.round((bitmap.height / bitmap.width) * w));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const { data } = ctx.getImageData(0, 0, w, h);
    const grey = new Float32Array(w * h);
    let sum = 0;
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      // Rec. 601 luma, which is what "how bright does this look" means.
      const g = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
      grey[p] = g;
      sum += g;
    }
    const brightness = sum / grey.length;

    // 4-neighbour Laplacian, then its variance over the interior.
    let lapSum = 0;
    let lapSqSum = 0;
    let n = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const lap =
          4 * grey[i]! - grey[i - 1]! - grey[i + 1]! - grey[i - w]! - grey[i + w]!;
        lapSum += lap;
        lapSqSum += lap * lap;
        n++;
      }
    }
    const mean = lapSum / n;
    const sharpness = lapSqSum / n - mean * mean;

    return { width, height, sharpness, brightness };
  } catch {
    return null;
  }
}

/** Thai wording for whatever is wrong, or null when the photo looks usable. */
export function photoWarning(q: PhotoQuality | null): string | null {
  if (!q) return null;
  if (Math.max(q.width, q.height) < MIN_LONG_EDGE) {
    return 'รูปมีความละเอียดต่ำ เจ้าหน้าที่อาจอ่านตัวหนังสือบนบัตรไม่ออก — ถ้าเป็นไปได้ให้ถ่ายใหม่';
  }
  if (q.brightness < DARK_UNDER) {
    return 'รูปมืดไป ลองถ่ายใหม่ในที่ที่สว่างกว่านี้';
  }
  if (q.sharpness < BLURRY_UNDER) {
    return 'รูปอาจเบลอ ลองถ่ายใหม่ให้ชัดขึ้น (ยังส่งรูปนี้ได้ถ้ามั่นใจว่าอ่านออก)';
  }
  return null;
}

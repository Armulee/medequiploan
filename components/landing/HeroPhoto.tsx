// Art direction, not just resolution: below 861px the page shows a portrait
// crop with the equipment beneath the headline, above it a landscape crop with
// the equipment beside it. Only <picture media> can switch the file itself,
// which is why this is not next/image — that optimises one crop, it does not
// choose between two.
//
// Widths and formats come from scripts/generate-hero-images.py; AVIF first,
// WebP for Safari before 16.4, JPEG for anything older.

const WIDE = [768, 1152, 1672];
const TALL = [480, 720, 941];

const set = (stem: string, widths: number[], ext: string) =>
  widths.map((w) => `/assets/hero/${stem}-${w}.${ext} ${w}w`).join(', ');

const PHONE = '(max-width: 640px)';

export default function HeroPhoto() {
  return (
    <picture className="hero-photo">
      <source media={PHONE} type="image/avif" srcSet={set('tall', TALL, 'avif')} sizes="100vw" />
      <source media={PHONE} type="image/webp" srcSet={set('tall', TALL, 'webp')} sizes="100vw" />
      <source media={PHONE} type="image/jpeg" srcSet={set('tall', TALL, 'jpg')} sizes="100vw" />
      <source type="image/avif" srcSet={set('wide', WIDE, 'avif')} sizes="100vw" />
      <source type="image/webp" srcSet={set('wide', WIDE, 'webp')} sizes="100vw" />
      <img
        src="/assets/hero/wide-1152.jpg"
        srcSet={set('wide', WIDE, 'jpg')}
        sizes="100vw"
        width={1672}
        height={941}
        alt="วีลแชร์ ไม้ค้ำยัน และเครื่องผลิตออกซิเจน วางอยู่ในห้องนั่งเล่นที่บ้าน"
        // This is the largest thing on the page; without the hint the browser
        // discovers it late and it becomes the slow paint.
        fetchPriority="high"
        decoding="async"
      />
    </picture>
  );
}

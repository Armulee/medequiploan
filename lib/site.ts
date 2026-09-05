/**
 * Site-level facts the <head> needs: who this is, and what URL to call home.
 *
 * Absolute URLs matter here — Facebook, LINE and X will not fetch a relative
 * og:image, and a canonical that points at a preview deployment tells search
 * engines the preview is the real site. So the production domain is read
 * first from NEXT_PUBLIC_SITE_URL, then from the domain Vercel marks as
 * production; VERCEL_URL is deliberately not used, because it changes on
 * every deployment.
 */

export const SITE_NAME = 'ศูนย์ยืม-คืนกายอุปกรณ์การแพทย์';
export const SITE_NAME_SHORT = 'ยืม-คืนกายอุปกรณ์';

export const SITE_DESCRIPTION =
  'ยืมกายอุปกรณ์การแพทย์ฟรี ไม่มีค่าใช้จ่าย — วีลแชร์ ไม้ค้ำยัน เตียงผู้ป่วย ' +
  'เครื่องผลิตออกซิเจน สำหรับผู้ป่วยและผู้ดูแลที่บ้าน ส่งคำขอออนไลน์ได้ทันที ' +
  'ไม่ต้องสมัครสมาชิก เจ้าหน้าที่ตรวจสอบและติดต่อกลับภายในไม่กี่วัน';

export const EQUIPMENT_KINDS = [
  'วีลแชร์',
  'รถเข็นผู้ป่วย',
  'ไม้ค้ำยัน',
  'เตียงผู้ป่วย',
  'เครื่องผลิตออกซิเจน',
  'ที่นอนลม',
  'ไม้เท้า',
];

/**
 * Facts a search engine wants for a service people physically travel to, and
 * that this codebase cannot know. Fill these in and they appear in the
 * structured data; leave one empty and it is omitted rather than guessed.
 * Address and phone are the single biggest remaining win for local search.
 */
export const ORGANIZATION = {
  /** Narrow this to the province or district actually served, e.g. 'จังหวัดนนทบุรี'. */
  areaServed: 'ประเทศไทย',
  telephone: '',
  streetAddress: '',
  addressLocality: '',
  addressRegion: '',
  postalCode: '',
} as const;

/**
 * The commit this bundle was built from, stamped into the page as a meta tag.
 * "Is my change live yet?" is otherwise a guessing game played by comparing
 * screenshots; with this it is one look at the page source. Vercel sets the
 * variable at build time, so locally it reads "dev".
 */
export const BUILD = (process.env.VERCEL_GIT_COMMIT_SHA || 'dev').slice(0, 7);

export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000')
).replace(/\/$/, '');

export const absolute = (path: string) => new URL(path, siteUrl).toString();

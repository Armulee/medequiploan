/**
 * Run before deploying (or in CI) to catch a half-configured environment
 * while it is still cheap to fix. `npx tsx scripts/check-env.ts`
 */
import './load-env';

const problems: string[] = [];

const dbUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING;

if (!dbUrl) {
  problems.push('ไม่พบ connection string ของฐานข้อมูล (DATABASE_URL หรือ POSTGRES_URL)');
} else if (/-pooler\./.test(dbUrl) === false && /\.neon\.tech/.test(dbUrl)) {
  problems.push(
    'DATABASE_URL ชี้ไป Neon แบบ unpooled — ใช้ connection string แบบ Pooled ' +
      '(มี "-pooler" ในชื่อ host) ไม่งั้น connection จะเต็มตอนมีคนใช้พร้อมกัน'
  );
}

const secret = process.env.SESSION_SECRET;
if (!secret) problems.push('ไม่พบ SESSION_SECRET (สุ่มด้วย: openssl rand -base64 48)');
else if (secret.length < 32) problems.push('SESSION_SECRET สั้นเกินไป ต้องยาวอย่างน้อย 32 ตัวอักษร');

const key = process.env.ENCRYPTION_KEY;
if (!key) {
  problems.push('ไม่พบ ENCRYPTION_KEY (สุ่มด้วย: openssl rand -base64 32)');
} else if (Buffer.from(key, 'base64').length !== 32) {
  problems.push('ENCRYPTION_KEY ต้องเป็น base64 ของข้อมูล 32 ไบต์พอดี');
}

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.warn(
    '⚠️  ไม่พบ BLOB_READ_WRITE_TOKEN — รูปที่อัปโหลดจะถูกเก็บลงดิสก์ของเครื่องที่รัน ' +
      'ซึ่งบน Vercel จะหายทุก cold start เชื่อม Blob store ก่อนใช้งานจริง\n' +
      '   รูปบัตรประชาชนบังคับแนบทุกคำขอ ถ้ารูปหายคำขอเก่าจะตรวจสอบย้อนหลังไม่ได้'
  );
}

const rp = process.env.WEBAUTHN_RP_ID;
if (rp) {
  // An RP id is a bare domain. A scheme, a port or a path in there does not
  // fail loudly — it fails as "every passkey on this deployment stops working",
  // which is a much worse afternoon.
  if (/[:/]/.test(rp)) {
    problems.push(
      `WEBAUTHN_RP_ID ต้องเป็นชื่อโดเมนล้วน ๆ (เช่น example.org) ไม่ใช่ "${rp}" — ห้ามมี https:// หรือ :port หรือ path`
    );
  } else if (/^\d+\.\d+\.\d+\.\d+$/.test(rp)) {
    problems.push('WEBAUTHN_RP_ID เป็นเลข IP ไม่ได้ พาสคีย์ต้องผูกกับชื่อโดเมน');
  }
} else {
  console.warn(
    '⚠️  ไม่ได้ตั้ง WEBAUTHN_RP_ID — ระบบจะอ่านโดเมนจาก header ที่เบราว์เซอร์เรียกมา ซึ่งใช้งานได้ปกติ\n' +
      '   ตั้งไว้เป็นโดเมนจริงจะดีกว่า เพราะตรึงค่าไว้แน่นอน · แต่ถ้ามีคนสร้างพาสคีย์ไปแล้ว ' +
      'การเปลี่ยนค่านี้ทีหลังจะทำให้พาสคีย์เดิมใช้ไม่ได้ทั้งหมด'
  );
}

// Turnstile is all-or-nothing: one key without the other is a form that either
// shows a challenge nobody checks, or checks one that never renders.
const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const secretKey = process.env.TURNSTILE_SECRET_KEY;
if (Boolean(siteKey) !== Boolean(secretKey)) {
  problems.push(
    'Turnstile ตั้งไม่ครบ — ต้องมีทั้ง NEXT_PUBLIC_TURNSTILE_SITE_KEY และ TURNSTILE_SECRET_KEY ' +
      'หรือไม่ตั้งเลยทั้งคู่ (ปิดการใช้งาน)'
  );
}

if (problems.length > 0) {
  console.error('❌ ตั้งค่าไม่ครบ:\n' + problems.map((p) => '   - ' + p).join('\n'));
  process.exit(1);
}

console.log('✅ ตั้งค่าครบถ้วน พร้อม deploy');

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
      'ซึ่งบน Vercel จะหายทุก cold start เชื่อม Blob store ก่อนใช้งานจริง'
  );
}

if (problems.length > 0) {
  console.error('❌ ตั้งค่าไม่ครบ:\n' + problems.map((p) => '   - ' + p).join('\n'));
  process.exit(1);
}

console.log('✅ ตั้งค่าครบถ้วน พร้อม deploy');

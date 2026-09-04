# CLAUDE.md

คำแนะนำสำหรับ Claude Code (หรือ Claude ตัวไหนก็ตาม) เมื่อทำงานต่อในโปรเจกต์นี้

## โปรเจกต์นี้คืออะไร

ระบบยืม-คืนกายอุปกรณ์การแพทย์ — เว็บแอป **Next.js (App Router) + PostgreSQL**
deploy บน Vercel อ่านรายละเอียดฟีเจอร์ที่ `README.md` และวิธี deploy ที่ `DEPLOY.md`

> เวอร์ชันแรกเป็น Express + ไฟล์ JSON ตอนนี้ย้ายมา Next.js + Postgres แล้ว
> ดูเหตุผลและสิ่งที่เปลี่ยนได้จาก git log

## สถาปัตยกรรม

- **Backend**: `app/api/**/route.ts` (REST API) → `lib/*.ts`
  - `lib/db/schema.ts` — Drizzle schema 7 ตาราง · ID อ่านง่าย (B0001, E0001) มาจาก Postgres sequence
  - `lib/db/index.ts` — เลือก driver อัตโนมัติ: Neon HTTP บน production, node-postgres เมื่อชี้ localhost
  - `lib/borrow.ts` — business logic ยืม/คืน (ใช้ร่วมกันระหว่าง staff-borrow กับ approve-request)
  - `lib/crypto.ts` — AES-256-GCM สำหรับเลขบัตรประชาชน + keyed hash ไว้ค้นหา
  - `lib/api.ts` — `route()` wrapper, `requireAuth()`, `requireRole()`
  - `lib/session.ts` — iron-session · `lib/storage.ts` — Vercel Blob (fallback ลงดิสก์ตอน dev)
- **Frontend**: React ทั้งหมด — `app/page.tsx` (หน้าแรก), `app/request/` (ฟอร์มสาธารณะ),
  `app/staff/` (แอปเจ้าหน้าที่ tab-based) · component อยู่ที่ `components/`
- **ธีม**: สีส้ม `#FF6C1D` ตาม CSS variables ที่ `:root` ใน `app/globals.css`
  ฟอนต์ Kanit (หัวข้อ) + Noto Sans Thai (เนื้อหา) ไอคอนใช้ `components/Icon.tsx` (inline SVG)

## กติกาเมื่อแก้ไข/เพิ่มฟีเจอร์

- **PII**: เลขบัตรประชาชนต้องผ่าน `encrypt()` เสมอ ห้ามเก็บ plain text · ค้นหาด้วย
  `nationalIdHash()` อย่า decrypt ทั้งตารางมา filter
- **สิทธิ์**: ทุก endpoint ที่แตะข้อมูลผู้ยืม/รูปภาพ ต้องเรียก `requireAuth()` หรือ `requireRole()`
- **Audit**: ทุกการกระทำที่มีผลต่อข้อมูลต้องเรียก `logAction()`
- **รูปภาพ**: เป็นข้อมูลสุขภาพ เสิร์ฟผ่าน `/api/files/[...id]` ที่เช็ค session เท่านั้น
  ห้ามส่ง URL ของ storage ตรง ๆ ให้ client · นามสกุลไฟล์ต้องมาจาก MIME type ไม่ใช่ชื่อไฟล์ที่อัปโหลด
- **ความถูกต้องของสต็อก**: การเปลี่ยนจำนวนที่ต้อง atomic ให้เขียนเป็น **statement เดียว**
  (data-modifying CTE + guard ใน WHERE) อย่าอ่านมาเช็คแล้วค่อยเขียน — Neon HTTP driver
  ไม่มี interactive transaction และการแยกอ่าน/เขียนเปิดช่องให้ race
- **`db.execute()` คืน column เป็น snake_case** ไม่ใช่ camelCase ของ Drizzle — ต้อง map เอง
- **สี/ฟอนต์**: ใช้ CSS variables ที่มีอยู่ อย่า hardcode สีใหม่กระจัดกระจาย
- **PDPA consent**: ฟอร์มที่เก็บข้อมูลส่วนบุคคลต้องมี `ConsentNotice` และ **server ต้องเช็ค
  `consent === 'true'` เอง** ไม่ใช่เชื่อ checkbox ฝั่ง client · บันทึกเวลา + `CONSENT_VERSION`
  ทุกครั้ง ถ้าแก้ข้อความประกาศใน `lib/consent.ts` ต้องขึ้น version ด้วย
- **Rate limit**: endpoint ที่เปิดสาธารณะหรือรับรหัสผ่าน ต้องผ่าน `hit()` จาก `lib/rate-limit.ts`
  · เก็บ counter ใน Postgres ไม่ใช่ memory (serverless แต่ละ instance ไม่แชร์กัน)
  · limiter ออกแบบให้ **fail open** — ถ้ามันพัง ต้องไม่ล็อกเจ้าหน้าที่ออกจากระบบทั้งองค์กร
- ก่อน commit: `npx tsc --noEmit` และ `npx next build` (ยังไม่มี automated test suite)

## คำสั่งที่ใช้บ่อย

```bash
npm install
npm run check-env         # ตรวจว่า env ครบก่อน deploy
npm run db:generate       # สร้าง migration จาก schema
npm run db:migrate        # รัน migration ที่ยังไม่ได้รัน (มี ledger กันรันซ้ำ)
npm run seed              # สร้างผู้ใช้ + อุปกรณ์ตัวอย่าง (ต้องตั้ง SEED_*_PASSWORD ก่อน)
npm run dev               # http://localhost:3000
npm run build             # production build
```

## Environment variables

| ตัวแปร | จำเป็น | หมายเหตุ |
|---|---|---|
| `DATABASE_URL` | ✅ | Neon แบบ **pooled** (มี `-pooler` ใน host) · Vercel integration อาจฉีดมาเป็น `POSTGRES_URL` ซึ่งโค้ดรองรับแล้ว |
| `SESSION_SECRET` | ✅ | `openssl rand -base64 48` · ไม่ตั้ง = แอปไม่ boot (ตั้งใจ) |
| `ENCRYPTION_KEY` | ✅ | `openssl rand -base64 32` · **ทำหายคือเลขบัตรทุกคนอ่านไม่ออกถาวร** เก็บสำรองไว้ที่อื่นด้วย |
| `BLOB_READ_WRITE_TOKEN` | production | ไม่ตั้ง = รูปเก็บลงดิสก์ ซึ่งบน Vercel หายทุก cold start |
| `SEED_ADMIN_PASSWORD` / `SEED_STAFF_PASSWORD` | ตอน seed | ไม่มีรหัสผ่านเริ่มต้นให้แล้ว |

## สิ่งที่ยังไม่ได้ทำ (โอกาสพัฒนาต่อ)

- ยังไม่มีหน้าจอจัดการผู้ใช้ (เพิ่ม/ลบ/รีเซ็ตรหัสผ่านเจ้าหน้าที่) — schema มีคอลัมน์ `active` รออยู่แล้ว
- ยังไม่ได้ย่อรูปก่อนอัปโหลด (รูป 2MB กิน bandwidth และ Blob quota เร็ว)
- ยังไม่มี data retention / auto-delete policy ตาม PDPA (ประกาศระบุไว้ว่าเก็บ 2 ปีหลังยืมครั้งสุดท้าย แต่ยังไม่มีระบบลบอัตโนมัติ)
- ยังไม่มี automated test suite
- ยังไม่รองรับหลายภาษา (UI เป็นภาษาไทยล้วน)
- ข้อมูลอยู่บนเซิร์ฟเวอร์นอกประเทศไทย (Neon/Vercel) — ถ้าต้องการให้อยู่ในไทยตาม PDPA
  ต้องย้ายไป AWS RDS ap-southeast-7 (Bangkok) ซึ่งเป็นแค่การเปลี่ยน connection string

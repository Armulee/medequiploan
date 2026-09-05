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
  `app/staff/` (แอปเจ้าหน้าที่) · component อยู่ที่ `components/`
  · **ทุกเมนูของหน้าเจ้าหน้าที่เป็น route จริง** ไม่ใช่ tab state:
  `/staff` (ภาพรวม) `/staff/register` `/staff/borrow` `/staff/requests` `/staff/stock`
  `/staff/history` `/staff/users` `/staff/settings` และหน้ารายละเอียด
  `/staff/requests/[id]` `/staff/records/[id]` `/staff/borrowers/[id]` `/staff/users/[id]`
  `/staff/audit/[id]` · `app/staff/layout.tsx` ถือ `SessionProvider` + `<Toaster />` +
  ประตูล็อกอิน (`StaffFrame`) ให้ทั้งกลุ่ม แปลว่าเปลี่ยนหน้าไม่ต้องเช็ค session ใหม่
  · page.tsx เป็น server component บาง ๆ · หน้าที่อ่าน query string ต้องหุ้ม `<Suspense>`
  (`useSearchParams` บังคับ) · หน้าที่ต้องรู้ role ให้ดึงจาก `useSession()` ใน client wrapper
- **ธีม**: สีส้ม `#FF6C1D` ตาม CSS variables ที่ `:root` ใน `app/app.css`
  ฟอนต์ Kanit (หัวข้อ) + Noto Sans Thai (เนื้อหา)
- **UI kit**: ใช้ **shadcn/ui** ได้ (`components/ui/`) — dialog, sheet, toaster มีแล้ว
  เพิ่มตัวใหม่ให้ก๊อป source มาไว้ใน `components/ui/` แล้วเปลี่ยนสีให้ใช้ CSS variables ของโปรเจกต์
  · **ไอคอนใช้ `lucide-react` เท่านั้น** ห้ามวาด SVG เอง
  ยกเว้น `components/Logo.tsx` ซึ่งเป็นโลโก้หัวใจตัวเดียวที่เหลือ (favicon generate จาก path นี้)

## กติกาเมื่อแก้ไข/เพิ่มฟีเจอร์

- **PII**: เลขบัตรประชาชนต้องผ่าน `encrypt()` เสมอ ห้ามเก็บ plain text · ค้นหาด้วย
  `nationalIdHash()` อย่า decrypt ทั้งตารางมา filter
- **สิทธิ์**: ทุก endpoint ที่แตะข้อมูลผู้ยืม/รูปภาพ ต้องเรียก `requireAuth()` หรือ `requireRole()`
  · เฉพาะ admin: จัดการเจ้าหน้าที่ (`/api/users`), audit log, จัดการสต็อก
  · การซ่อนแท็บใน UI ไม่ใช่การป้องกัน — API ต้องเช็คเองเสมอ
- **Audit**: ทุกการกระทำที่มีผลต่อข้อมูลต้องเรียก `logAction()`
- **รูปภาพ**: รูปบัตร/รูปอาการเป็นข้อมูลสุขภาพ เสิร์ฟผ่าน `/api/files/[...id]` ที่เช็ค session เท่านั้น
  ห้ามส่ง URL ของ storage ตรง ๆ ให้ client · นามสกุลไฟล์ต้องมาจาก MIME type ไม่ใช่ชื่อไฟล์ที่อัปโหลด
  · **ข้อยกเว้นเดียว**: รูปแคตตาล็อกอุปกรณ์ (folder `equipment`) ไม่ใช่ข้อมูลสุขภาพ
  ขึ้นบนหน้าแรกสาธารณะ เสิร์ฟผ่าน `/api/equipment-photo/[...id]` ซึ่ง**ไม่เช็ค session**
  แต่ล็อก prefix ไว้ที่ `equipment/` เท่านั้น เดินเข้าโฟลเดอร์ข้อมูลสุขภาพไม่ได้
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
- **Tailwind ห้ามเปิด preflight**: `app/globals.css` import แค่ theme + utilities
  · CSS เดิมอยู่ใน `app/app.css` ซึ่งถูก import เข้า `@layer app` ที่ประกาศไว้**ก่อน** layer ของ Tailwind
  แปลว่า utility ของ Tailwind ชนะ CSS เดิมได้ (จำเป็นสำหรับ shadcn) แต่ preflight ไม่มาล้าง `.btn` `.card` `.badge` ทิ้ง
- **แจ้งผลด้วย toast** (`sonner`) สำหรับ success/error ของการกระทำในหน้าเจ้าหน้าที่
  · `<Toaster />` mount ที่ `app/staff/layout.tsx` เท่านั้น หน้าสาธารณะไม่ต้องโหลด
  · **ห้ามฝัง `<Alert>` ในหน้า staff อีก** — เหลือที่เดียวคือ `LoginView` (ยังไม่มี frame ให้ toast เกาะ
  และข้อความ rate limit ต้องอยู่ค้างให้อ่าน)
  · ข้อความ validate ของฟอร์มยังใช้ inline **ใต้ช่องที่ผิด** ด้วย `.hint.hint-error`
  (toast แจ้ง "จำนวนต้องมากกว่า 0" ทั้งที่ช่องอยู่ตรงหน้าคือแย่กว่า แถม toast ยังบังช่องนั้นอีก)
- ก่อน commit: `npx tsc --noEmit` และ `npx next build` (ยังไม่มี automated test suite ถาวร)
  · ถ้าแตะหน้าเจ้าหน้าที่ ให้เทสด้วยของจริง: ยก Postgres ในเครื่อง (`initdb` ต้องรันด้วย user ที่ไม่ใช่ root)
  ตั้ง `.env.local` ชี้ไปที่นั้น แล้ว `npm run db:migrate && npm run seed` — แล้วไล่ทุกหน้าทั้งบัญชี
  staff และ admin (สิทธิ์คนละชุด เห็นคนละเมนู)

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

- ยังไม่ได้ย่อรูปก่อนอัปโหลด (รูป 2MB กิน bandwidth และ Blob quota เร็ว)
- ยังไม่มี data retention / auto-delete policy ตาม PDPA (ประกาศระบุไว้ว่าเก็บ 2 ปีหลังยืมครั้งสุดท้าย แต่ยังไม่มีระบบลบอัตโนมัติ)
- ยังไม่มี automated test suite
- ยังไม่รองรับหลายภาษา (UI เป็นภาษาไทยล้วน)
- ข้อมูลอยู่บนเซิร์ฟเวอร์นอกประเทศไทย (Neon/Vercel) — ถ้าต้องการให้อยู่ในไทยตาม PDPA
  ต้องย้ายไป AWS RDS ap-southeast-7 (Bangkok) ซึ่งเป็นแค่การเปลี่ยน connection string

## รูปแบบที่ใช้ซ้ำในหน้าเจ้าหน้าที่

- **Dialog**: ใช้ `components/Dialog.tsx` เสมอ **ห้ามใช้ `window.prompt()`/`confirm()`**
  (แต่งหน้าตาไม่ได้ ตรวจค่าก่อนปิดไม่ได้ ใส่ date picker ไม่ได้)
  · ตัวนี้เป็น adapter บาง ๆ ทับ `components/ui/dialog.tsx` (shadcn/Radix) — ได้ focus trap มาด้วย
- **เมนูบนมือถือ**: หน้าเจ้าหน้าที่ใช้ `Sheet` ของ shadcn เปิดจากปุ่มใน header
  ไม่มี bottom tab bar แล้ว (7 แท็บบนจอ 393px = ปุ่มละ 55px ซึ่งกดไม่ได้จริง)
  · ทุกปลายทางเป็น `<Link>` ไม่ใช่ `<button>` — เปิดแท็บใหม่ได้ และปุ่ม back ของเครื่องใช้ได้จริง
  · แท็บไหน active ดูจาก `usePathname()` ใน `AppShell` (หน้า `[id]` ผูกกลับไปที่แท็บแม่ด้วย `also`)
- **หน้ารายละเอียดใช้ `BackLink`** ซึ่งเป็นลิงก์ไปปลายทางจริง ไม่ใช่ `onBack` ที่ล้าง state
  (deep link ตรงเข้าหน้ารายละเอียดแล้วยังกดกลับได้ถูกที่)
- **แท็บ/ตัวกรองที่ผู้ใช้จะกดกลับมาดูซ้ำ เก็บใน query string** เช่น `/staff/history?tab=audit`,
  `/staff/borrow?filter=overdue`, `/staff/stock?low=1` — dashboard ลิงก์ตรงเข้าไปด้วย state นั้นเลย
- **การกระทำที่ย้อนกลับยาก** (ตัดสต็อก เพิ่มสต็อก ปิดบัญชี) ต้องมี **2 ขั้นตอน**
  ขั้นที่สองสรุปให้เห็นว่าตัวเลขจะเปลี่ยนจากเท่าไหร่เป็นเท่าไหร่
- **แก้บัญชีตัวเอง** ใช้ `PATCH /api/auth/me` ซึ่งเอา id จาก session ไม่ใช่จาก request
  จะชี้ไปแถวคนอื่นไม่ได้ · เปลี่ยน username หรือรหัสผ่านต้องกรอกรหัสผ่านปัจจุบัน (มี rate limit)
  · สิทธิ์กับการเปิด-ปิดบัญชีแก้ที่นี่ไม่ได้ ต้องผ่าน `/api/users/[id]` ที่บังคับ admin
- **บัญชีเจ้าหน้าที่ปิดใช้งาน ไม่ลบ** — ทุกรายการยืม/คืน/อนุมัติอ้างถึงผู้ทำรายการ
  ลบแถวทิ้งจะทำให้ audit log อ่านไม่รู้เรื่อง · และต้องเหลือ admin ที่ใช้งานได้อย่างน้อย 1 คน

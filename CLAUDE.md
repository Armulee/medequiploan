# CLAUDE.md

คำแนะนำสำหรับ Claude Code (หรือ Claude ตัวไหนก็ตาม) เมื่อทำงานต่อในโปรเจกต์นี้

## โปรเจกต์นี้คืออะไร

ระบบยืม-คืนกายอุปกรณ์การแพทย์ — เว็บแอป Node.js/Express แบบ full-stack เก็บข้อมูลเป็นไฟล์ JSON local (ไม่ใช้ฐานข้อมูลจริง) ตามที่ผู้ใช้ระบุไว้ตอนแรก อ่านรายละเอียดฟีเจอร์ครบถ้วนได้ที่ `README.md` และวิธี deploy ที่ `DEPLOY.md`

## สถาปัตยกรรม

- **Backend**: `server/server.js` (entrypoint) → `server/routes/*.js` (REST API แยกตามโมดูล: auth, borrowers, equipment, records, requests, audit) → `server/lib/*.js` (db.js คือ JSON file storage แบบมี queue กันเขียนชนกัน, crypto.js เข้ารหัส AES-256-GCM สำหรับเลขบัตร ปชช., borrow.js คือ business logic กลางของการยืม/คืนที่ทั้ง records.js และ requests.js เรียกใช้ร่วมกัน)
- **Frontend**: vanilla JS ล้วน ไม่มี build step — `public/index.html` (หน้าแรกสาธารณะ), `public/request.html` + `js/request.js` (ฟอร์มคำขอสาธารณะ), `public/staff.html` + `js/app.js` (แอปเจ้าหน้าที่ SPA แบบ tab-based, ไม่มี router library, สลับหน้าจอด้วย `switchTab()`)
- **ธีม**: สีส้ม `#FF6C1D` ตาม design tokens ใน `public/css/style.css` (CSS variables ที่ `:root`) ฟอนต์ Kanit (หัวข้อ) + Noto Sans Thai (เนื้อหา) จาก Google Fonts ไอคอนใช้ inline SVG (feather-icons style) ไม่ใช้ emoji หรือ icon library ภายนอก

## กติกาเมื่อแก้ไข/เพิ่มฟีเจอร์

- ข้อมูล PII (เลขบัตรประชาชน) ต้องเข้ารหัสก่อนเขียนลง JSON เสมอ — ใช้ `encrypt()`/`decrypt()` จาก `server/lib/crypto.js` อย่าเก็บ plain text
- ทุก endpoint ที่แตะข้อมูลผู้ยืม/รูปภาพ ต้องมี `requireAuth` หรือ `requireRole()` จาก `server/middleware/auth.js`
- ทุกการกระทำที่มีผลต่อข้อมูล (ยืม/คืน/อนุมัติ/ปฏิเสธ/ลงทะเบียน) ต้องเรียก `logAction()` จาก `server/lib/audit.js` เพื่อให้ audit log สมบูรณ์
- การเขียนไฟล์ JSON ต้องผ่าน `db.update()`/`db.write()` ใน `server/lib/db.js` เท่านั้น (ห้าม `fs.writeFileSync` ตรง ๆ) เพราะมันคิว write กันไฟล์เขียนชนกัน
- ฟอนต์/สี ให้ใช้ CSS variables ที่มีอยู่แล้วใน `:root` ของ `style.css` อย่า hardcode สีส้มใหม่กระจัดกระจาย
- ทดสอบด้วย `node --check` กับไฟล์ JS ฝั่ง client ก่อน commit เสมอ (ไม่มี build/test suite อัตโนมัติในโปรเจกต์นี้ — ทดสอบ manual ผ่าน curl/Playwright screenshot ถ้าเป็นไปได้)

## คำสั่งที่ใช้บ่อย

```bash
npm install
npm run seed      # รีเซ็ต/สร้างข้อมูลเริ่มต้น (ผู้ใช้ + อุปกรณ์ตัวอย่าง)
npm start         # รันที่ http://localhost:3000
```

## สิ่งที่ยังไม่ได้ทำ (โอกาสพัฒนาต่อ)

- ยังไม่มีหน้าจอจัดการผู้ใช้ (เพิ่ม/ลบ/รีเซ็ตรหัสผ่านเจ้าหน้าที่) — ตอนนี้ต้องรันสคริปต์เอง (ดู README หัวข้อ "การจัดการผู้ใช้")
- ยังไม่มี data retention / auto-delete policy ตาม PDPA
- ยังไม่รองรับหลายภาษา (UI เป็นภาษาไทยล้วน)
- ยังไม่มี automated test suite
- Deploy เป้าหมายคือ VPS เดี่ยว (persistent disk) — ยังไม่ได้ออกแบบให้รองรับ multi-instance/horizontal scaling เพราะ storage เป็นไฟล์ JSON บนดิสก์เครื่องเดียว

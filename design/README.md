# ไฟล์ออกแบบ

ไฟล์ทำงานของแคนวาสออกแบบใหม่ (ยังไม่ได้เอาลงโค้ดจริง — รอเคาะทิศทางก่อน)

- `HeroDesktop / HeroTablet / HeroMobile.dc.html` — hero พร้อมรูปจริง 3 ช่วงจอ (ทาง 1: ใช้ใบนอนตามเดิม + scrim ครีมกลบซ้าย) · อาร์ตบอร์ดจอคอมมี tweak `Scrim` ลากปรับระยะได้
- `hero-wide.jpg` / `hero-tall.jpg` — รูปที่บีบมาสำหรับแคนวาสโดยเฉพาะ (900px / 62KB เพราะแคนวาสฝังรูปเป็น base64 มีเพดาน) **ไม่ใช่ไฟล์สำหรับเอาไปใช้จริง** ของจริงต้อง gen ที่ ≥2400px แล้วทำเป็น AVIF หลายขนาด
- `DirectionA/B/C.dc.html` — 3 ทิศทางให้เลือก
- `Main / Request / Tracking / StaffDashboard / StaffQueue / StaffStock / StaffLogin` — ทิศทาง A ทำเต็มทุกหน้า (จอใหญ่)
- `HomeMobile / RequestMobile / StaffMobile` — จอ 390px
- `canvas.json` — ผังการวางและการแบ่งหน้า
- `_base.txt` — ฟอนต์ + สีพื้นฐานที่ทุกไฟล์ใช้ร่วมกัน

ไฟล์ `medequiploan-redesign.html` ที่ได้จากการ seed ไม่ได้ commit ไว้ (2.6 MB) สร้างใหม่ได้จากไฟล์ข้างบน

## สิ่งที่ทิศทาง A เปลี่ยนจากของเดิม

| | เดิม | ใหม่ |
|---|---|---|
| หัวเรื่อง | Kanit | IBM Plex Sans Thai |
| เนื้อหา | Noto Sans Thai | IBM Plex Sans Thai Looped (ตัวมีหัว) |
| ขนาดเนื้อหา | 17px / 1.6 | 19px / 1.75 |
| ปุ่ม | 16px สูง ~48px | 21px สูง 62-68px |
| ตัวหนังสือสีส้ม | `#FF6C1D` (2.83:1 — ตก WCAG AA) | `#B8420C` (5.3:1) |
| สีเทารอง | `#766B60` (4.96:1) | `#5C5048` (7.4:1) |
| พื้นหลัง | gradient ส้ม + เงาฟุ้ง | สีทึบ + เส้นขอบ 2px |

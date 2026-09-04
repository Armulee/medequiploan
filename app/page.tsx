import Link from 'next/link';
import Icon from '@/components/Icon';
import StockPreview from '@/components/landing/StockPreview';

const STEPS = [
  { title: 'กรอกแบบฟอร์ม', body: 'บอกข้อมูลผู้ยืมและอุปกรณ์ที่ต้องการ ใช้เวลาไม่ถึง 3 นาที' },
  { title: 'รอเจ้าหน้าที่ตรวจสอบ', body: 'เจ้าหน้าที่ตรวจสอบคำขอและติดต่อกลับเพื่อนัดหมายรับอุปกรณ์' },
  { title: 'รับอุปกรณ์ไปใช้', body: 'ใช้งานได้ทันที และนำมาคืนเมื่อเสร็จสิ้นการใช้งาน' },
];

const FEATURES = [
  {
    icon: 'file',
    title: 'ลงทะเบียนครั้งเดียว',
    body: 'ระบบจำข้อมูลผู้ยืมไว้ ครั้งต่อไปยืมได้เร็วขึ้นโดยไม่ต้องกรอกซ้ำ',
  },
  {
    icon: 'swap',
    title: 'ยืม-คืนสะดวก',
    body: 'ติดตามกำหนดคืนและสถานะอุปกรณ์ได้ตลอด ไม่ต้องกังวลลืมวันคืน',
  },
  {
    icon: 'clock',
    title: 'โปร่งใส ตรวจสอบได้',
    body: 'ทุกการยืม-คืนถูกบันทึกไว้เป็นประวัติ พร้อมผู้รับผิดชอบในทุกขั้นตอน',
  },
];

const BADGES = ['ไม่มีค่าใช้จ่าย', 'ใช้งานง่าย เหมาะกับทุกวัย', 'ข้อมูลถูกเข้ารหัสปลอดภัย'];

export default function LandingPage() {
  return (
    <>
      <header className="site-header">
        <div className="brand">
          <span className="logo-mark">
            <Icon name="heart" size={24} />
          </span>
          ศูนย์ยืม-คืนกายอุปกรณ์
        </div>
        <nav>
          <a href="#how">วิธีใช้งาน</a>
          <a href="#stock">อุปกรณ์ที่มี</a>
          <Link href="/tracking">ติดตามคำขอ</Link>
          <Link href="/staff">เจ้าหน้าที่</Link>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <div>
            <span className="hero-eyebrow">
              <Icon name="check" size={14} strokeWidth={2.5} />
              ยืมฟรี ไม่มีค่าใช้จ่าย
            </span>
            <h1>
              ยืมกายอุปกรณ์การแพทย์
              <br className="hero-break" />
              <span className="accent">ที่บ้านคุณ</span> ได้ง่าย ๆ
            </h1>
            <p className="lead">
              วีลแชร์ ไม้ค้ำยัน เตียงผู้ป่วย เครื่องผลิตออกซิเจน และอุปกรณ์อื่น ๆ
              สำหรับผู้ป่วยและผู้ดูแล ส่งคำขอออนไลน์ได้ทันที ไม่ต้องสมัครสมาชิก
              เจ้าหน้าที่ตรวจสอบและติดต่อกลับภายในไม่กี่วัน
            </p>
            <div className="hero-cta">
              <Link href="/request" className="btn btn-primary btn-lg">
                ส่งคำขอยืมอุปกรณ์
              </Link>
              <a href="#how" className="btn btn-outline btn-lg">
                ดูวิธีใช้งาน
              </a>
            </div>
            <div className="hero-badges">
              {BADGES.map((b) => (
                <span key={b}>
                  <Icon name="check" size={16} strokeWidth={2.5} />
                  {b}
                </span>
              ))}
            </div>
          </div>

          <div className="hero-panel" id="stock">
            <h3>
              <Icon name="box" size={20} stroke="var(--orange-dark)" />
              อุปกรณ์ที่พร้อมให้ยืมตอนนี้
            </h3>
            <StockPreview />
          </div>
        </div>
      </section>

      <section className="section" id="how">
        <div className="section-head">
          <h2>ใช้งานง่าย 3 ขั้นตอน</h2>
          <p>ไม่ต้องสมัครสมาชิกหรือติดตั้งแอปใด ๆ</p>
        </div>
        <div className="steps">
          {STEPS.map((s) => (
            <div className="step" key={s.title}>
              <div className="num" />
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <div className="feature-card" key={f.title}>
              <div className="icon-wrap">
                <Icon name={f.icon} size={24} />
              </div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="cta-band">
        <h2>พร้อมยืมอุปกรณ์แล้วใช่ไหม?</h2>
        <p>ส่งคำขอวันนี้ เจ้าหน้าที่จะติดต่อกลับเพื่อนัดหมายรับอุปกรณ์โดยเร็วที่สุด</p>
        <Link href="/request" className="btn btn-primary btn-lg">
          ส่งคำขอยืมอุปกรณ์
        </Link>
        <Link href="/tracking" className="btn btn-outline btn-lg cta-secondary">
          ติดตามคำขอที่ส่งไว้
        </Link>
      </div>

      <footer className="site-footer">
        ศูนย์ยืม-คืนกายอุปกรณ์การแพทย์ · สำหรับเจ้าหน้าที่{' '}
        <Link href="/staff">เข้าสู่ระบบที่นี่</Link>
      </footer>
    </>
  );
}

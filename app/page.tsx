import type { Metadata } from 'next';
import Link from 'next/link';
import Icon from '@/components/Icon';
import HeroPhoto from '@/components/landing/HeroPhoto';
import SiteHeader from '@/components/landing/SiteHeader';
import StockCarousel from '@/components/landing/StockCarousel';
import { EQUIPMENT_KINDS, SITE_DESCRIPTION, SITE_NAME, absolute, siteUrl } from '@/lib/site';
import { landingPageJsonLd } from '@/lib/structured-data';

// The landing page is the only page meant to be found from outside, so the
// social and search description lives here rather than in the layout: the
// request form and the tracking page inherit the layout's plain defaults and
// have nothing to gain from a share card.
export const metadata: Metadata = {
  // `absolute` rather than the layout's "%s · site name" template, because
  // this title already is the site name.
  title: { absolute: `${SITE_NAME} — ยืมฟรี ไม่มีค่าใช้จ่าย` },
  description: SITE_DESCRIPTION,
  keywords: [
    ...EQUIPMENT_KINDS,
    'ยืมกายอุปกรณ์',
    'ยืมกายอุปกรณ์การแพทย์',
    'ยืมกายอุปกรณ์ฟรี',
    'ยืมวีลแชร์ฟรี',
    'ศูนย์ยืมอุปกรณ์การแพทย์',
    'อุปกรณ์ผู้ป่วยติดเตียง',
    'อุปกรณ์ผู้สูงอายุ',
    'บริจาคกายอุปกรณ์',
  ],
  alternates: { canonical: siteUrl },
  openGraph: {
    type: 'website',
    locale: 'th_TH',
    url: siteUrl,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ยืมฟรี ไม่มีค่าใช้จ่าย`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: absolute('/assets/og-image.png'),
        width: 1200,
        height: 630,
        type: 'image/png',
        alt: 'ยืมกายอุปกรณ์การแพทย์ฟรี ที่บ้านคุณ — วีลแชร์ ไม้ค้ำยัน เตียงผู้ป่วย เครื่องผลิตออกซิเจน',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — ยืมฟรี ไม่มีค่าใช้จ่าย`,
    description: SITE_DESCRIPTION,
    images: [absolute('/assets/og-image.png')],
  },
};

const STEPS = [
  { title: 'กรอกแบบฟอร์ม', body: 'บอกข้อมูลผู้ยืมและอุปกรณ์ที่ต้องการ ใช้เวลาไม่ถึง 3 นาที' },
  { title: 'รอเจ้าหน้าที่ตรวจสอบ', body: 'เจ้าหน้าที่ตรวจสอบคำขอและติดต่อกลับเพื่อนัดหมายรับอุปกรณ์' },
  { title: 'รับอุปกรณ์ไปใช้', body: 'ใช้งานได้ทันที และนำมาคืนเมื่อเสร็จสิ้นการใช้งาน' },
];

const FEATURES = [
  {
    // There is no registration step and the form never pre-fills — a repeat
    // borrower types everything again. The old copy promised both.
    icon: 'requests',
    title: 'ไม่ต้องลงทะเบียน',
    body: 'กรอกแบบฟอร์มแล้วส่งได้เลย ไม่ต้องสร้างบัญชี ไม่ต้องจำรหัสผ่าน',
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

export default function LandingPage() {
  return (
    <>
      {/* What an answer engine reads instead of guessing from the prose. */}
      <script
        type="application/ld+json"
        // Every value is a literal from lib/site.ts, but escaping `<` keeps a
        // future edit from being able to close this tag early.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(landingPageJsonLd()).replace(/</g, '\\u003c'),
        }}
      />

      <SiteHeader />

      <section className="hero">
        <HeroPhoto />
        <div className="hero-scrim" />
        <div className="hero-inner">
          <div className="hero-copy">
            {/* "ฟรี" was a chip above the headline. In the headline it is
                both louder and one line shorter — and on a phone that line
                was what pushed the buttons onto the wheelchair. */}
            <h1>
              ยืมกายอุปกรณ์การแพทย์<span className="accent">ฟรี</span>
              <br className="hero-break" />
              ที่บ้านคุณ ได้ง่าย ๆ
            </h1>
            <p className="lead">
              วีลแชร์ ไม้ค้ำยัน เตียงผู้ป่วย เครื่องผลิตออกซิเจน และอุปกรณ์อื่น ๆ
              สำหรับผู้ป่วยและผู้ดูแล ส่งคำขอออนไลน์ได้ทันที ไม่ต้องสมัครสมาชิก{' '}
              {/* Hidden on a phone, not removed — it still reaches crawlers,
                  and the same sentence is the page's meta description. */}
              <span className="lead-tail">เจ้าหน้าที่ตรวจสอบและติดต่อกลับภายในไม่กี่วัน</span>
            </p>
            <div className="hero-cta">
              <Link href="/request" className="btn btn-primary btn-lg">
                ส่งคำขอยืมอุปกรณ์
              </Link>
              <a href="#how" className="btn btn-outline btn-lg">
                ดูวิธีใช้งาน
              </a>
            </div>
          </div>
        </div>

        {/* A plain anchor: the smooth scroll is the stylesheet's, so this
            still works with no JavaScript. */}
        <a href="#stock" className="hero-cue">
          <span>เลื่อนลงเพื่อดูอุปกรณ์</span>
          <Icon name="chevron-down" size={26} strokeWidth={2.5} />
        </a>
      </section>

      {/* Displaced from the hero by the photograph, but still what #stock in
          the header points at. */}
      <section className="stock-band" id="stock">
        <div className="hero-panel">
          <h3>
            <Icon name="box" size={20} stroke="var(--orange-dark)" />
            อุปกรณ์ที่พร้อมให้ยืมตอนนี้
          </h3>
          <StockCarousel />
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

      <footer className="site-footer">ศูนย์ยืม-คืนกายอุปกรณ์การแพทย์</footer>
    </>
  );
}

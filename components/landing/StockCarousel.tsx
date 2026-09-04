'use client';

import { useEffect, useState } from 'react';
import type { Swiper as SwiperClass } from 'swiper';
import { Autoplay, EffectFade } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';
import Alert from '@/components/Alert';
import Icon from '@/components/Icon';
import { api } from '@/app/lib/api';
import type { Equipment } from '@/app/lib/types';

import 'swiper/css';
import 'swiper/css/effect-fade';

// Equipment names are free text typed by staff, so the picture is matched on
// what the name contains rather than on an id. Anything unrecognised falls
// back to the icon — a new item added next year should still list, just
// without a photograph.
const PICTURES: Array<{ slug: string; match: RegExp }> = [
  { slug: 'wheelchair', match: /wheelchair|วีลแชร์|รถเข็น/i },
  { slug: 'crutches', match: /crutch|ไม้ค้ำ/i },
  { slug: 'hospital-bed', match: /bed|เตียง/i },
  { slug: 'walker', match: /walker|ช่วยเดิน|วอล์ค/i },
  { slug: 'oxygen-concentrator', match: /oxygen|ออกซิเจน/i },
];

const pictureFor = (name: string) => PICTURES.find((p) => p.match.test(name))?.slug ?? null;

// The nav labels get one line and about a dozen characters on a phone, so
// "วีลแชร์ (Wheelchair)" is trimmed to whichever half a Thai reader wants —
// which is not always the half outside the brackets: "Walker (โครงเหล็กช่วยเดิน)"
// keeps the inside. The slide caption still shows the name in full.
const THAI = /[\u0E00-\u0E7F]/;

function shortName(name: string) {
  const m = name.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (!m) return name;
  const [, outside, inside] = m;
  if (THAI.test(outside)) return outside.trim();
  if (THAI.test(inside)) return inside.trim();
  return outside.trim() || name;
}

const srcSet = (slug: string, ext: string) =>
  `/assets/equipment/${slug}-440.${ext} 440w, /assets/equipment/${slug}-880.${ext} 880w`;

function Photo({ slug, name, eager }: { slug: string; name: string; eager: boolean }) {
  return (
    <picture>
      <source type="image/avif" srcSet={srcSet(slug, 'avif')} sizes="(max-width: 700px) 62vw, 300px" />
      <source type="image/webp" srcSet={srcSet(slug, 'webp')} sizes="(max-width: 700px) 62vw, 300px" />
      <img
        src={`/assets/equipment/${slug}-440.png`}
        alt={name}
        width={440}
        height={440}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
      />
    </picture>
  );
}

export default function StockCarousel() {
  const [items, setItems] = useState<Equipment[] | null>(null);
  const [error, setError] = useState('');
  const [swiper, setSwiper] = useState<SwiperClass | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    api<{ equipment: Equipment[] }>('/api/equipment')
      .then((d) => setItems(d.equipment))
      .catch(() => setError('ไม่สามารถโหลดข้อมูลได้ในขณะนี้'));
  }, []);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!items) return <p style={{ color: 'var(--text-muted)' }}>กำลังโหลดข้อมูล...</p>;
  if (items.length === 0) return <p style={{ color: 'var(--text-muted)' }}>ยังไม่มีข้อมูลอุปกรณ์</p>;

  const count = items.length;
  const prev = items[(index - 1 + count) % count];
  const next = items[(index + 1) % count];

  // Swiper's own disableOnInteraction only covers dragging the slides. The
  // buttons below are ordinary React handlers, so they have to say so too.
  const steer = (run: () => void) => () => {
    swiper?.autoplay?.stop();
    run();
  };

  return (
    <div className="stock-carousel">
      <Swiper
        modules={[Autoplay, EffectFade]}
        effect="fade"
        fadeEffect={{ crossFade: true }}
        speed={550}
        loop
        // Long enough to actually read a name and a count before it moves.
        autoplay={
          typeof window !== 'undefined' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? false
            : { delay: 4200, disableOnInteraction: true }
        }
        onSwiper={setSwiper}
        onSlideChange={(s) => setIndex(s.realIndex)}
        a11y={{ enabled: false }}
      >
        {items.map((e, i) => {
          const slug = pictureFor(e.name);
          return (
            <SwiperSlide key={e.equipment_id}>
              <figure className="stock-slide">
                <div className="stock-shot">
                  {slug ? (
                    <Photo slug={slug} name={e.name} eager={i === 0} />
                  ) : (
                    <Icon name="box" size={72} stroke="var(--border)" strokeWidth={1.5} />
                  )}
                </div>
                <figcaption>
                  <span className="stock-name">{e.name}</span>
                  <span className={e.available_qty > 0 ? 'stock-avail' : 'stock-avail is-out'}>
                    {e.available_qty > 0 ? `เหลือ ${e.available_qty} ชิ้น` : 'ไม่พร้อมให้ยืม'}
                  </span>
                </figcaption>
              </figure>
            </SwiperSlide>
          );
        })}
      </Swiper>

      <div className="stock-nav">
        <button
          type="button"
          className="stock-navbtn stock-navbtn-prev"
          onClick={steer(() => swiper?.slidePrev())}
          aria-label={`ก่อนหน้า: ${prev.name}`}
        >
          <Icon name="chevron-left" size={24} strokeWidth={2.5} />
        </button>

        <div className="stock-dots" role="tablist" aria-label="เลือกอุปกรณ์">
          {items.map((e, i) => (
            <button
              type="button"
              key={e.equipment_id}
              role="tab"
              aria-selected={i === index}
              aria-label={e.name}
              className={i === index ? 'stock-dot is-on' : 'stock-dot'}
              onClick={steer(() => swiper?.slideToLoop(i))}
            />
          ))}
        </div>

        <button
          type="button"
          className="stock-navbtn stock-navbtn-next"
          onClick={steer(() => swiper?.slideNext())}
          aria-label={`ถัดไป: ${next.name}`}
        >
          <Icon name="chevron-right" size={24} strokeWidth={2.5} />
        </button>

        <span className="stock-navlabel stock-navlabel-prev" aria-hidden="true">
          {shortName(prev.name)}
        </span>
        <span className="stock-navlabel stock-navlabel-next" aria-hidden="true">
          {shortName(next.name)}
        </span>
      </div>
    </div>
  );
}

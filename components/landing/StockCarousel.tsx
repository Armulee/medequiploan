'use client';

import { useEffect, useState } from 'react';
import type { Swiper as SwiperClass } from 'swiper';
import { Autoplay, EffectFade } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';
import Alert from '@/components/Alert';
import { ChevronLeft, ChevronRight, Package } from 'lucide-react';
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

// Swiper's fade stacks every slide and hides all but one, so it cannot show
// two or three at a time — probed, not assumed: with slidesPerView 3 and
// effect fade, one slide occupied the row. The effect is also not a
// responsive parameter, so the tier is tracked here and the Swiper is
// remounted (key) when it changes: fade on a phone, sliding above it.
function useSlidesPerView() {
  const [n, setN] = useState(1);
  useEffect(() => {
    const two = window.matchMedia('(min-width: 700px)');
    const three = window.matchMedia('(min-width: 1024px)');
    const read = () => setN(three.matches ? 3 : two.matches ? 2 : 1);
    read();
    two.addEventListener('change', read);
    three.addEventListener('change', read);
    return () => {
      two.removeEventListener('change', read);
      three.removeEventListener('change', read);
    };
  }, []);
  return n;
}

const pictureFor = (name: string) =>
  PICTURES.find((p) => p.match.test(name))?.slug ?? null;

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
  const [snaps, setSnaps] = useState(1);
  const perView = useSlidesPerView();

  useEffect(() => {
    api<{ equipment: Equipment[] }>('/api/equipment')
      .then((d) => setItems(d.equipment))
      .catch(() => setError('ไม่สามารถโหลดข้อมูลได้ในขณะนี้'));
  }, []);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!items) return <p style={{ color: 'var(--text-muted)' }}>กำลังโหลดข้อมูล...</p>;
  if (items.length === 0) return <p style={{ color: 'var(--text-muted)' }}>ยังไม่มีข้อมูลอุปกรณ์</p>;

  const count = items.length;
  const per = Math.min(perView, count);

  // One dot per position the carousel can rest at. Looping shows one item at
  // a time so that is simply the item count; grouped, it is Swiper's own snap
  // grid, which already accounts for the last page overlapping the one before
  // it when the items do not divide evenly.
  const pages = per === 1 ? count : Math.max(1, Math.min(snaps, count));
  const page = Math.min(index, pages - 1);
  // Where a given page starts, clamped the way Swiper clamps the last one.
  const startOf = (i: number) => Math.min(i * per, count - per);

  // The names either side are the first item OUTSIDE the current view, not
  // the first item of the adjacent page: with five items three-up there are
  // only two pages, and both of those pages share an item, so naming the
  // page's first item put the same already-visible name under both arrows.
  const start = startOf(page);
  const prev = items[(start - 1 + count) % count];
  const next = items[(start + per) % count];

  // Swiper's own disableOnInteraction only covers dragging the slides. The
  // buttons below are ordinary React handlers, so they have to say so too.
  const steer = (run: () => void) => () => {
    swiper?.autoplay?.stop();
    run();
  };

  return (
    <div className="stock-carousel">
      <Swiper
        key={perView}
        modules={per === 1 ? [Autoplay, EffectFade] : [Autoplay]}
        effect={per === 1 ? 'fade' : 'slide'}
        fadeEffect={{ crossFade: true }}
        speed={550}
        slidesPerView={per}
        slidesPerGroup={per}
        spaceBetween={per === 1 ? 0 : 24}
        // Looping needs one slide in view to stay predictable; grouped, rewind
        // wraps at both ends without cloning anything.
        loop={per === 1}
        rewind={per > 1}
        // Long enough to actually read a name and a count before it moves.
        autoplay={
          typeof window !== 'undefined' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? false
            : { delay: 4200, disableOnInteraction: true }
        }
        onSwiper={(s) => {
          setSwiper(s);
          setSnaps(s.snapGrid?.length ?? 1);
          setIndex(per === 1 ? s.realIndex : s.snapIndex);
        }}
        onSlideChange={(s) => setIndex(per === 1 ? s.realIndex : s.snapIndex)}
        onResize={(s) => setSnaps(s.snapGrid?.length ?? 1)}
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
                    <Package size={72} color="var(--border)" strokeWidth={1.5} />
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

      {pages > 1 && (
      <div className="stock-nav">
        <button
          type="button"
          className="stock-navbtn stock-navbtn-prev"
          onClick={steer(() => swiper?.slidePrev())}
          aria-label={`ก่อนหน้า: ${prev.name}`}
        >
          <ChevronLeft size={24} strokeWidth={2.5} />
        </button>

        <div className="stock-dots" role="tablist" aria-label="เลือกอุปกรณ์">
          {Array.from({ length: pages }, (_, i) => (
            <button
              type="button"
              key={i}
              role="tab"
              aria-selected={i === page}
              aria-label={items[startOf(i)].name}
              className={i === page ? 'stock-dot is-on' : 'stock-dot'}
              onClick={steer(() =>
                per === 1 ? swiper?.slideToLoop(i) : swiper?.slideTo(startOf(i))
              )}
            />
          ))}
        </div>

        <button
          type="button"
          className="stock-navbtn stock-navbtn-next"
          onClick={steer(() => swiper?.slideNext())}
          aria-label={`ถัดไป: ${next.name}`}
        >
          <ChevronRight size={24} strokeWidth={2.5} />
        </button>

        <span className="stock-navlabel stock-navlabel-prev" aria-hidden="true">
          {shortName(prev.name)}
        </span>
        <span className="stock-navlabel stock-navlabel-next" aria-hidden="true">
          {shortName(next.name)}
        </span>
      </div>
      )}
    </div>
  );
}

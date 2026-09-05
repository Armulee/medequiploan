'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import Logo from '@/components/Logo';

// The bar floats over the photograph with no background of its own, then
// takes the page's background back as it starts to cover the headline.
// A scroll listener rather than a sentinel because the fade is gradual;
// rAF-throttled so it costs one style write per frame at most.
export default function SiteHeader() {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      // Transparent until the bar has scrolled past its own height — up to
      // there it is still over empty wall, not over words.
      const from = el.offsetHeight;
      const t = Math.min(Math.max((window.scrollY - from) / 60, 0), 1);
      el.style.setProperty('--header-bg', t.toFixed(3));
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header className="site-header" ref={ref}>
      <div className="site-header-inner">
        <Link href="/" className="brand">
          <span className="logo-mark">
            <Logo size={24} />
          </span>
          ศูนย์ยืม-คืนกายอุปกรณ์
        </Link>
        <nav>
          <Link href="/request">ส่งคำขอยืมอุปกรณ์</Link>
          <Link href="/tracking">ติดตามคำขอ</Link>
          <Link href="/staff">สำหรับเจ้าหน้าที่</Link>
        </nav>
      </div>
    </header>
  );
}

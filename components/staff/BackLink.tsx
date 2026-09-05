'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

/**
 * Every detail view is its own route now, so "back" is a real link with a
 * real destination — it works on a deep link, and on the phone's own back
 * gesture, which a state-only panel never did.
 */
export default function BackLink({
  href,
  children = 'กลับ',
}: {
  href: string;
  children?: React.ReactNode;
}) {
  return (
    <Link className="back-link" href={href}>
      <ChevronLeft size={20} strokeWidth={2.5} />
      {children}
    </Link>
  );
}

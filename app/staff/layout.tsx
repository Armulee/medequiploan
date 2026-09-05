import type { Metadata } from 'next';
import StaffFrame from '@/components/staff/StaffFrame';
import { Toaster } from '@/components/ui/toaster';
import { SessionProvider } from './SessionContext';

// Every staff route is behind a login; none of it should ever be indexed.
export const metadata: Metadata = {
  title: 'สำหรับเจ้าหน้าที่',
  robots: { index: false, follow: false },
};

/**
 * The frame every staff route renders inside: one session lookup, one header,
 * one Toaster. Navigating between tabs no longer re-mounts any of it.
 */
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <StaffFrame>{children}</StaffFrame>
      {/* Mounted here rather than in the root layout: only the staff app
          raises toasts, so the public pages do not ship sonner. */}
      <Toaster />
    </SessionProvider>
  );
}

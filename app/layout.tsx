import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ศูนย์ยืม-คืนกายอุปกรณ์การแพทย์',
  description:
    'ยืมกายอุปกรณ์การแพทย์ฟรี วีลแชร์ ไม้ค้ำยัน เตียงผู้ป่วย เครื่องผลิตออกซิเจน ส่งคำขอออนไลน์ ไม่ต้องสมัครสมาชิก',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}

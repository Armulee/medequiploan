import type { Metadata, Viewport } from 'next';
import { BUILD, SITE_DESCRIPTION, SITE_NAME, siteUrl } from '@/lib/site';
import './globals.css';

// Site-wide head only. The home page carries its own SEO, social and
// structured-data block in app/page.tsx; everything here is either an icon
// (which browsers look for once, for the whole origin) or a default that a
// page is free to override.
export const metadata: Metadata = {
  // Without this, Next cannot turn the relative og:image below into the
  // absolute URL that link unfurlers require.
  metadataBase: new URL(siteUrl),
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  // The commit hash used to be published here to settle "is the deploy
  // actually current?". It also tells anyone looking exactly which version of
  // a public repository is running, which is the first step of finding a
  // known bug in it. Kept in development only.
  ...(process.env.NODE_ENV === 'production' ? {} : { other: { 'build-commit': BUILD } }),
  referrer: 'strict-origin-when-cross-origin',
  // Only the two that cause trouble: iOS turns addresses into Maps links and
  // mangles them. Phone numbers are left alone — the staff queue wants them tappable.
  formatDetection: { address: false, email: false },
  icons: {
    icon: [
      { url: '/assets/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/assets/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/assets/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/assets/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/assets/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/manifest.webmanifest',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      // Let answer engines quote the page in full rather than a 160-character
      // stub — the whole point of being findable by an assistant.
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#FF6C1D',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}

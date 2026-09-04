import type { MetadataRoute } from 'next';
import { SITE_DESCRIPTION, SITE_NAME, SITE_NAME_SHORT } from '@/lib/site';

// Android reads this when someone adds the site to their home screen. The
// maskable icon is a separate entry on purpose: Android crops icons to
// whatever shape the launcher uses, so it needs a full-bleed square with the
// heart pulled well inside the safe zone.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME_SHORT,
    description: SITE_DESCRIPTION,
    lang: 'th',
    start_url: '/',
    display: 'standalone',
    background_color: '#FFF6F0',
    theme_color: '#FF6C1D',
    icons: [
      { src: '/assets/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/assets/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/assets/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}

/**
 * Security headers.
 *
 * There were none. For a site run by a political party that is a gap on its
 * own: without frame-ancestors any page can be framed and clicked through
 * invisibly, and "approve this request" and "close this account" are both one
 * click. Without a CSP, one injection anywhere becomes a full account
 * takeover instead of a contained bug.
 *
 * The CSP is written to what the app actually loads: its own scripts, one
 * inline JSON-LD block on the landing page, and Google Fonts. `unsafe-inline`
 * for styles is unavoidable while React renders style attributes; scripts do
 * not get it, which is the half that matters.
 */
// `npm run dev` compiles strings at runtime for hot reloading. The production
// bundle does not, so the exemption is scoped to development rather than
// weakening the header that actually ships.
const dev = process.env.NODE_ENV !== 'production';

// Cloudflare Turnstile, when it is configured. Only these exact directives —
// the challenge loads a script and renders itself in an iframe — and only when
// a site key exists, so a deployment without it keeps the tighter policy.
const turnstile = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  ? ' https://challenges.cloudflare.com'
  : '';

const csp = [
  "default-src 'self'",
  // Next's inline bootstrap and the landing page's JSON-LD need unsafe-inline.
  // unsafe-eval is development only — see above.
  `script-src 'self' 'unsafe-inline'${turnstile}${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  // blob: is the local preview of a photo the person just picked.
  "img-src 'self' data: blob:",
  // The dev server's hot reload talks over a websocket to the same origin.
  `connect-src 'self'${turnstile}${dev ? ' ws: wss:' : ''}`,
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  // The challenge itself renders in an iframe from Cloudflare.
  `frame-src 'self'${turnstile}`,
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Nothing here needs a camera through the API, a microphone, or a location.
  // The photo fields are plain file pickers.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  // Two years, and ask to be preloaded: the site is served over HTTPS only.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Uploaded ID-card / illness photos are streamed through /api/files/[id]
  // rather than served from a public URL, so no remote image config is needed.
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        // Anything carrying personal data must not be kept by a shared cache,
        // and must not sit in the browser's back/forward store either.
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
      },
      {
        // Except the files route, which sets its own private one-hour cache so
        // a staff member re-rendering a page does not re-download a photograph.
        source: '/api/files/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, max-age=3600' }],
      },
      {
        source: '/staff/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

export default nextConfig;

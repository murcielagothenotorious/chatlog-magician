import type { NextConfig } from 'next';

// React development mode uses eval() for callstack reconstruction, which the
// production CSP would block. Allow 'unsafe-eval' in dev only: NODE_ENV is
// 'development' under `next dev` and 'production' at build time (including the
// Vercel build that bakes the preview/prod headers), where React never evals.
const SCRIPT_SRC = [
  "'self'",
  "'unsafe-inline'",
  ...(process.env.NODE_ENV === 'production' ? [] : ["'unsafe-eval'"]),
  'https://cdnjs.cloudflare.com',
  'https://cdnjs.buymeacoffee.com',
  'https://vercel.live',
  'https://chatlog-magician-tr.vercel.app',
  'https://www.googletagmanager.com',
  'https://www.google-analytics.com',
].join(' ');

const SECURITY_HEADERS = [
  {
    key: 'Content-Security-Policy',
    value: `default-src 'self'; script-src ${SCRIPT_SRC}; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com https://fonts.gstatic.com https://vercel.live; img-src 'self' data: blob: https:; font-src 'self' https://cdnjs.cloudflare.com https://fonts.gstatic.com data:; connect-src 'self' https://cdnjs.cloudflare.com https://vercel.live https://chatlog-magician-tr.vercel.app https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://region1.google-analytics.com https://region2.google-analytics.com https://region3.google-analytics.com https://region4.google-analytics.com https://region5.google-analytics.com; frame-src https://vercel.live; frame-ancestors 'none'; base-uri 'self' https://cdnjs.cloudflare.com; form-action 'self'; upgrade-insecure-requests`,
  },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value:
      'geolocation=(), microphone=(), camera=(), payment=(self), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
  },
];

const NO_STORE = [{ key: 'Cache-Control', value: 'no-store' }];
const REVALIDATE = [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }];

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      { source: '/(.*)', headers: SECURITY_HEADERS },
      { source: '/api/(.*)', headers: NO_STORE },
      { source: '/js/(.*)', headers: REVALIDATE },
      { source: '/css/(.*)', headers: REVALIDATE },
      { source: '/color-palette/(.*)', headers: REVALIDATE },
      { source: '/webfonts/(.*)', headers: REVALIDATE },
      {
        source: '/sitemap.txt',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' },
          { key: 'Content-Type', value: 'text/plain; charset=utf-8' },
        ],
      },
      {
        source: '/LICENSE',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' },
          { key: 'Content-Type', value: 'text/plain; charset=utf-8' },
        ],
      },
      {
        source: '/NOTICE',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' },
          { key: 'Content-Type', value: 'text/plain; charset=utf-8' },
        ],
      },
    ];
  },
  async rewrites() {
    return [{ source: '/SiteMap.aspx', destination: '/sitemap.txt' }];
  },
};

export default nextConfig;

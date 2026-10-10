import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import type { ReactNode } from 'react';

import '../styles/layers.css';
import '../styles/foundation.fixed.css';
import '../styles/modern.css';
import '../styles/app.css';
import '../styles/color-palette.min.css';
import '../styles/canvas-workspace.css';
import '../styles/local-projects.css';
import '../styles/community.css';
import '../styles/help-tour.css';
import '../styles/reference-layout.css';
import '../styles/legacy-hover.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Chatlog Magician',
  description: 'Chatlog Magician GTA World Türkiye uyarlaması.',
  authors: [{ name: 'blanco' }],
  keywords: ['GTAWTR', 'GTAWorldTR', 'chatlog magician', 'chatlog', 'roleplay'],
  icons: { icon: '/favicon.png' },
};

export const viewport: Viewport = {
  themeColor: '#000000',
};

// Legacy scripts live in app/legacy/legacy-scripts.ts (opaque HTML string,
// rendered once at the end of <body> via dangerouslySetInnerHTML in
// app/page.tsx). They must NOT move here: next/script beforeInteractive
// hoists into <head> without defer (top-level DOM queries ran against an
// empty document and half the UI silently died), and React 19 refuses JSX
// script elements inside components. See tests/script-loading.test.js.
const GTAG_CONFIG = `window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }
gtag('js', new Date());
gtag('config', 'G-10MDG763GJ');`;

export default function RootLayout({ children }: { children: ReactNode }) {
  // suppressHydrationWarning on <html> and <body>: legacy scripts mutate
  // these nodes' own attributes before hydration finishes (app.js sets
  // --bg-gap-fill-px on documentElement; controllers flip body dataset
  // flags). The flag is one level deep, so it covers exactly these nodes —
  // the legacy tree itself opts out via the opaque string in app/page.tsx.
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* crossOrigin lets dom-to-image read cssRules (Google serves ACAO:*);
            without it every PNG export logs a cross-origin SecurityError. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Mukta:wght@400;500;600;700&family=Nunito+Sans:wght@400;500;600;700&family=Open+Sans:wght@400;500;600;700&family=Raleway:wght@400;500;600;700&family=Roboto:wght@400;500;700&family=Ubuntu:wght@400;500;700&display=swap"
          rel="stylesheet"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.0.1/css/all.min.css"
          integrity="sha512-2SwdPD6INVrV/lHTZbO2nodKhrnDdJK9/kg2XD1r9uGqPo1cUbujc+IYdlYdEErWNu69gVcYgdxlmVmzTWnetw=="
          crossOrigin="anonymous"
        />
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-10MDG763GJ"
          strategy="afterInteractive"
        />
        <Script
          id="gtag-config"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: GTAG_CONFIG }}
        />
      </head>
      <body
        suppressHydrationWarning
        className="reference-shell"
        data-canvas-ready="true"
      >
        {children}
      </body>
    </html>
  );
}

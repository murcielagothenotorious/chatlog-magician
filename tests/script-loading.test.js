import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import { renderLegacyScriptTags } from '../app/legacy/legacy-scripts';
import { LEGACY_INLINE_SCRIPTS } from '../app/legacy/inline-scripts';
import { LEGACY_BODY_HTML } from '../app/legacy/body-html';

import { renderLegacyBody } from './helpers/render-legacy-body';

// Regression tests for legacy script delivery. Two breakages happened here:
// 1. next/script beforeInteractive hoisted scripts into <head> WITHOUT defer,
//    so top-level DOM queries ran against an empty document and half the UI
//    silently died.
// 2. JSX script elements trip React 19 ("Scripts inside React components are
//    never executed when rendering on the client").
// So the tags are composed as an opaque HTML string (app/legacy/
// legacy-scripts.ts, order and attributes verified against dist/index.html)
// and rendered once via dangerouslySetInnerHTML at the end of <body>. The
// browser parses them as normal parser-inserted scripts with native defer
// semantics: the two esbuild IIFE bundles (legacy-early, legacy-main) execute
// in document order after the CDN tags, the inline script at parse position
// (its original slot).
const layoutPath = fileURLToPath(new URL('../app/layout.tsx', import.meta.url));
const pagePath = fileURLToPath(new URL('../app/page.tsx', import.meta.url));
const bodyPath = fileURLToPath(new URL('../app/legacy/body.tsx', import.meta.url));
const scriptsPath = fileURLToPath(new URL('../app/legacy/legacy-scripts.ts', import.meta.url));

describe('legacy script loading semantics', () => {
  it('renders no JSX script elements in the app shell (React 19 rejects them)', () => {
    for (const path of [layoutPath, pagePath, bodyPath]) {
      expect(readFileSync(path, 'utf8'), path).not.toContain('<script');
    }
    expect(readFileSync(layoutPath, 'utf8')).not.toContain('strategy="beforeInteractive"');
    expect(readFileSync(scriptsPath, 'utf8')).not.toContain("from 'next/script'");
  });

  it('emits the two bundles, the CDN tags, and the inline script in original document order', () => {
    const tags = renderLegacyScriptTags();
    const order = [
      '/js/legacy-early.js',
      'jquery.min.js',
      "getElementById('maintenanceBanner')",
      '/js/legacy-main.js',
    ];
    let previous = -1;
    for (const marker of order) {
      const index = tags.indexOf(marker);
      expect(index, `${marker} must be wired`).toBeGreaterThan(previous);
      previous = index;
    }

    // 2 local deferred bundles + 4 deferred CDN tags (with SRI) + the inline
    // script = 7 tags, no stragglers. (Was 20 per-module tags before the
    // bundler; the 12 deferred classics + 3 modules collapsed into the two
    // esbuild IIFE bundles built by scripts/bundle-legacy.ts.)
    expect(tags.match(/<script/g)).toHaveLength(7);
    expect(tags.match(/<script src="[^"]+" defer><\/script>/g)).toHaveLength(2);
    expect(tags.match(/integrity="sha512-/g)).toHaveLength(4);
    expect(tags).not.toContain('type="module"');
    expect(tags).not.toContain('beforeInteractive');

    // Both bundle tags share the single ?v= cache-buster.
    const version = readFileSync(
      fileURLToPath(new URL('../package.json', import.meta.url)),
      'utf8'
    );
    const token = JSON.parse(version).version;
    expect(tags).toContain(`/js/legacy-early.js?v=${token}`);
    expect(tags).toContain(`/js/legacy-main.js?v=${token}`);
  });

  it('renders the script block after the markup in app/page.tsx', () => {
    const page = readFileSync(pagePath, 'utf8');

    expect(page).not.toContain("from 'next/script'");
    expect(page.indexOf('__html: LEGACY_BODY_HTML')).toBeGreaterThan(-1);
    expect(page.indexOf('__html: LEGACY_BODY_HTML')).toBeLessThan(
      page.indexOf('renderLegacyScriptTags()')
    );
    expect(page).toContain('dangerouslySetInnerHTML');
  });

  it('keeps the inline script embeddable (no closing tag inside the code)', () => {
    for (const s of LEGACY_INLINE_SCRIPTS) {
      expect(s.code).not.toContain('</script');
    }
  });

  it('opts the legacy tree out of hydration (opaque string, no fibers inside)', () => {
    const page = readFileSync(pagePath, 'utf8');
    const layout = readFileSync(layoutPath, 'utf8');

    // Legacy scripts mutate the DOM before hydration finishes (app.js sets
    // --bg-gap-fill-px on <html> and rewrites .golden-sizes-hint; i18n
    // rewrites data-i18n text) — every such mutation was a hydration
    // mismatch. suppressHydrationWarning is one level deep (see React's
    // prepareToHydrateHostInstance/diffHydratedProperties), so a blanket on
    // <body> cannot cover the tree; instead the tree ships as one opaque
    // string with zero React fibers inside. The string is precomputed
    // (scripts/render-legacy-body.mjs) because Next.js rejects
    // react-dom/server imports inside Server Components at build time.
    expect(page).toContain("from './legacy/body-html'");
    expect(page).not.toContain("from 'react-dom/server'");
    expect(page).not.toContain('<LegacyBody');
    expect(page).toContain('suppressHydrationWarning dangerouslySetInnerHTML');
    expect(layout).toMatch(/<html[^>]*suppressHydrationWarning[^>]*>/);
    expect(layout).toMatch(/<body[^>]*suppressHydrationWarning[^>]*>/);
  });

  it('keeps the served body string in sync with app/legacy/body.tsx', () => {
    expect(LEGACY_BODY_HTML).toBe(renderLegacyBody());
  });
});

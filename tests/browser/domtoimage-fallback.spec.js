import { test, expect } from '@playwright/test';

/* global Blob, document, setTimeout, window */

// Regression: dom-to-image-more 3.5.0 threw an UNCAUGHT FileReader TypeError
// ("readAsDataURL: Argument 1 is not an object") and left the export promise
// unsettled whenever an inlined resource failed at network level (XHR status
// 0 — ad-blocker, offline, CORS-blocked). Pinned to 3.10.4, which degrades to
// the image placeholder instead. The fallback options also carried three dead
// keys (skipFonts/fontEmbedFn/onCloneNode) the library never honored.

const PROBE_PATH = '**/dtim-probe-blocked.png';

async function hasRealLib(page) {
  return page.evaluate(
    () => typeof window.domtoimage !== 'undefined' && Boolean(window.domtoimage.impl)
  );
}

function capturePageErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(String((error && error.message) || error)));
  return errors;
}

test.describe('dom-to-image fallback hardening', () => {
  test('fallback options use supported hooks (no dead skipFonts keys)', async ({ page }) => {
    await page.goto('/');
    const shape = await page.evaluate(() => {
      const options = window.CORSHandler.getDomToImageOptions({ width: 10, height: 10 });
      const probe = document.createElement('div');
      probe.innerHTML =
        '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/x.css">' +
        '<link rel="stylesheet" href="/styles/app.css">';
      const cleaned = options.onclone(probe);
      return {
        keys: Object.keys(options).sort(),
        dropsWoff2: options.filterUrls('https://fonts.gstatic.com/s/x.woff2'),
        dropsWoff: options.filterUrls('https://example.com/f.woff?v=2'),
        dropsDataFont: options.filterUrls('data:font/woff2;base64,AAA'),
        keepsPng: options.filterUrls('/assets/images/image.png'),
        keepsDataPng: options.filterUrls('data:image/png;base64,AAA'),
        dropsCdnjsLink: options.filter({
          tagName: 'LINK',
          href: 'https://cdnjs.cloudflare.com/x.js',
        }),
        keepsDiv: options.filter({ tagName: 'DIV', classList: { contains: () => false } }),
        oncloneKeepsLocal: cleaned.querySelectorAll('link').length,
      };
    });
    expect(shape.keys).toContain('filterUrls');
    expect(shape.keys).toContain('onclone');
    expect(shape.keys).toContain('imagePlaceholder');
    expect(shape.keys).not.toContain('skipFonts');
    expect(shape.keys).not.toContain('fontEmbedFn');
    expect(shape.keys).not.toContain('onCloneNode');
    expect(shape).toMatchObject({
      dropsWoff2: false,
      dropsWoff: false,
      dropsDataFont: false,
      keepsPng: true,
      keepsDataPng: true,
      dropsCdnjsLink: false,
      keepsDiv: true,
      oncloneKeepsLocal: 1,
    });
  });

  test('aborted image fetch settles with placeholder and no uncaught error', async ({ page }) => {
    await page.goto('/');
    test.skip(!(await hasRealLib(page)), 'dom-to-image CDN unavailable');
    const errors = capturePageErrors(page);
    await page.route(PROBE_PATH, (route) => route.abort());
    const result = await page.evaluate(async () => {
      const node = document.createElement('div');
      node.innerHTML = '<img src="/dtim-probe-blocked.png" alt="">';
      document.body.appendChild(node);
      try {
        const options = window.CORSHandler.getDomToImageOptions({});
        const blob = await window.domtoimage.toBlob(node, options);
        return { settled: blob instanceof Blob, bytes: blob instanceof Blob ? blob.size : -1 };
      } finally {
        node.remove();
      }
    });
    expect(result.settled).toBe(true);
    expect(result.bytes).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test('3.5.0 reference: aborted fetch throws uncaught and hangs (why we pinned)', async ({
    page,
  }) => {
    await page.goto('/');
    test.skip(!(await hasRealLib(page)), 'dom-to-image CDN unavailable');
    await page.addScriptTag({
      url: 'https://cdnjs.cloudflare.com/ajax/libs/dom-to-image-more/3.5.0/dom-to-image-more.min.js',
    });
    const downgraded = await page.evaluate(() => window.domtoimage.ResourceType === undefined);
    test.skip(!downgraded, '3.5.0 reference copy unavailable');
    const errors = capturePageErrors(page);
    await page.route(PROBE_PATH, (route) => route.abort());
    const outcome = await page.evaluate(async () => {
      const node = document.createElement('div');
      node.innerHTML = '<img src="/dtim-probe-blocked.png" alt="">';
      document.body.appendChild(node);
      try {
        const options = window.CORSHandler.getDomToImageOptions({});
        return await Promise.race([
          window.domtoimage.toBlob(node, options).then(() => 'settled'),
          new Promise((resolve) => setTimeout(() => resolve('hung'), 8000)),
        ]);
      } finally {
        node.remove();
      }
    });
    expect(outcome).toBe('hung');
    expect(errors.some((message) => message.includes('readAsDataURL'))).toBe(true);
  });
});

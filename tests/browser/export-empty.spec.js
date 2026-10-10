import { test, expect } from '@playwright/test';

/* global Blob, window */

test('empty export shows a friendly toast and skips the fallback', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('cm:locale:v1', 'tr');
    window.localStorage.setItem('cm:tour:v1:completed', '1');
  });
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__kumoToast === 'function');
  const dialogs = [];
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message());
    dialog.dismiss().catch(() => {});
  });
  await page.evaluate(() => {
    window.__fallbackCalls = 0;
    window.__saveCalls = 0;
    window.domtoimage = {
      impl: {},
      toBlob: () => {
        window.__fallbackCalls += 1;
        return Promise.resolve(new Blob());
      },
    };
    window.saveAs = () => {
      window.__saveCalls += 1;
    };
  });
  // Fresh load renders a single empty .generated line: visually empty output.
  expect((await page.locator('#output').innerText()).trim()).toBe('');
  await page.locator('#downloadOutputTransparent').click();
  await expect(
    page.locator('#kumoToastRoot').getByText('Dışa aktarılacak sohbet bulunamadı.', { exact: true })
  ).toBeVisible();
  // Negative assertions need a window: without the fix, the fallback starts
  // immediately after the native rejection and ends in a native alert.
  await page.waitForTimeout(2000);
  expect(await page.evaluate(() => window.__fallbackCalls)).toBe(0);
  expect(await page.evaluate(() => window.__saveCalls)).toBe(0);
  expect(dialogs).toEqual([]);
  await expect(page.locator('#loadingIndicator')).toBeHidden();
});

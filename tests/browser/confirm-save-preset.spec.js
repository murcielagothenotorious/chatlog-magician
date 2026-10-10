import { test, expect } from '@playwright/test';

/* global window */

test('preset save confirm dialog buttons are clickable and functional', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('cm:tour:v1:completed', '1');
    window.localStorage.setItem('cm_changelog_seen_v2_1_0', '1');
  });
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  await page.locator('.toolbar-overflow').evaluate((el) => el.setAttribute('open', ''));
  await page.locator('#communityOpen').click();
  await expect(page.locator('#communityModal')).toBeVisible();

  await page.locator('#communityPresetTitle').fill('Test Live Preset');

  await page.locator('#communitySubmit').click();

  const dialog = page.locator('#appConfirmDialog');
  await expect(dialog).toBeVisible();

  const isInert = await dialog.evaluate((el) => el.inert);
  expect(isInert).toBe(false);

  await page.locator('#appConfirmCancel').click();
  await expect(dialog).not.toBeVisible();

  await page.locator('#communitySubmit').click();
  await expect(dialog).toBeVisible();

  await page.locator('#appConfirmOk').click();
  await expect(dialog).not.toBeVisible();

  await expect(page.locator('#communityStatus')).toContainText('kaydedildi');
});

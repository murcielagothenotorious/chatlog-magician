import { expect, test } from '@playwright/test';

/* global window */

// First visit opens both the changelog drawer and the guided tour. The tour
// overlay sits above the drawer, so tour interactions must not dismiss the
// drawer, and one Escape press must close only the topmost layer (the tour).
test('tour clicks keep the changelog drawer open', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.ChatlogGuidance?.i18n, null, { timeout: 10000 });
  await expect(page.locator('#changelogDrawer.open')).toBeVisible();
  await expect(page.locator('#tourOverlay:not([hidden])')).toBeVisible();

  await page.click('#tourNext');

  await expect(page.locator('#changelogDrawer.open')).toBeVisible();
  await expect(page.locator('#tourOverlay:not([hidden])')).toBeVisible();
});

test('Escape during tour ends only the tour, drawer stays open', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.ChatlogGuidance?.i18n, null, { timeout: 10000 });
  await expect(page.locator('#changelogDrawer.open')).toBeVisible();
  await expect(page.locator('#tourOverlay:not([hidden])')).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(page.locator('#tourOverlay')).toBeHidden();
  await expect(page.locator('#changelogDrawer.open')).toBeVisible();

  // Second Escape now closes the changelog drawer.
  await page.keyboard.press('Escape');
  await expect(page.locator('#changelogDrawer.open')).toHaveCount(0);
});

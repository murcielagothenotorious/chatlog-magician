import { expect, test } from '@playwright/test';

/* global window */

// The shared dialog manager routes one Escape press to exactly the topmost
// layer: modals above persistent layers (toolbar overflow, changelog drawer).
async function gotoQuiet(page, { tourCompleted = true } = {}) {
  await page.addInitScript((completed) => {
    if (completed) window.localStorage.setItem('cm:tour:v1:completed', '1');
  }, tourCompleted);
  await page.goto('/');
  await page.locator('#chatlogInput').waitFor();
}

async function openOverflow(page) {
  await page.locator('.toolbar-overflow').evaluate((el) => el.setAttribute('open', ''));
}

test('Escape closes the help modal', async ({ page }) => {
  await gotoQuiet(page);
  await openOverflow(page);

  await page.click('#showHelpBtn');
  await expect(page.locator('#helpModal')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('#helpModal')).toBeHidden();
});

test('Escape closes the features modal', async ({ page }) => {
  await gotoQuiet(page);
  await openOverflow(page);

  await page.click('#openFeaturesBtn');
  await expect(page.locator('#featuresModal')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('#featuresModal')).toBeHidden();
});

test('Escape unwinds modal before the changelog drawer', async ({ page }) => {
  await gotoQuiet(page);
  await expect(page.locator('#changelogDrawer.open')).toBeVisible();

  // Open programmatically: a real click outside the drawer would dismiss it
  // first through the (correct, pre-existing) outside-click behavior.
  await page.waitForFunction(() => window.ChatlogCommunity?.open, null, { timeout: 10000 });
  await page.evaluate(() => window.ChatlogCommunity.open());
  await expect(page.locator('#communityModal')).toBeVisible();
  await expect(page.locator('#changelogDrawer.open')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('#communityModal')).toBeHidden();
  await expect(page.locator('#changelogDrawer.open')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('#changelogDrawer.open')).toHaveCount(0);
});

test('Escape closes the toolbar overflow before the changelog drawer', async ({ page }) => {
  await gotoQuiet(page);
  await expect(page.locator('#changelogDrawer.open')).toBeVisible();
  await openOverflow(page);
  await expect(page.locator('.toolbar-overflow[open]')).toHaveCount(1);

  await page.keyboard.press('Escape');
  await expect(page.locator('.toolbar-overflow[open]')).toHaveCount(0);
  await expect(page.locator('#changelogDrawer.open')).toBeVisible();
});

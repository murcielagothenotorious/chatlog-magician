import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/* global document, window */

async function violations(page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.length,
    targets: v.nodes.map((n) => n.target.join(' ')),
  }));
}

test.describe('accessibility', () => {
  test('home page has no axe violations', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('cm:tour:v1:completed', '1');
      window.localStorage.setItem('cm_changelog_seen_v2_1_0', '1');
    });
    await page.goto('/');
    await page.locator('#chatlogInput').waitFor();
    // Let entrance animations settle so visibility is stable.
    await page.waitForTimeout(500);
    expect(await violations(page)).toEqual([]);
  });

  test('presets modal has no axe violations while open', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('cm:tour:v1:completed', '1');
      window.localStorage.setItem('cm_changelog_seen_v2_1_0', '1');
    });
    await page.goto('/');
    await page.locator('#chatlogInput').waitFor();
    await page.locator('.toolbar-overflow').evaluate((el) => el.setAttribute('open', ''));
    await page.locator('#communityOpen').click();
    await expect(page.locator('#communityModal')).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test('guided tour has no axe violations while open', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.removeItem('cm:tour:v1:completed'));
    await page.goto('/');
    await page.locator('#chatlogInput').waitFor();
    await page.locator('#tourOverlay').waitFor({ state: 'visible', timeout: 15000 });
    expect(await violations(page)).toEqual([]);
  });

  test('help modal has no axe violations while open with highlighted matches', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('cm:tour:v1:completed', '1');
      window.localStorage.setItem('cm_changelog_seen_v2_1_1', '1');
    });
    await page.goto('/');
    await page.locator('#chatlogInput').waitFor();
    await page.locator('.toolbar-overflow').evaluate((el) => el.setAttribute('open', ''));
    await page.locator('#showHelpBtn').click();
    await expect(page.locator('#helpModal')).toBeVisible();
    await page.locator('#helpSearch').fill('preset');
    await expect(page.locator('#helpModal mark')).toHaveCount(2);
    expect(await violations(page)).toEqual([]);
  });
});

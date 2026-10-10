import { test, expect } from '@playwright/test';

/* global window */

async function dismissTour(page) {
  await expect(page.locator('#tourOverlay:not([hidden])')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#tourOverlay')).toBeHidden();
  if ((await page.locator('#changelogDrawer.open').count()) > 0) {
    await page.keyboard.press('Escape');
    await expect(page.locator('#changelogDrawer.open')).toHaveCount(0);
  }
}

test.describe('toast actions', () => {
  test('rich toast renders description and opens the action popup', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.__kumoToast === 'function');
    await dismissTour(page);
    await page.evaluate(() => {
      window.__kumoToast({
        title: 'Destek çağrısı',
        description: 'Bir beğeni bırakarak destek olabilirsiniz.',
        variant: 'info',
        timeout: 30000,
        actions: [
          {
            label: 'Tanıtıma',
            onClick: () => window.open('about:blank', '_blank', 'noopener'),
          },
        ],
      });
    });
    const toast = page.locator('#kumoToastRoot [role="region"] > [role="dialog"]').last();
    await expect(toast.getByText('Destek çağrısı', { exact: true })).toBeVisible();
    await expect(
      toast.getByText('Bir beğeni bırakarak destek olabilirsiniz.', { exact: true })
    ).toBeVisible();
    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      toast.getByRole('button', { name: 'Tanıtıma' }).click(),
    ]);
    expect(popup.url()).toBe('about:blank');
    await popup.close();
  });

  test('first export shows the support nudge as a toast with a forum action', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.__kumoToast === 'function');
    await dismissTour(page);
    await context.route('**/forum-tr.gta.world/**', (route) =>
      route.fulfill({ status: 200, body: 'intercepted' })
    );
    await page.evaluate(() => {
      window.saveAs = () => {};
    });
    await page.locator('#downloadOutputTransparent').click();
    const root = page.locator('#kumoToastRoot');
    await expect(
      root.getByText('Chatlog Magician işinize yarıyor mu?', { exact: true })
    ).toBeVisible({ timeout: 30000 });
    await expect(root.getByText('Bir beğeni veya yorum bırakarak', { exact: false })).toBeVisible();
    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      root.getByRole('button', { name: 'Tanıtıma' }).click(),
    ]);
    await popup.waitForURL('**/forum-tr.gta.world/**');
    expect(popup.url()).toContain('forum-tr.gta.world');
    await popup.close();
  });
});

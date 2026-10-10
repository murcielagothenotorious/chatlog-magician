import { test, expect } from '@playwright/test';

/* global document, getComputedStyle, window */

// Guards the Kumo scoping contract: dark mode must live INSIDE
// #kumoToastRoot, and the toast must render EXACTLY as Kumo ships it.
// Legacy stylesheets sit in the `legacy-app`/`legacy` cascade layers (see
// styles/layers.css), which sort below the Tailwind/Kumo layers — so Kumo's
// own utilities win inside the island with zero component-targeting
// overrides in our CSS (app/globals.css carries none by design).
async function dismissTour(page) {
  await expect(page.locator('#tourOverlay:not([hidden])')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#tourOverlay')).toBeHidden();
}

// Computed color serializes as lab()/oklch(), so resolve it to sRGB bytes.
async function srgbChannels(locator) {
  return locator.evaluate((el) => {
    const probe = document.createElement('canvas');
    probe.width = 1;
    probe.height = 1;
    const context = probe.getContext('2d');
    context.fillStyle = getComputedStyle(el).color;
    context.fillRect(0, 0, 1, 1);
    return [...context.getImageData(0, 0, 1, 1).data];
  });
}

test.describe('Kumo island scoping', () => {
  test('dark mode stays inside the toast island; page keeps light controls', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html[data-mode]')).toHaveCount(0);
    await expect(page.locator('#kumoToastRoot[data-mode="dark"]')).toHaveCount(1);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(
      'light'
    );
  });

  test('toast renders dense Inter title type and dark theme', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.__kumoToast === 'function');
    await page.evaluate(() => window.__kumoToast('Kapsam denetimi'));
    const title = page.locator('#kumoToastRoot').getByText('Kapsam denetimi', { exact: true });
    await expect(title).toBeVisible();
    const styles = await title.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        lineHeight: cs.lineHeight,
        fontFamily: cs.fontFamily,
      };
    });
    // Dense 13px Inter title at 500 weight.
    expect(styles.fontSize).toBe('13px');
    expect(styles.fontWeight).toBe('500');
    expect(styles.lineHeight).toBe('20px');
    expect(styles.fontFamily).toContain('Inter');
    // Dark-theme title text is near-white; light theme would be near-black.
    const channels = await srgbChannels(title);
    expect(channels.slice(0, 3).every((c) => c > 180)).toBe(true);
    // Compact 12px padding on the toast root; legacy div{padding:0} must not eat it.
    const padding = await page
      .locator('#kumoToastRoot [role="region"] > [role="dialog"]')
      .evaluate((el) => getComputedStyle(el).paddingTop);
    expect(padding).toBe('12px');
  });

  test('variant toasts keep the Kumo title tint', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.__kumoToast === 'function');
    await page.evaluate(() => {
      window.__kumoToast('Sade renk');
      window.__kumoToast({ title: 'Hata rengi', variant: 'error', timeout: 60000 });
    });
    const root = page.locator('#kumoToastRoot');
    await expect(root.getByText('Hata rengi', { exact: true })).toBeVisible();
    // Kumo tints the title via [&_[data-toast-title]]:text-kumo-danger; an
    // unlayered blanket color on the title would flatten both to one color.
    const plain = await srgbChannels(root.getByText('Sade renk', { exact: true }));
    const error = await srgbChannels(root.getByText('Hata rengi', { exact: true }));
    expect(error.slice(0, 3).join(',')).not.toBe(plain.slice(0, 3).join(','));
  });

  test('toast action buttons keep Kumo secondary styling against legacy', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.__kumoToast === 'function');
    await dismissTour(page);
    await page.evaluate(() => {
      window.__kumoToast({
        title: 'Stil denetimi',
        variant: 'info',
        timeout: 30000,
        actions: [{ label: 'Eylem', onClick: () => {} }],
      });
    });
    const action = page.locator('#kumoToastRoot').getByRole('button', { name: 'Eylem' });
    await expect(action).toBeVisible();
    // Kumo secondary/sm: bg-kumo-base, rounded-md, text-xs, px-2, h-6.5,
    // flex w-max. Legacy button{padding:0;border:0;background:transparent}
    // sits in a lower layer now, so these apply unmirrored.
    const styles = await action.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        backgroundColor: cs.backgroundColor,
        borderRadius: cs.borderRadius,
        fontSize: cs.fontSize,
        paddingLeft: cs.paddingLeft,
        cursor: cs.cursor,
        display: cs.display,
        height: cs.height,
      };
    });
    expect(styles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(styles.borderRadius).toBe('6px');
    expect(styles.fontSize).toBe('12px');
    expect(styles.paddingLeft).toBe('8px');
    expect(styles.cursor).toBe('pointer');
    expect(styles.display).toBe('flex');
    expect(styles.height).toBe('26px');
    // Hover tint must survive too (Kumo hover:bg-kumo-tint).
    const restBg = styles.backgroundColor;
    await action.hover();
    const hoverBg = await action.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(hoverBg).not.toBe('rgba(0, 0, 0, 0)');
    expect(hoverBg).not.toBe(restBg);
  });
});

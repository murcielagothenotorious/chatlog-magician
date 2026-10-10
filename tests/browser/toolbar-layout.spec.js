import { expect, test } from '@playwright/test';

/* global getComputedStyle, window */

test('chat formatting toolbar buttons are 36px tall', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('cm:tour:v1:completed', 'true'));
  await page.goto('/');

  const heights = await page
    .locator('.chat-format-toolbar .button')
    .evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().height));

  expect(heights).toHaveLength(6);
  expect(heights).toEqual([36, 36, 36, 36, 36, 36]);
});

test('character input group controls match quick-settings 40px height', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('cm:tour:v1:completed', '1'));
  await page.goto('/');

  const heights = await page
    .locator(
      '.quick-field--highlight .input-group input, .quick-field--highlight .input-group button'
    )
    .evaluateAll((controls) => controls.map((control) => control.getBoundingClientRect().height));

  expect(heights).toEqual([40, 40, 40]);
});

test('JPEG quality uses ten explicit dropdown levels', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('cm:tour:v1:completed', '1'));
  await page.goto('/');

  const quality = page.locator('#canvasJpegQuality');
  await expect(quality).toHaveJSProperty('tagName', 'SELECT');
  await expect(quality.locator('option')).toHaveCount(10);
  expect(await quality.locator('option').allTextContents()).toEqual([
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
  ]);
  await expect(quality).toHaveValue('0.8');
});

test('preset and utility modals use the current workspace theme', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('cm:tour:v1:completed', '1'));
  await page.goto('/');

  await page.locator('#communityOpen').evaluate((button) => button.click());
  await expect(page.locator('#communityModal')).toBeVisible();

  const presetTheme = await page.locator('.community-modal__panel').evaluate((panel) => {
    const style = getComputedStyle(panel);
    const cardStyle = getComputedStyle(panel.querySelector('.community-submit'));
    return {
      background: style.backgroundColor,
      borderRadius: style.borderRadius,
      font: style.fontFamily,
      footerBackground: cardStyle.backgroundColor,
    };
  });
  expect(presetTheme).toEqual({
    background: 'rgb(29, 30, 33)',
    borderRadius: '4px',
    font: expect.stringContaining('Inter'),
    footerBackground: 'rgb(23, 24, 27)',
  });

  await page.locator('#communityClose').evaluate((button) => button.click());
  await page.locator('#projectLocal').evaluate((button) => button.click());
  await expect(page.locator('#localProjectsDialog')).toBeVisible();
  await expect(page.locator('#localProjectsDialog')).toHaveCSS('background-color', 'rgb(29, 30, 33)');
  await expect(page.locator('#localProjectsDialog')).toHaveCSS('border-radius', '4px');
});

test('preset and canvas inputs retain dark backgrounds on focus without white flash', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('cm:tour:v1:completed', '1'));
  await page.goto('/');

  await page.locator('#communityOpen').evaluate((button) => button.click());
  await expect(page.locator('#communityModal')).toBeVisible();

  const searchInput = page.locator('#communitySearchInput');
  await searchInput.focus();
  const searchBg = await searchInput.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(searchBg).not.toBe('rgb(254, 254, 254)');
  expect(searchBg).not.toBe('rgb(255, 255, 255)');

  const titleInput = page.locator('#communityPresetTitle');
  await titleInput.focus();
  const titleBg = await titleInput.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(titleBg).toBe('rgb(17, 18, 20)');

  const descInput = page.locator('#communityPresetDescription');
  await descInput.focus();
  const descBg = await descInput.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(descBg).toBe('rgb(17, 18, 20)');

  await page.locator('#communityClose').evaluate((button) => button.click());

  // Legacy #exportWidth belonged to the removed photo cluster.
  await page.locator('#modeCanvas').evaluate((button) => button.click());

  for (const selector of ['#canvasWidth', '#canvasHeight', '#canvasPaddingX', '#canvasComposition']) {
    const el = page.locator(selector);
    await el.focus();
    const bg = await el.evaluate((node) => getComputedStyle(node).backgroundColor);
    expect(bg).not.toBe('rgb(254, 254, 254)');
    expect(bg).not.toBe('rgb(255, 255, 255)');
  }
});

test('kontrast button is placed in output-actions and system messages toggle is inside 3-dots overflow', async ({
  page,
}) => {
  await page.addInitScript(() => window.localStorage.setItem('cm:tour:v1:completed', '1'));
  await page.goto('/');

  // Kontrast is in output actions right after download
  const outputActionsButtons = await page
    .locator('.output-actions button')
    .evaluateAll((btns) => btns.map((b) => b.id));
  expect(outputActionsButtons).toEqual([
    'copyOutputImage',
    'downloadOutputTransparent',
    'toggleContrast',
  ]);

  // System messages toggle is inside 3-dots overflow menu
  const overflowButtons = await page
    .locator('.toolbar-overflow__panel button')
    .evaluateAll((btns) => btns.map((b) => b.id));
  expect(overflowButtons).toContain('floatingSysMsgToggle');
  expect(overflowButtons).not.toContain('toggleContrast');

  // Floating sys msg toggle is not positioned as fixed floating on screen
  const sysMsgFixed = await page
    .locator('#floatingSysMsgToggle')
    .evaluate((btn) => getComputedStyle(btn).position);
  expect(sysMsgFixed).not.toBe('fixed');
});

test('preset modal input placeholders are visible and search button is right-aligned', async ({
  page,
}) => {
  await page.addInitScript(() => window.localStorage.setItem('cm:tour:v1:completed', '1'));
  await page.goto('/');

  await page.locator('#communityOpen').evaluate((button) => button.click());
  await expect(page.locator('#communityModal')).toBeVisible();

  // Verify placeholder color is bright/readable and not black. Only the
  // search input has a placeholder; title/description use <label>s.
  for (const selector of ['#communitySearchInput']) {
    const placeholderColor = await page.locator(selector).evaluate((el) => {
      const style = window.getComputedStyle(el, '::placeholder');
      return style.color;
    });
    expect(placeholderColor).not.toBe('rgb(0, 0, 0)');
    expect(placeholderColor).toBe('rgb(140, 145, 157)');
  }

  // Verify search button is right-aligned inside community-search
  const searchGeometry = await page.locator('.community-search').evaluate((form) => {
    const formRect = form.getBoundingClientRect();
    const btn = form.querySelector('.community-icon-button');
    const btnRect = btn.getBoundingClientRect();
    return {
      offsetFromRight: formRect.right - btnRect.right,
    };
  });
  expect(searchGeometry.offsetFromRight).toBeLessThanOrEqual(4);
});


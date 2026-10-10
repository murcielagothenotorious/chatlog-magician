import { expect, test } from '@playwright/test';

/* global document, getComputedStyle, window */

test('long chat output grows vertically without overlapping lines', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.addInitScript(() => window.localStorage.setItem('cm:tour:v1:completed', 'true'));

  await page.goto('/');
  await expect
    .poll(() =>
      page
        .locator('#output')
        .evaluate((output) => Number.parseFloat(getComputedStyle(output).lineHeight))
    )
    .toBeGreaterThan(0);

  const lines = Array.from(
    { length: 40 },
    (_, index) =>
      `[12:34:${String(index % 60).padStart(2, '0')}] John Doe says: This is a deliberately long chat line ${index} with enough words to wrap inside the preview.`
  );

  await page.locator('#chatlogInput').fill(lines.join('\n'));
  await page.evaluate(() => window.ChatlogParser.processOutput());
  await expect(page.locator('#output .generated')).toHaveCount(lines.length);

  const layout = await page.locator('#output').evaluate((output) => {
    const lineRects = [...output.querySelectorAll('.generated')].map((line) => {
      const range = document.createRange();
      range.selectNodeContents(line);
      const textRects = [...range.getClientRects()];
      return {
        top: Math.min(...textRects.map((rect) => rect.top)),
        bottom: Math.max(...textRects.map((rect) => rect.bottom)),
      };
    });
    return {
      height: output.getBoundingClientRect().height,
      lineHeight: Number.parseFloat(getComputedStyle(output).lineHeight),
      overlaps: lineRects.slice(1).filter((rect, index) => rect.top < lineRects[index].bottom - 0.5)
        .length,
    };
  });

  expect(pageErrors).not.toContain('handleTextareaSelection is not defined');
  expect(layout.lineHeight).toBeGreaterThan(0);
  expect(layout.height).toBeGreaterThan(70);
  expect(layout.overlaps).toBe(0);
});

test('real mouse drag in output enters coloring mode and selects words', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('cm:tour:v1:completed', 'true'));
  await page.goto('/');

  const sample = '[12:34:56] John Doe says: Hello world test';
  await page.locator('#chatlogInput').fill(sample);
  await page.evaluate(() => window.ChatlogParser.processOutput());
  await page.waitForTimeout(500);
  await expect(page.locator('#output .generated')).toHaveCount(1);

  const genBox = await page.locator('#output .generated').boundingBox();
  expect(genBox).toBeTruthy();

  await page.mouse.move(genBox.x + 80, genBox.y + genBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(genBox.x + 200, genBox.y + genBox.height / 2, { steps: 5 });
  await page.mouse.up();

  await page.waitForTimeout(300);

  const result = await page.evaluate(() => {
    const output = document.querySelector('#output');
    return {
      coloringMode: output.classList.contains('coloring-mode'),
      selected: Array.from(output.querySelectorAll('.selected-for-coloring')).map(s => s.textContent),
      paletteVisible: getComputedStyle(document.querySelector('#colorPalette')).display !== 'none',
      nativeSelectionText: window.getSelection() ? window.getSelection().toString() : '',
    };
  });

  expect(result.coloringMode).toBe(true);
  expect(result.selected.length).toBeGreaterThan(0);
});

test('real mouse drag in output WHILE IN coloring mode selects words', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('cm:tour:v1:completed', 'true'));
  await page.goto('/');

  const sample = '[12:34:56] John Doe says: Hello world test';
  await page.locator('#chatlogInput').fill(sample);
  await page.evaluate(() => window.ChatlogParser.processOutput());
  await page.waitForTimeout(500);
  await expect(page.locator('#output .generated')).toHaveCount(1);

  // Manually open coloring mode first
  await page.evaluate(() => window.ColorPalette.toggleColoringMode());
  await expect(page.locator('#output')).toHaveClass(/coloring-mode/);

  await page.evaluate(() => window.ColorPalette.clearSelections());

  const genBox = await page.locator('#output .generated').boundingBox();

  await page.mouse.move(genBox.x + 80, genBox.y + genBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(genBox.x + 200, genBox.y + genBox.height / 2, { steps: 5 });
  await page.mouse.up();

  await page.waitForTimeout(300);

  const result = await page.evaluate(() => {
    const output = document.querySelector('#output');
    return {
      coloringMode: output.classList.contains('coloring-mode'),
      selected: Array.from(output.querySelectorAll('.selected-for-coloring')).map(s => s.textContent),
      paletteVisible: getComputedStyle(document.querySelector('#colorPalette')).display !== 'none',
    };
  });

  expect(result.selected.length).toBeGreaterThan(0);
});



import { expect, test } from '@playwright/test';
import path from 'node:path';

/* global CanvasRenderingContext2D, document, getComputedStyle, navigator, window */

const chatlog = '[20:14:12] John Doe says: Browser QA line';
const fixtureImage = path.resolve('public/assets/images/image.png');

function captureRuntimeErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function openApp(page) {
  const errors = captureRuntimeErrors(page);
  await page.addInitScript(() => window.localStorage.setItem('cm:tour:v1:completed', '1'));
  await page.goto('/');
  await expect(page.locator('#chatlogInput')).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(window.ChatlogCanvas))).toBe(true);
  return errors;
}

async function canvasPixels(page) {
  return page.locator('#canvasPreview').evaluate((canvas) => {
    const context = canvas.getContext('2d');
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let opaque = 0;
    let checksum = 0;
    const stride = Math.max(4, Math.floor(data.length / 4096 / 4) * 4);
    for (let index = 0; index < data.length; index += stride) {
      if (data[index + 3] > 0) opaque += 1;
      checksum = (checksum + data[index] * 3 + data[index + 1] * 5 + data[index + 2] * 7) >>> 0;
    }
    return { width: canvas.width, height: canvas.height, opaque, checksum };
  });
}

async function expectNoOverlaps(page) {
  const overlaps = await page.evaluate(() => {
    const selectors = [
      '.canvas-toolbar > :not(.canvas-toolbar__separator)',
      '.canvas-settings > .canvas-field:not([hidden])',
      '.canvas-layer-row > *',
      '.canvas-statusbar > *',
    ];
    const failures = [];
    const intersects = (left, right) =>
      Math.min(left.right, right.right) - Math.max(left.left, right.left) > 1 &&
      Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 1;

    for (const selector of selectors) {
      const elements = [...document.querySelectorAll(selector)].filter((element) => {
        const style = getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
      for (let leftIndex = 0; leftIndex < elements.length; leftIndex += 1) {
        const left = elements[leftIndex];
        const leftParent = left.parentElement;
        for (let rightIndex = leftIndex + 1; rightIndex < elements.length; rightIndex += 1) {
          const right = elements[rightIndex];
          if (leftParent !== right.parentElement) continue;
          if (intersects(left.getBoundingClientRect(), right.getBoundingClientRect())) {
            failures.push(
              `${selector}: ${left.outerHTML.slice(0, 80)} <> ${right.outerHTML.slice(0, 80)}`
            );
          }
        }
      }
    }

    for (const field of document.querySelectorAll('.canvas-field:not([hidden])')) {
      const label = field.querySelector('span');
      const control = field.querySelector('input, select');
      if (
        label &&
        control &&
        intersects(label.getBoundingClientRect(), control.getBoundingClientRect())
      ) {
        failures.push(`field: ${label.textContent}`);
      }
    }

    const fixedControls = [...document.querySelectorAll('.history-tab, .changelog-tab')].filter(
      (element) => {
        const style = getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      }
    );
    const canvasControls = [
      ...document.querySelectorAll(
        '.canvas-toolbar button, .canvas-toolbar label, .canvas-settings input, .canvas-settings select'
      ),
    ].filter((element) => {
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
    for (const fixedControl of fixedControls) {
      for (const canvasControl of canvasControls) {
        if (
          intersects(fixedControl.getBoundingClientRect(), canvasControl.getBoundingClientRect())
        ) {
          failures.push(
            `global: ${fixedControl.className} <> ${canvasControl.id || canvasControl.className}`
          );
        }
      }
    }
    return failures;
  });
  expect(overlaps).toEqual([]);
}

async function installExportSpies(page) {
  await page.evaluate(() => {
    window.__exports = [];
    window.saveAs = async (blob, filename) => {
      window.__exports.push({
        action: 'download',
        filename,
        type: blob.type,
        bytes: [...new Uint8Array(await blob.arrayBuffer()).slice(0, 12)],
      });
    };
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        write: async (items) => {
          const types = items[0].types;
          const blob = await items[0].getType(types[0]);
          window.__exports.push({
            action: 'copy',
            type: blob.type,
            bytes: [...new Uint8Array(await blob.arrayBuffer()).slice(0, 12)],
          });
        },
      },
    });
  });
}

test('Chat mode still formats, copies, and downloads', async ({ page }) => {
  const errors = await openApp(page);
  await page.locator('#chatlogInput').fill(chatlog);
  await expect(page.locator('#output .generated')).toContainText('John Doe');
  await expect(page.locator('#output')).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-canvas-active', 'false');
  await expect(page.locator('.history-tab')).toBeVisible();
  await expect(page.locator('.changelog-tab')).toBeHidden();

  await page.evaluate(() => {
    window.__legacyActions = [];
    window.domtoimage = {
      toBlob: async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 2;
        canvas.height = 2;
        canvas.getContext('2d').fillRect(0, 0, 2, 2);
        return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      },
    };
    window.copyBlobToClipboard = async (blob) => window.__legacyActions.push(['copy', blob.type]);
    window.saveAs = (blob) => window.__legacyActions.push(['download', blob.type]);
  });
  await page.locator('#copyOutputImage').click();
  await expect.poll(() => page.evaluate(() => window.__legacyActions.length)).toBe(1);
  await page.locator('#downloadOutputTransparent').click();
  await expect.poll(() => page.evaluate(() => window.__legacyActions.length)).toBe(2);
  expect(await page.evaluate(() => window.__legacyActions)).toEqual([
    ['copy', 'image/png'],
    ['download', 'image/png'],
  ]);
  expect(errors).toEqual([]);
});

test('PNG export reads the cross-origin font stylesheet without console errors', async ({
  page,
}) => {
  const errors = await openApp(page);
  await page.locator('#chatlogInput').fill(chatlog);
  await expect(page.locator('#output .generated')).toContainText('John Doe');

  // The Google Fonts stylesheet must be CORS-readable so dom-to-image can
  // inline its rules instead of logging a SecurityError on every export.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const sheet = [...document.styleSheets].find((entry) =>
          entry.href?.includes('fonts.googleapis.com')
        );
        if (!sheet) return -1;
        try {
          return sheet.cssRules.length;
        } catch {
          return -2;
        }
      })
    )
    .toBeGreaterThan(0);

  await page.evaluate(() => {
    window.__exportCalls = [];
    window.saveAs = (blob) => window.__exportCalls.push(blob.type);
  });
  await page.locator('#downloadOutputTransparent').click();
  await expect.poll(() => page.evaluate(() => window.__exportCalls.length)).toBe(1);
  expect(errors.filter((entry) => entry.includes('domtoimage'))).toEqual([]);
});

test('Chat mode native Canvas 2D engine exports directly and falls back to download on restricted clipboard', async ({
  page,
}) => {
  const errors = await openApp(page);
  await page.locator('#chatlogInput').fill(chatlog);
  await expect(page.locator('#output .generated')).toContainText('John Doe');

  await page.evaluate(() => {
    delete window.domtoimage;
    window.__downloadCalls = [];
    window.saveAs = (blob, filename) => window.__downloadCalls.push({ type: blob.type, filename });
  });

  await page.locator('#downloadOutputTransparent').click();
  await expect.poll(() => page.evaluate(() => window.__downloadCalls.length)).toBe(1);
  const downloadResult = await page.evaluate(() => window.__downloadCalls[0]);
  expect(downloadResult.type).toBe('image/png');
  expect(downloadResult.filename).toContain('_chatlog.png');

  // Test clipboard fallback to download when clipboard API rejects (simulating restricted Firefox)
  await page.evaluate(() => {
    if (navigator.clipboard) {
      navigator.clipboard.write = async () => {
        throw new window.DOMException(
          'Clipboard permission denied by browser policy',
          'NotAllowedError'
        );
      };
    }
  });

  await page.locator('#copyOutputImage').click();
  await expect.poll(() => page.evaluate(() => window.__downloadCalls.length)).toBe(2);
  const fallbackResult = await page.evaluate(() => window.__downloadCalls[1]);
  expect(fallbackResult.type).toBe('image/png');
  expect(fallbackResult.filename).toContain('_chatlog.png');

  expect(errors).toEqual([]);
});

test('Canvas opens at 600 square with colored synchronized chat and an independent-block dialog', async ({
  page,
}) => {
  const errors = await openApp(page);
  await page.evaluate(() => {
    window.__canvasText = [];
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      window.__canvasText.push({ text: String(text), color: String(this.fillStyle) });
      return original.call(this, text, ...args);
    };
  });
  await page
    .locator('#chatlogInput')
    .fill('[20:14:12] John Doe says: Selam\n[20:14:13] * John Doe gülümser.');

  await page.locator('#modeCanvas').click();

  await expect(page.locator('#canvasStatus')).toContainText('600 × 600 px');
  expect(await canvasPixels(page)).toMatchObject({ width: 600, height: 600 });
  const initial = await page.evaluate(() => window.ChatlogCanvas.getProject().blocks[0]);
  expect(initial).toMatchObject({
    source: 'main-chat',
    transform: { x: 24, y: 24, width: 552, height: 552 },
  });
  expect(initial.formattedLines.flat().some(({ color }) => color === '#c2a3da')).toBe(true);
  expect(
    await page.evaluate(() =>
      window.__canvasText.some(
        ({ color, text }) => color === '#c2a3da' && text.includes('gülümser')
      )
    )
  ).toBe(true);
  expect(
    await page.evaluate(() => window.__canvasText.some(({ text }) => text.includes('20:14:')))
  ).toBe(false);

  const mainRow = page.locator('.canvas-layer-row').filter({ hasText: 'Ana Sohbet' });
  await mainRow.getByTitle('Katmanı seç').click();
  await page.keyboard.press('ArrowRight');
  const movedTransform = await page.evaluate(
    () => window.ChatlogCanvas.getProject().blocks[0].transform
  );
  await page.locator('#modeChat').click();
  await page.locator('#chatlogInput').fill('[20:14:14] * John Doe başını sallar.');
  await page.locator('#modeCanvas').click();
  const refreshed = await page.evaluate(() => window.ChatlogCanvas.getProject().blocks[0]);
  expect(refreshed.transform).toEqual(movedTransform);
  expect(refreshed.input).toContain('başını sallar');

  const addButton = page.locator('#canvasAddChat');
  await addButton.click();
  await expect(page.locator('#canvasChatDialog')).toBeVisible();
  await expect(page.locator('#canvasChatName')).toBeFocused();
  await page.locator('#canvasChatSubmit').click();
  await expect(page.locator('#canvasChatError')).toHaveText('Ad girin.');
  await page.locator('#canvasChatName').fill('Yan sohbet');
  await page.locator('#canvasChatInput').fill('[20:14:15] * Jane Doe el sallar.');
  await page.locator('#canvasChatSubmit').click();
  await expect(page.locator('#canvasChatDialog')).toBeHidden();
  await expect(addButton).toBeFocused();
  expect(await page.evaluate(() => window.ChatlogCanvas.getProject().blocks.at(-1))).toMatchObject({
    name: 'Yan sohbet',
    source: 'custom',
    input: '[20:14:15] * Jane Doe el sallar.',
  });
  expect(errors).toEqual([]);
});

test('Canvas supports the MVP workflow without runtime or layout failures', async ({
  page,
}, testInfo) => {
  const errors = await openApp(page);
  await page.locator('#chatlogInput').fill(chatlog);

  const canvasMode = page.locator('#modeCanvas');
  await expect(page.locator('body')).toHaveAttribute('data-canvas-ready', 'true');
  await expect(canvasMode).toBeVisible();
  await expect(canvasMode).toBeEnabled();
  await canvasMode.click();
  await expect(page.locator('body')).toHaveAttribute('data-canvas-active', 'true');
  await expect(page.locator('#canvasWorkspace')).toBeVisible();
  await expect(page.locator('#output')).toBeHidden();
  // The legacy photo-cluster section was removed; it must stay gone.
  await expect(page.locator('#imageOverlaySection')).toHaveCount(0);

  await page.locator('#canvasBackgroundColor').fill('#1565c0');
  await page.locator('#canvasBackgroundColor').dispatchEvent('change');
  await expect.poll(async () => (await canvasPixels(page)).opaque).toBeGreaterThan(0);

  await page.locator('#canvasBackgroundInput').setInputFiles(fixtureImage);
  await expect(page.locator('.canvas-layer-row--background')).toContainText('Arka Plan');
  await page.locator('#canvasImageInput').setInputFiles(fixtureImage);
  await expect(page.locator('.canvas-layer-row')).toHaveCount(3);

  const imageRow = page.locator('.canvas-layer-row').nth(1);
  await imageRow.getByTitle('Kilitle').click();
  await expect(imageRow.getByTitle('Kilidi aç')).toBeVisible();
  await imageRow.getByTitle('Gizle').click();
  await expect(imageRow.getByTitle('Göster')).toBeVisible();
  await imageRow.getByTitle('Göster').click();
  await imageRow.getByTitle('Kilidi aç').click();

  const chatRow = page.locator('.canvas-layer-row').nth(2);
  await chatRow.getByTitle('Katmanı seç').click();
  const before = await page.locator('#canvasSelection').boundingBox();
  await page.keyboard.press('ArrowRight');
  const moved = await page.locator('#canvasSelection').boundingBox();
  expect(moved.x).toBeGreaterThan(before.x);
  await page.locator('#canvasUndo').click();
  await chatRow.getByTitle('Katmanı seç').click();
  const undone = await page.locator('#canvasSelection').boundingBox();
  expect(Math.abs(undone.x - before.x)).toBeLessThanOrEqual(1);
  await page.locator('#canvasRedo').click();
  await chatRow.getByTitle('Katmanı seç').click();
  const redone = await page.locator('#canvasSelection').boundingBox();
  expect(redone.x).toBeGreaterThan(undone.x);

  const handle = page.locator('.canvas-selection__handle');
  const handleBox = await handle.boundingBox();
  await page.locator('#canvasStage').evaluate((stage) => {
    stage.setPointerCapture = () => {};
    stage.releasePointerCapture = () => {};
  });
  const pointer = {
    button: 0,
    pointerId: 7,
    clientX: handleBox.x + 4,
    clientY: handleBox.y + 4,
  };
  await handle.dispatchEvent('pointerdown', pointer);
  await page.locator('#canvasStage').dispatchEvent('pointermove', {
    ...pointer,
    clientX: pointer.clientX + 24,
    clientY: pointer.clientY + 16,
  });
  await page.locator('#canvasStage').dispatchEvent('pointerup', {
    ...pointer,
    clientX: pointer.clientX + 24,
    clientY: pointer.clientY + 16,
  });
  const resized = await page.locator('#canvasSelection').boundingBox();
  expect(resized.width).toBeGreaterThan(redone.width);
  await page.locator('#canvasUndo').click();
  await page.locator('#canvasRedo').click();

  const renderedStates = [];
  let previousChecksum = null;
  for (const fitMode of ['fit', 'fill', 'stretch']) {
    await page.locator('#canvasFitMode').selectOption(fitMode);
    await page.evaluate(() => window.ChatlogCanvas.render());
    if (previousChecksum !== null) {
      await expect
        .poll(async () => (await canvasPixels(page)).checksum, {
          message: `${fitMode} should finish rendering different pixels`,
        })
        .not.toBe(previousChecksum);
    }
    previousChecksum = (await canvasPixels(page)).checksum;
    renderedStates.push(previousChecksum);
  }
  expect(new Set(renderedStates).size).toBe(3);

  const dimensions = [];
  for (const composition of ['overlay', 'below', 'inset']) {
    await page.locator('#canvasComposition').selectOption(composition);
    await page.locator('#canvasPaddingX').fill('24');
    await page.locator('#canvasPaddingX').dispatchEvent('change');
    await page.locator('#canvasPaddingY').fill('18');
    await page.locator('#canvasPaddingY').dispatchEvent('change');
    dimensions.push(await canvasPixels(page));
  }
  expect(new Set(dimensions.map(({ width, height }) => `${width}x${height}`)).size).toBe(3);

  await installExportSpies(page);
  await page.locator('#canvasExportFormat').selectOption('png');
  await page.locator('#canvasDownload').click();
  await expect.poll(() => page.evaluate(() => window.__exports.length)).toBe(1);
  await page.locator('#canvasExportFormat').selectOption('jpeg');
  await page.locator('#canvasCopy').click();
  await expect.poll(() => page.evaluate(() => window.__exports.length)).toBe(2);
  const exports = await page.evaluate(() => window.__exports);
  expect(exports[0].type).toBe('image/png');
  expect(exports[0].bytes.slice(0, 8)).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(exports[1].type).toBe('image/jpeg');
  expect(exports[1].bytes.slice(0, 3)).toEqual([255, 216, 255]);

  await page.locator('.canvas-toolbar').evaluate((toolbar) => {
    const rect = toolbar.getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + rect.top + rect.height / 2 - window.innerHeight / 2 });
  });
  await expectNoOverlaps(page);
  await page.screenshot({
    path: testInfo.outputPath(`canvas-${testInfo.project.name}.png`),
    fullPage: true,
  });
  await imageRow.getByTitle('Sil').click();
  await expect(page.locator('.canvas-layer-row')).toHaveCount(2);
  await page.locator('#modeChat').click();
  await expect(page.locator('body')).toHaveAttribute('data-canvas-active', 'false');
  await expect(page.locator('.history-tab')).toBeVisible();
  await expect(page.locator('.changelog-tab')).toBeHidden();
  expect(errors).toEqual([]);
});

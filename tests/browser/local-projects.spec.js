import { expect, test } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/* global document, getComputedStyle, indexedDB, window */

const fixtureImage = path.resolve('public/assets/images/image.png');
const fontBytes = readFileSync(path.resolve('public/webfonts/fa-solid-900.woff2'));
const chatlog = '[20:14:12] John Doe says: Yerel proje tarayıcı testi';

function captureRuntimeErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function installLocalHarness(page, options = {}) {
  await page.addInitScript(({ disableIndexedDb }) => {
    window.localStorage.setItem('cm:tour:v1:completed', '1');
    window.localStorage.setItem('cm:locale:v1', 'tr');
    window.__localExports = [];
    window.saveAs = async (blob, filename) => {
      window.__localExports.push({
        filename,
        type: blob.type,
        bytes: [...new Uint8Array(await blob.arrayBuffer())],
      });
    };
    window.confirm = () => true;
    window.prompt = () => 'QA Font';
    if (disableIndexedDb) {
      Object.defineProperty(window, 'indexedDB', { configurable: true, value: undefined });
    }
  }, options);
}

async function openApp(page, options = {}) {
  const errors = captureRuntimeErrors(page);
  await installLocalHarness(page, options);
  await page.route('https://www.googletagmanager.com/**', (route) =>
    route.fulfill({ status: 204, contentType: 'text/javascript', body: '' })
  );
  await page.goto('/');
  await expect(page.locator('#chatlogInput')).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(window.ChatlogLocal))).toBe(true);
  await expect(page.locator('body')).toHaveAttribute('data-local-ready', 'true');
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

async function exportedFile(page, type, previousCount = 0) {
  await expect
    .poll(() =>
      page.evaluate(
        ({ mime, count }) =>
          window.__localExports.filter((entry) => entry.type === mime).length > count,
        { mime: type, count: previousCount }
      )
    )
    .toBe(true);
  return page.evaluate(
    (mime) => window.__localExports.filter((entry) => entry.type === mime).at(-1),
    type
  );
}

async function enterCanvas(page, withImage = false) {
  await page.locator('#chatlogInput').fill(chatlog);
  await page.locator('#modeCanvas').click();
  await expect(page.locator('#canvasWorkspace')).toBeVisible();
  await page.locator('#canvasBackgroundColor').fill('#1565c0');
  await page.locator('#canvasBackgroundColor').dispatchEvent('change');
  if (withImage) {
    await page.locator('#canvasBackgroundInput').setInputFiles(fixtureImage);
    await page.locator('#canvasImageInput').setInputFiles(fixtureImage);
    await expect(page.locator('.canvas-layer-row')).toHaveCount(3);
  }
  await expect.poll(async () => (await canvasPixels(page)).opaque).toBeGreaterThan(0);
}

async function expectLocalLayout(page) {
  const result = await page.evaluate(() => {
    const failures = [];
    const intersects = (left, right) =>
      Math.min(left.right, right.right) - Math.max(left.left, right.left) > 1 &&
      Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 1;
    for (const selector of [
      '.local-project-toolbar > button',
      '.local-dialog[open] .local-dialog__actions > *',
      '.image-stack-row > *',
    ]) {
      const controls = [...document.querySelectorAll(selector)].filter(
        (element) => getComputedStyle(element).display !== 'none'
      );
      for (let index = 0; index < controls.length; index += 1) {
        for (let peer = index + 1; peer < controls.length; peer += 1) {
          if (
            controls[index].parentElement === controls[peer].parentElement &&
            intersects(
              controls[index].getBoundingClientRect(),
              controls[peer].getBoundingClientRect()
            )
          ) {
            failures.push(`${selector}:${index}:${peer}`);
          }
        }
      }
    }
    return {
      failures,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  expect(result.failures).toEqual([]);
  expect(result.overflow).toBeLessThanOrEqual(1);
}

test('BCMAG round trips image assets and a custom font without changing pixels', async ({
  page,
}, testInfo) => {
  const errors = await openApp(page);
  await enterCanvas(page, true);
  await page.locator('#projectFontInput').setInputFiles({
    name: 'qa-font.woff2',
    mimeType: 'font/woff2',
    buffer: fontBytes,
  });
  await expect
    .poll(() => page.evaluate(() => window.ChatlogProject.getSnapshot().fonts.length))
    .toBe(1);
  await expect.poll(() => page.evaluate(() => document.fonts.check('12px "QA Font"'))).toBe(true);
  await page.locator('#customFontsDialog form[method="dialog"] button').click();
  await page.evaluate(() => window.ChatlogCanvas.render());

  const before = await page.evaluate(() => window.ChatlogProject.getSnapshot());
  const beforePixels = await canvasPixels(page);
  await page.locator('#projectSave').click();
  const saved = await exportedFile(page, 'application/x-bcmag');
  expect(saved.filename).toMatch(/\.bcmag$/u);

  await page.locator('#canvasClear').click();
  await page.locator('#chatlogInput').fill('changed');
  await page.locator('#projectFileInput').setInputFiles({
    name: saved.filename,
    mimeType: saved.type,
    buffer: Buffer.from(saved.bytes),
  });
  await expect(page.locator('#projectStatus')).toHaveText('Proje açıldı.');
  await expect(page.locator('#kumoToastRoot')).toBeAttached();
  await expect(page.getByText('Proje açıldı', { exact: true })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.ChatlogProject.getSnapshot().layers.length))
    .toBe(before.layers.length);
  const after = await page.evaluate(() => window.ChatlogProject.getSnapshot());
  expect(after).toEqual(before);
  await expect.poll(async () => (await canvasPixels(page)).checksum).toBe(beforePixels.checksum);
  expect(await canvasPixels(page)).toMatchObject({
    width: beforePixels.width,
    height: beforePixels.height,
  });
  await expectLocalLayout(page);
  await page.screenshot({
    path: path.resolve(`test-results/browser/local-projects-${testInfo.project.name}.png`),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test('corrupt BCMAG reselect preserves the active project and pixels', async ({ page }) => {
  const errors = await openApp(page);
  await enterCanvas(page);
  await page.locator('#projectSave').click();
  const saved = await exportedFile(page, 'application/x-bcmag');
  const envelope = JSON.parse(Buffer.from(saved.bytes).toString('utf8'));
  envelope.integrity.manifestSha256 = '0'.repeat(64);
  const corrupt = Buffer.from(JSON.stringify(envelope));
  const before = await page.evaluate(() => window.ChatlogProject.getSnapshot());
  const pixels = await canvasPixels(page);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.locator('#projectStatus').evaluate((element) => {
      element.textContent = 'waiting';
    });
    await page.locator('#projectFileInput').setInputFiles({
      name: 'corrupt.bcmag',
      mimeType: 'application/x-bcmag',
      buffer: corrupt,
    });
    await expect(page.locator('#projectStatus')).toHaveText(
      'Proje dosyası bozuk veya değiştirilmiş.'
    );
  }
  expect(await page.evaluate(() => window.ChatlogProject.getSnapshot())).toEqual(before);
  expect(await canvasPixels(page)).toEqual(pixels);
  expect(errors).toEqual([]);
});

test('autosave can restore or start fresh exactly once', async ({ page }) => {
  const errors = await openApp(page);
  await enterCanvas(page);
  await page.waitForTimeout(950);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(window.ChatlogLocal))).toBe(true);
  await expect(page.locator('#recoveryDialog')).toBeHidden();
  await page.locator('#modeCanvas').click();
  await expect(page.locator('#recoveryDialog')).toBeVisible();
  await page.getByRole('button', { name: 'Geri Yükle' }).click();
  await expect(page.locator('#chatlogInput')).toHaveValue(chatlog);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(window.ChatlogLocal))).toBe(true);
  await expect(page.locator('#recoveryDialog')).toBeHidden();

  await page.locator('#chatlogInput').fill(`${chatlog} fresh`);
  await page.locator('#modeCanvas').click();
  await page.waitForTimeout(950);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(window.ChatlogLocal))).toBe(true);
  await expect(page.locator('#recoveryDialog')).toBeHidden();
  await page.locator('#modeCanvas').click();
  await expect(page.locator('#recoveryDialog')).toBeVisible();
  await page.getByRole('button', { name: 'Yeni Başlat' }).click();
  await expect(page.locator('#recoveryDialog')).toBeHidden();
  await expect(page.locator('#chatlogInput')).toHaveValue('');
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(window.ChatlogLocal))).toBe(true);
  await expect(page.locator('#recoveryDialog')).toBeHidden();
  expect(errors).toEqual([]);
});

test('image stack supports save, rename, reopen, downloads, selection, and bulk delete', async ({
  page,
}, testInfo) => {
  const errors = await openApp(page);
  await enterCanvas(page);
  const savedProject = await page.evaluate(() => window.ChatlogProject.getSnapshot());
  const savedPixels = await canvasPixels(page);
  await page.locator('#projectStack').click();
  await expect(page.locator('#imageStackDialog')).toBeVisible();
  await page.locator('#imageStackSave').click();
  await expect(page.locator('.image-stack-row')).toHaveCount(1);
  const row = page.locator('.image-stack-row');
  const name = row.getByLabel('Görsel adı');
  await name.fill('QA Görsel');
  await name.dispatchEvent('change');
  await expect(name).toHaveValue('QA Görsel');

  await row.getByLabel('Görseli indir').click();
  await exportedFile(page, 'image/png');
  await row.locator('input[type="checkbox"]').check();
  await page.locator('#imageStackDownloadSelected').click();
  await exportedFile(page, 'image/png', 1);

  await page.locator('#imageStackDialog form[method="dialog"] button').click();
  await page.locator('#canvasBackgroundColor').fill('#e53935');
  await page.locator('#canvasBackgroundColor').dispatchEvent('change');
  await page.locator('#projectStack').click();
  await row.getByLabel('Projeyi yeniden aç').click();
  await expect.poll(async () => (await canvasPixels(page)).checksum).toBe(savedPixels.checksum);
  expect(await page.evaluate(() => window.ChatlogProject.getSnapshot())).toEqual(savedProject);

  await expectLocalLayout(page);
  await page.screenshot({
    path: path.resolve(`test-results/browser/local-stack-${testInfo.project.name}.png`),
    fullPage: true,
  });
  await page.locator('#imageStackDeleteSelected').click();
  await expect(page.locator('.image-stack-row')).toHaveCount(0);
  await expect(page.locator('.local-empty-state')).toContainText('Henüz');

  await page.evaluate(() => {
    window.confirm = () => false;
  });
  await expect(page.evaluate(() => window.ChatlogLocal.clearLocalData())).resolves.toBe(false);
  await page.evaluate(() => {
    window.confirm = () => true;
  });
  await expect(page.evaluate(() => window.ChatlogLocal.clearLocalData())).resolves.toBe(true);
  const storeCounts = await page.evaluate(async () => {
    const request = indexedDB.open('chatlog-magician');
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return Promise.all(
      ['projects', 'assets', 'fonts', 'autosaves', 'imageStack'].map(
        (store) =>
          new Promise((resolve, reject) => {
            const count = database.transaction(store).objectStore(store).count();
            count.onsuccess = () => resolve(count.result);
            count.onerror = () => reject(count.error);
          })
      )
    );
  });
  expect(storeCounts).toEqual([0, 0, 0, 0, 0]);
  expect(errors).toEqual([]);
});

test('IndexedDB fallback keeps editing and BCMAG save usable', async ({ page }) => {
  const errors = await openApp(page, { disableIndexedDb: true });
  await expect(page.locator('#projectStatus')).toHaveText(
    'Yerel depolama kullanılamıyor; dosya ile kaydetmeye devam edebilirsiniz.'
  );
  await expect(page.locator('#projectStack')).toBeDisabled();
  await expect(page.locator('#projectFonts')).toBeDisabled();
  await expect(page.locator('#projectOpen')).toBeEnabled();
  await expect(page.locator('#projectSave')).toBeEnabled();
  await page.locator('#chatlogInput').fill(chatlog);
  await page.locator('#modeCanvas').click();
  await page.locator('#projectSave').click();
  await exportedFile(page, 'application/x-bcmag');
  expect(errors).toEqual([]);
});

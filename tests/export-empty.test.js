import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';

const __dirname = dirname(fileURLToPath(import.meta.url));

/* global setTimeout */

function loadApp({ genLines = [], i18n = undefined, domtoimage = undefined } = {}) {
  const showToast = vi.fn();
  const toBlob = vi.fn(() => Promise.resolve(null));
  const alertFn = vi.fn();
  const copyBlob = vi.fn();
  const saveAs = vi.fn();

  const fakeWindow = {
    showToast,
    copyBlobToClipboard: copyBlob,
    saveAs,
    i18n,
    domtoimage: domtoimage === 'recorder' ? { impl: {}, toBlob } : domtoimage,
  };
  const outputEl = {
    querySelectorAll: (sel) => (sel === '.generated' ? genLines : []),
    classList: { contains: () => false },
  };
  const chain = () => ({
    length: 0,
    hasClass: () => false,
    addClass: () => {},
    removeClass: () => {},
    val: (v) => (v === undefined ? '' : undefined),
    prop: () => 0,
    width: () => 0,
    css: () => {},
    append: () => {},
    remove: () => {},
    show: () => {},
    hide: () => {},
  });
  const outputApi = () => ({ ...chain(), 0: outputEl });
  const fakeDocument = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    createElement: () => {
      throw new Error('unexpected createElement in empty-path test');
    },
  };
  const $stub = (sel) => {
    if (sel === fakeDocument) return { ready: () => {}, foundation: () => {} };
    if (sel === '#output') return outputApi();
    return chain();
  };
  const fakeStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };

  // The .ts source is the truth now (no emitted twin): strip types with
  // esbuild so the classic still evals against the fake globals.
  const source = readFileSync(resolve(__dirname, '../public/js/app.ts'), 'utf8');
  const scriptCode = transformSync(source, { loader: 'ts' }).code;
  const run = new Function('window', 'document', '$', 'localStorage', 'alert', scriptCode);
  run(fakeWindow, fakeDocument, $stub, fakeStorage, alertFn);
  return { fakeWindow, outputEl, showToast, toBlob, alertFn, copyBlob, saveAs };
}

const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

function brOnlyLine() {
  return { childNodes: [{ nodeType: 1, tagName: 'BR', childNodes: [] }] };
}

describe('empty export guard', () => {
  it('rejects EMPTY_OUTPUT when output has no .generated lines', async () => {
    const { fakeWindow, outputEl } = loadApp();
    await expect(fakeWindow.renderChatToBlob(outputEl)).rejects.toMatchObject({
      code: 'EMPTY_OUTPUT',
    });
  });

  it('rejects EMPTY_OUTPUT when .generated lines carry no text', async () => {
    const { fakeWindow, outputEl } = loadApp({ genLines: [brOnlyLine(), brOnlyLine()] });
    await expect(fakeWindow.renderChatToBlob(outputEl)).rejects.toMatchObject({
      code: 'EMPTY_OUTPUT',
    });
  });

  it('download shows the empty toast and never touches domtoimage or alert', async () => {
    const { fakeWindow, showToast, toBlob, alertFn, saveAs } = loadApp({
      domtoimage: 'recorder',
    });
    fakeWindow.downloadOutputImage('download');
    await tick();
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith('Dışa aktarılacak sohbet bulunamadı.', 'fa-info-circle');
    expect(toBlob).not.toHaveBeenCalled();
    expect(alertFn).not.toHaveBeenCalled();
    expect(saveAs).not.toHaveBeenCalled();
  });

  it('uses the i18n string when available', async () => {
    const { fakeWindow, showToast } = loadApp({
      i18n: { t: (key) => (key === 'toast.emptyOutput' ? 'LOC-TEXT' : null) },
    });
    fakeWindow.downloadOutputImage('download');
    await tick();
    expect(showToast).toHaveBeenCalledWith('LOC-TEXT', 'fa-info-circle');
  });

  it('copy action is guarded the same way', async () => {
    const { fakeWindow, showToast, toBlob, copyBlob } = loadApp({ domtoimage: 'recorder' });
    fakeWindow.downloadOutputImage('copy');
    await tick();
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(toBlob).not.toHaveBeenCalled();
    expect(copyBlob).not.toHaveBeenCalled();
  });
});

describe('exact snapshot export order', () => {
  const textLine = (text) => ({ textContent: text, childNodes: [] });

  it('download snapshots the #output element exactly via domtoimage first', async () => {
    const { fakeWindow, outputEl, toBlob, alertFn } = loadApp({
      genLines: [textLine('John Doe says: Selam')],
      domtoimage: 'recorder',
    });
    fakeWindow.downloadOutputImage('download');
    await tick();
    expect(toBlob).toHaveBeenCalledTimes(1);
    expect(toBlob.mock.calls[0][0]).toBe(outputEl);
    // The recorder resolves a null blob: existing null-blob handling alerts.
    expect(alertFn).toHaveBeenCalledTimes(1);
  });

  it('copy snapshots the #output element exactly via domtoimage first', async () => {
    const { fakeWindow, outputEl, toBlob, copyBlob } = loadApp({
      genLines: [textLine('John Doe')],
      domtoimage: 'recorder',
    });
    fakeWindow.downloadOutputImage('copy');
    await tick();
    expect(toBlob).toHaveBeenCalledTimes(1);
    expect(toBlob.mock.calls[0][0]).toBe(outputEl);
    expect(copyBlob).not.toHaveBeenCalled();
  });

  it('falls back to the native engine when domtoimage is unavailable', async () => {
    const nativeLine = {
      textContent: 'John Doe',
      childNodes: [{ nodeType: 3, nodeValue: 'John Doe', parentElement: null }],
    };
    const { fakeWindow, alertFn, saveAs } = loadApp({ genLines: [nativeLine] });
    fakeWindow.downloadOutputImage('download');
    await tick();
    // The native engine starts (it only fails on canvas creation in this
    // harness) and surfaces the failure via the generic error alert instead
    // of exporting anything.
    expect(alertFn).toHaveBeenCalledWith(
      'There was an error generating the image. Please try again.'
    );
    expect(saveAs).not.toHaveBeenCalled();
  });
});

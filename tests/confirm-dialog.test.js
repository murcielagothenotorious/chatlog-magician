import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { transformSync } from 'esbuild';

// The ui-utils dialog API is a thin shim now: while legacy callers remain,
// window.showConfirmDialog/showAlertDialog delegate to the ConfirmIsland
// bridge (window.__confirmDialog) and fall back to native dialogs only when
// the island is not mounted yet. Rendering (danger styling, prompt gating,
// Escape/backdrop handling) lives in the island — see confirm-island.test.js.
describe('Confirm & Alert Dialog shims', () => {
  let fakeWindow;
  let fakeDocument;

  function loadUiUtils() {
    // The .ts source is the truth now (no emitted twin): strip types with
    // esbuild so the sloppy-mode classic still evals against fake globals.
    const source = readFileSync(resolve(__dirname, '../public/js/ui-utils.ts'), 'utf8');
    const scriptCode = transformSync(source, { loader: 'ts' }).code;
    const run = new Function('window', 'document', scriptCode);
    run(fakeWindow, fakeDocument);
  }

  beforeEach(() => {
    fakeDocument = {
      getElementById: () => null,
      addEventListener: () => {},
    };
    fakeWindow = {
      confirm: vi.fn(() => true),
      alert: vi.fn(),
      prompt: vi.fn(() => ''),
    };
    loadUiUtils();
  });

  it('exposes showConfirmDialog and showAlertDialog on window', () => {
    expect(typeof fakeWindow.showConfirmDialog).toBe('function');
    expect(typeof fakeWindow.showAlertDialog).toBe('function');
  });

  describe('island delegation', () => {
    beforeEach(() => {
      fakeWindow.__confirmDialog = vi.fn(() => Promise.resolve(true));
      loadUiUtils();
    });

    it('passes string options through to the bridge untouched', async () => {
      const promise = fakeWindow.showConfirmDialog('Test onayı');
      expect(fakeWindow.__confirmDialog).toHaveBeenCalledTimes(1);
      expect(fakeWindow.__confirmDialog).toHaveBeenCalledWith('Test onayı');
      await expect(promise).resolves.toBe(true);
      expect(fakeWindow.confirm).not.toHaveBeenCalled();
    });

    it('passes object options through to the bridge untouched', async () => {
      const options = {
        title: 'Sohbet Geçmişini Sil',
        message: 'Emin misiniz?',
        confirmText: 'Geçmişi Sil',
        danger: true,
      };
      const promise = fakeWindow.showConfirmDialog(options);
      expect(fakeWindow.__confirmDialog).toHaveBeenCalledTimes(1);
      expect(fakeWindow.__confirmDialog).toHaveBeenCalledWith(options);
      await expect(promise).resolves.toBe(true);
    });

    it('showAlertDialog builds the alert config and delegates', async () => {
      const promise = fakeWindow.showAlertDialog('İşlem tamamlandı.', 'Başarılı');
      expect(fakeWindow.__confirmDialog).toHaveBeenCalledTimes(1);
      expect(fakeWindow.__confirmDialog).toHaveBeenCalledWith({
        type: 'alert',
        title: 'Başarılı',
        message: 'İşlem tamamlandı.',
        confirmText: 'Tamam',
      });
      await expect(promise).resolves.toBe(true);
      expect(fakeWindow.alert).not.toHaveBeenCalled();
    });

    it('showAlertDialog defaults the title to Bilgilendirme', async () => {
      await fakeWindow.showAlertDialog('Kopyalama başarısız oldu.');
      expect(fakeWindow.__confirmDialog).toHaveBeenCalledWith({
        type: 'alert',
        title: 'Bilgilendirme',
        message: 'Kopyalama başarısız oldu.',
        confirmText: 'Tamam',
      });
    });
  });

  describe('native fallback (island not mounted)', () => {
    it('uses window.confirm for string options', async () => {
      fakeWindow.confirm.mockReturnValue(false);
      const result = await fakeWindow.showConfirmDialog('Test onayı');
      expect(fakeWindow.confirm).toHaveBeenCalledTimes(1);
      expect(fakeWindow.confirm).toHaveBeenCalledWith('Test onayı');
      expect(result).toBe(false);
    });

    it('uses window.confirm for object options without a special type', async () => {
      const result = await fakeWindow.showConfirmDialog({
        title: 'Onay',
        message: 'Emin misiniz?',
      });
      expect(fakeWindow.confirm).toHaveBeenCalledWith('Emin misiniz?');
      expect(result).toBe(true);
    });

    it('uses window.alert for alert type and resolves true', async () => {
      const result = await fakeWindow.showConfirmDialog({
        type: 'alert',
        title: 'Bilgi',
        message: 'İşlem tamamlandı.',
      });
      expect(fakeWindow.alert).toHaveBeenCalledTimes(1);
      expect(fakeWindow.alert).toHaveBeenCalledWith('İşlem tamamlandı.');
      expect(result).toBe(true);
    });

    it('uses window.prompt for prompt type and resolves its return', async () => {
      fakeWindow.prompt.mockReturnValue('DELETE CLOUD DATA');
      const result = await fakeWindow.showConfirmDialog({
        type: 'prompt',
        message: 'Onay için yazın',
        promptValue: '',
      });
      expect(fakeWindow.prompt).toHaveBeenCalledTimes(1);
      expect(fakeWindow.prompt).toHaveBeenCalledWith('Onay için yazın', '');
      expect(result).toBe('DELETE CLOUD DATA');
    });

    it('treats the prompt flag as prompt type without an explicit type', async () => {
      await fakeWindow.showConfirmDialog({
        message: 'Onay için yazın',
        prompt: true,
        promptValue: 'önceki',
      });
      expect(fakeWindow.prompt).toHaveBeenCalledWith('Onay için yazın', 'önceki');
    });

    it('resolves true when the native dialog throws', async () => {
      fakeWindow.confirm.mockImplementation(() => {
        throw new Error('denied');
      });
      const result = await fakeWindow.showConfirmDialog('Test onayı');
      expect(result).toBe(true);
    });
  });
});

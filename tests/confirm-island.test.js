// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import React from 'react';

import ConfirmIsland from '../app/_dialogs/ConfirmIsland';

/* global document, window, Event */

// jsdom does not implement HTMLDialogElement.showModal/close: stub them per
// element. The close stub dispatches the close event like the browser does.
function stubNativeDialog(dialog) {
  dialog.showModal = function () {
    this.open = true;
    this.setAttribute('open', '');
  };
  dialog.close = function () {
    if (!this.open) return;
    this.open = false;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  delete window.__confirmDialog;
  delete window.i18n;
  delete window.ChatlogGuidance;
});

function setup() {
  const tree = render(React.createElement(ConfirmIsland));
  const dialog = document.getElementById('appConfirmDialog');
  stubNativeDialog(dialog);
  return { dialog, ...tree };
}

function els() {
  return {
    dialog: document.getElementById('appConfirmDialog'),
    title: document.getElementById('appConfirmTitle'),
    message: document.getElementById('appConfirmMessage'),
    promptContainer: document.getElementById('appConfirmPromptContainer'),
    input: document.getElementById('appConfirmInput'),
    ok: document.getElementById('appConfirmOk'),
    cancel: document.getElementById('appConfirmCancel'),
  };
}

function request(options) {
  let promise;
  act(() => {
    promise = window.__confirmDialog(options);
  });
  return promise;
}

describe('confirm island bridge', () => {
  it('installs the bridge on mount and removes it on unmount', () => {
    const { unmount } = setup();
    expect(typeof window.__confirmDialog).toBe('function');
    unmount();
    expect(window.__confirmDialog).toBeUndefined();
  });

  it('resolves pending requests as cancelled on unmount (no hung promises)', async () => {
    const { unmount } = setup();
    const confirmPromise = request('Yarım kalan onay');
    const promptPromise = request({ message: 'Yarım kalan prompt', prompt: true });
    // The second request cancels the first with the first request's type.
    await expect(confirmPromise).resolves.toBe(false);
    unmount();
    await expect(promptPromise).resolves.toBeNull();
  });

  it('renders a string confirm with legacy defaults and resolves true on OK', async () => {
    setup();
    const promise = request('Test onayı');
    const { dialog, title, message, ok, cancel, promptContainer } = els();

    expect(dialog.open).toBe(true);
    expect(title.textContent).toBe('Onay');
    expect(message.textContent).toBe('Test onayı');
    expect(ok.textContent).toBe('Onayla');
    expect(ok.className).toBe('local-action local-action--primary');
    expect(cancel.textContent).toBe('Vazgeç');
    expect(cancel.style.display).toBe('');
    expect(promptContainer.style.display).toBe('none');
    expect(document.activeElement).toBe(ok);

    fireEvent.click(ok);
    await expect(promise).resolves.toBe(true);
    expect(dialog.open).toBe(false);
  });

  it('auto-detects destructive strings like the legacy heuristic', async () => {
    setup();
    const promise = request('Tüm verileri silmek istiyor musunuz?');
    const { title, ok } = els();

    expect(title.textContent).toBe('İşlemi Onayla');
    expect(ok.textContent).toBe('Sil');
    expect(ok.className).toBe('local-action local-action--danger');

    fireEvent.click(ok);
    await expect(promise).resolves.toBe(true);
  });

  it('renders object configs and resolves false on cancel', async () => {
    setup();
    const promise = request({
      title: 'Sohbet Geçmişini Sil',
      message: 'Emin misiniz?',
      confirmText: 'Geçmişi Sil',
      cancelText: 'Kalsın',
      danger: true,
    });
    const { title, message, ok, cancel } = els();

    expect(title.textContent).toBe('Sohbet Geçmişini Sil');
    expect(message.textContent).toBe('Emin misiniz?');
    expect(ok.textContent).toBe('Geçmişi Sil');
    expect(ok.className).toContain('local-action--danger');
    expect(cancel.textContent).toBe('Kalsın');

    fireEvent.click(cancel);
    await expect(promise).resolves.toBe(false);
  });

  it('detects destructive titles in object configs without an explicit flag', async () => {
    setup();
    const promise = request({ title: 'Bu kaydı sil', message: 'Emin misiniz?' });
    // "sil" matches the legacy /sil|clear|delete|kaldır/i pattern.
    expect(els().ok.className).toContain('local-action--danger');
    fireEvent.click(els().cancel);
    await expect(promise).resolves.toBe(false);
  });

  it('lets an explicit danger:false win over the message heuristic', async () => {
    setup();
    const promise = request({ message: 'Bu kaydı sil?', danger: false });
    expect(els().ok.className).toBe('local-action local-action--primary');
    fireEvent.click(els().cancel);
    await expect(promise).resolves.toBe(false);
  });

  it('builds the default config for missing options', async () => {
    setup();
    const promise = request(undefined);
    const { title, message, ok } = els();
    expect(title.textContent).toBe('Onay');
    expect(message.textContent).toBe('');
    expect(ok.textContent).toBe('Onayla');
    fireEvent.click(ok);
    await expect(promise).resolves.toBe(true);
  });

  it('hides cancel in alert mode and resolves true on OK', async () => {
    setup();
    const promise = request({ type: 'alert', title: 'Başarılı', message: 'İşlem tamamlandı.' });
    const { ok, cancel } = els();

    expect(cancel.style.display).toBe('none');
    expect(ok.textContent).toBe('Tamam');

    fireEvent.click(ok);
    await expect(promise).resolves.toBe(true);
  });

  it('gates prompt OK on the required match and resolves the input value', async () => {
    setup();
    const promise = request({
      title: 'Tüm Bulut Verilerini Sil',
      message: 'Silmek için DELETE CLOUD DATA yazın',
      prompt: true,
      promptPlaceholder: 'DELETE CLOUD DATA',
      promptMatch: 'DELETE CLOUD DATA',
      confirmText: 'Tümünü Sil',
      danger: true,
    });
    const { dialog, promptContainer, input, ok } = els();

    expect(dialog.open).toBe(true);
    expect(promptContainer.style.display).toBe('block');
    expect(input.placeholder).toBe('DELETE CLOUD DATA');
    expect(document.activeElement).toBe(input);
    expect(ok.disabled).toBe(true);

    fireEvent.change(input, { target: { value: 'WRONG' } });
    expect(ok.disabled).toBe(true);

    fireEvent.change(input, { target: { value: 'DELETE CLOUD DATA' } });
    expect(ok.disabled).toBe(false);

    fireEvent.click(ok);
    await expect(promise).resolves.toBe('DELETE CLOUD DATA');
  });

  it('submits the prompt on Enter and resolves null on cancel', async () => {
    setup();
    const promise = request({ message: 'Adını yaz', prompt: true, promptValue: 'hazır' });
    const { input, ok } = els();

    expect(input.value).toBe('hazır');
    expect(ok.disabled).toBe(false);

    fireEvent.keyDown(input, { key: 'Enter' });
    await expect(promise).resolves.toBe('hazır');

    const cancelled = request({ message: 'Adını yaz', prompt: true });
    fireEvent.click(els().cancel);
    await expect(cancelled).resolves.toBeNull();
  });

  it('resolves false on Escape (cancel event) and prevents the native close', async () => {
    setup();
    const promise = request('İşlem onayı');
    const { dialog } = els();

    const event = new Event('cancel', { cancelable: true });
    act(() => {
      dialog.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    await expect(promise).resolves.toBe(false);
    expect(dialog.open).toBe(false);
  });

  it('resolves null on Escape for prompt type', async () => {
    setup();
    const promise = request({ message: 'Adını yaz', prompt: true });
    act(() => {
      els().dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    });
    await expect(promise).resolves.toBeNull();
  });

  it('resolves false when the dialog fires close', async () => {
    setup();
    const promise = request('İşlem onayı');
    act(() => {
      els().dialog.close();
    });
    await expect(promise).resolves.toBe(false);
  });

  it('resolves false on backdrop clicks and ignores inside clicks', async () => {
    setup();
    const promise = request('İşlem onayı');
    const { dialog } = els();

    // jsdom layout is all zeros, so (0,0) counts as inside the rect.
    fireEvent.click(dialog, { clientX: 0, clientY: 0 });
    expect(dialog.open).toBe(true);

    fireEvent.click(dialog, { clientX: 40, clientY: 40 });
    await expect(promise).resolves.toBe(false);
    expect(dialog.open).toBe(false);
  });

  it('cancels the pending request when a new one arrives (legacy parity)', async () => {
    setup();
    const first = request('İlk onay');
    const second = request('İkinci onay');

    await expect(first).resolves.toBe(false);
    expect(els().message.textContent).toBe('İkinci onay');
    expect(els().dialog.open).toBe(true);

    fireEvent.click(els().ok);
    await expect(second).resolves.toBe(true);
  });

  it('clears inherited inert state when opening (legacy parity)', async () => {
    setup();
    const { dialog } = els();
    dialog.inert = true;
    const promise = request('Test onayı');
    expect(dialog.inert).toBe(false);
    fireEvent.click(els().ok);
    await expect(promise).resolves.toBe(true);
  });

  it('prefers the legacy i18n translators over Turkish fallbacks', async () => {
    window.i18n = { t: (key) => `tr:${key}` };
    setup();
    const promise = request('Test onayı');
    expect(els().title.textContent).toBe('tr:dialog.confirmTitle');
    expect(els().ok.textContent).toBe('tr:ui.confirm');
    fireEvent.click(els().ok);
    await expect(promise).resolves.toBe(true);
  });

  it('prefers ChatlogGuidance i18n over window.i18n', async () => {
    window.i18n = { t: () => 'legacy' };
    window.ChatlogGuidance = { i18n: { t: () => 'guidance' } };
    setup();
    const promise = request('Test onayı');
    expect(els().title.textContent).toBe('guidance');
    fireEvent.click(els().ok);
    await expect(promise).resolves.toBe(true);
  });
});

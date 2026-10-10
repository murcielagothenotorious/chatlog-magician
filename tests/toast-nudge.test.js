// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* global document, window */

const FORUM_URL = 'https://forum-tr.gta.world/index.php?/topic/27368-chatlog-magician/';
const realOpen = window.open;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  document.body.innerHTML =
    '<button id="copyOutputImage"></button><button id="downloadOutputTransparent"></button>';
  window.__kumoToast = vi.fn();
  window.open = vi.fn();
  // Capture the DOMContentLoaded wiring without dispatching globally: the
  // module is re-imported per test for fresh session state, and dispatching
  // would fire every accumulated listener.
  const readyHandlers = [];
  const spy = vi.spyOn(document, 'addEventListener').mockImplementation((type, handler) => {
    if (type === 'DOMContentLoaded') readyHandlers.push(handler);
  });
  await import('../public/js/ui-utils.ts');
  spy.mockRestore();
  for (const handler of readyHandlers) handler();
});

afterEach(() => {
  document.body.innerHTML = '';
  delete window.__kumoToast;
  delete window.showToast;
  delete window.showConfirmDialog;
  delete window.showAlertDialog;
  delete window.closeInfoBox;
  window.open = realOpen;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function nudgeCalls() {
  return window.__kumoToast.mock.calls.filter(([first]) => typeof first === 'object');
}

describe('support nudge toast', () => {
  it('dispatches the nudge as a rich toast after the first export click', () => {
    document.getElementById('copyOutputImage').click();
    vi.advanceTimersByTime(3500);

    const calls = nudgeCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toMatchObject({
      title: 'Chatlog Magician işinize yarıyor mu?',
      description: 'Bir beğeni veya yorum bırakarak destek olabilirsiniz.',
      variant: 'info',
      timeout: 8000,
    });
    expect(calls[0][0].actions).toHaveLength(1);
    expect(calls[0][0].actions[0].label).toBe('Tanıtıma');
    expect(typeof calls[0][0].actions[0].onClick).toBe('function');
  });

  it('triggers from the download button too', () => {
    document.getElementById('downloadOutputTransparent').click();
    vi.advanceTimersByTime(3500);
    expect(nudgeCalls()).toHaveLength(1);
  });

  it('shows only once per session', () => {
    document.getElementById('copyOutputImage').click();
    vi.advanceTimersByTime(3500);
    document.getElementById('downloadOutputTransparent').click();
    vi.advanceTimersByTime(3500);
    expect(nudgeCalls()).toHaveLength(1);
  });

  it('opens the forum topic without an opener', () => {
    document.getElementById('copyOutputImage').click();
    vi.advanceTimersByTime(3500);
    const action = nudgeCalls()[0][0].actions[0];
    action.onClick();
    expect(window.open).toHaveBeenCalledWith(FORUM_URL, '_blank', 'noopener,noreferrer');
  });

  it('stays silent when the toast island is not mounted', () => {
    delete window.__kumoToast;
    expect(() => {
      document.getElementById('copyOutputImage').click();
      vi.advanceTimersByTime(10000);
      window.showToast('merhaba', 'fa-info');
    }).not.toThrow();
  });

  it('keeps legacy string toast delegation intact', () => {
    window.showToast('Kopyalandı', 'fa-check-circle');
    expect(window.__kumoToast).toHaveBeenCalledWith('Kopyalandı', 'fa-check-circle');
  });
});

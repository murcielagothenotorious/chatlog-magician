// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import React from 'react';

import ToastIsland from '../app/_toast/ToastIsland';

/* global document, window */

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  delete window.__kumoToast;
});

describe('toast island bridge', () => {
  it('installs the bridge and renders legacy string toasts', async () => {
    render(React.createElement(ToastIsland));
    expect(typeof window.__kumoToast).toBe('function');

    await act(async () => {
      window.__kumoToast('Kopyalandı', 'fa-check-circle');
    });
    expect(document.getElementById('kumoToastRoot').textContent).toContain('Kopyalandı');
  });

  it('renders rich toasts with description and action buttons', async () => {
    render(React.createElement(ToastIsland));
    const onClick = vi.fn();

    await act(async () => {
      window.__kumoToast({
        title: 'Destek çağrısı',
        description: 'Bir beğeni bırakarak destek olabilirsiniz.',
        variant: 'info',
        timeout: 30000,
        actions: [{ label: 'Tanıtıma', onClick }],
      });
    });

    const root = document.getElementById('kumoToastRoot');
    expect(root.textContent).toContain('Destek çağrısı');
    expect(root.textContent).toContain('Bir beğeni bırakarak destek olabilirsiniz.');
    const action = [...root.querySelectorAll('button')].find((b) =>
      b.textContent.includes('Tanıtıma')
    );
    expect(action).toBeTruthy();
    action.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

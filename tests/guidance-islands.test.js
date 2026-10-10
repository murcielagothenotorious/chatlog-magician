// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import React from 'react';

import GuidanceProvider from '../app/_guidance/GuidanceProvider';
import HelpIsland from '../app/_guidance/HelpIsland';
import TourIsland, { TOUR_STORAGE_KEY } from '../app/_guidance/TourIsland';
import { getDialogManager } from '../public/js/dialog-manager.ts';

/* global document, window, Element, CustomEvent */

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  window.localStorage.clear();
  delete window.i18n;
  restoreLayout();
});

function mapStorage(values = {}) {
  const map = new Map(Object.entries(values));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: vi.fn((key, value) => map.set(key, value)),
  };
}

// jsdom has no layout (getClientRects is always empty), and islands decide
// visibility inside mount effects, so stub the prototype before render. The
// hidden-attribute check still applies first, so hidden fixtures stay hidden.
const realGetClientRects = Element.prototype.getClientRects;
function stubLayout() {
  Element.prototype.getClientRects = () => [{}];
}
function restoreLayout() {
  Element.prototype.getClientRects = realGetClientRects;
}

describe('help island', () => {
  function setup() {
    const dialogs = getDialogManager(document);
    const tree = render(
      React.createElement(
        GuidanceProvider,
        null,
        React.createElement(
          'main',
          { id: 'main' },
          React.createElement('button', { id: 'showHelpBtn' }, 'Help')
        ),
        React.createElement(HelpIsland, { dialogs })
      )
    );
    return { dialogs, ...tree };
  }

  it('opens, searches sections, and restores focus on close', async () => {
    setup();
    const opener = document.getElementById('showHelpBtn');
    opener.focus();
    fireEvent.click(opener);
    const modal = document.getElementById('helpModal');
    expect(modal.style.display).toBe('flex');
    await waitFor(() => expect(document.getElementById('main').inert).toBe(true));

    const hiddenFlags = () =>
      [...document.querySelectorAll('[data-help-section]')].map((el) => el.hidden);
    expect(hiddenFlags().every((h) => h === false)).toBe(true);

    fireEvent.change(document.getElementById('helpSearch'), { target: { value: 'zzz-no-match' } });
    expect(hiddenFlags().every((h) => h === true)).toBe(true);
    expect(document.getElementById('helpEmpty').hidden).toBe(false);

    fireEvent.change(document.getElementById('helpSearch'), { target: { value: '' } });
    expect(hiddenFlags().every((h) => h === false)).toBe(true);
    expect(document.getElementById('helpEmpty').hidden).toBe(true);

    fireEvent.click(document.getElementById('closeHelpModalBtn'));
    expect(modal.style.display).toBe('none');
    expect(document.activeElement).toBe(opener);
    expect(document.getElementById('main').inert).toBe(false);
  });

  it('closes on Escape and traps Tab through the shared manager', async () => {
    setup();
    fireEvent.click(document.getElementById('showHelpBtn'));
    await waitFor(() => expect(document.getElementById('main').inert).toBe(true));

    const last = document.getElementById('closeHelpModalBtn');
    const first = document.getElementById('closeHelpModal');
    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.getElementById('helpModal').style.display).toBe('none');
    expect(document.getElementById('main').inert).toBe(false);
  });

  it('highlights matches and exposes a live empty state', () => {
    setup();
    fireEvent.click(document.getElementById('showHelpBtn'));
    fireEvent.change(document.getElementById('helpSearch'), { target: { value: 'canvas' } });
    const marks = [...document.querySelectorAll('#helpModal mark')];
    expect(marks.length).toBeGreaterThan(0);
    expect(marks.every((m) => /canvas/i.test(m.textContent))).toBe(true);

    fireEvent.change(document.getElementById('helpSearch'), { target: { value: '' } });
    expect(document.querySelectorAll('#helpModal mark').length).toBe(0);

    fireEvent.change(document.getElementById('helpSearch'), { target: { value: 'zzz-no-match' } });
    expect(document.getElementById('helpEmpty').getAttribute('role')).toBe('status');
    fireEvent.click(document.getElementById('closeHelpModalBtn'));
  });

  it('re-renders when the legacy locale preference changes', async () => {
    setup();
    fireEvent.click(document.getElementById('showHelpBtn'));
    expect(document.getElementById('helpTitle').textContent).toContain('Help');

    window.i18n = { storedLocale: () => 'tr' };
    document.dispatchEvent(new CustomEvent('cm:locale-changed', { detail: 'tr' }));
    await waitFor(() =>
      expect(document.getElementById('helpTitle').textContent).toContain('Yardım')
    );
    fireEvent.click(document.getElementById('closeHelpModalBtn'));
  });
});

describe('tour island', () => {
  const steps = [
    { target: '#t-hidden', titleKey: 'hidden', bodyKey: 'hidden.body' },
    { target: '#t-visible', titleKey: 'visible', bodyKey: 'visible.body' },
  ];

  function setup({ completed = false, withHelp = false } = {}) {
    stubLayout();
    const storage = mapStorage(completed ? { [TOUR_STORAGE_KEY]: '1' } : {});
    const dialogs = getDialogManager(document);
    const tree = render(
      React.createElement(
        GuidanceProvider,
        null,
        React.createElement(
          'main',
          { id: 'main' },
          React.createElement('button', { id: 't-hidden', hidden: true }, 'h'),
          React.createElement('button', { id: 't-visible' }, 'v')
        ),
        withHelp ? React.createElement(HelpIsland, { dialogs }) : null,
        React.createElement(TourIsland, { steps, storage })
      )
    );
    return { storage, ...tree };
  }

  it('starts once, skips hidden targets, and marks completion', () => {
    const { storage } = setup();
    const overlay = document.getElementById('tourOverlay');
    expect(overlay.hidden).toBe(false);
    expect(document.getElementById('tourTitle').textContent).toBe('visible');
    expect(document.getElementById('main').inert).toBe(true);

    fireEvent.click(document.getElementById('tourNext'));
    expect(storage.setItem).toHaveBeenCalledWith(TOUR_STORAGE_KEY, '1');
    expect(overlay.hidden).toBe(true);
    expect(document.getElementById('main').inert).toBe(false);
  });

  it('does not auto-start after completion but restarts from the help footer', () => {
    setup({ completed: true, withHelp: true });
    expect(document.getElementById('tourOverlay').hidden).toBe(true);

    fireEvent.click(document.getElementById('restartTour'));
    expect(document.getElementById('tourOverlay').hidden).toBe(false);
    expect(document.getElementById('tourTitle').textContent).toBe('visible');
  });

  it('ends on Escape and navigates steps with correct button states', () => {
    const two = [
      { target: '#t-visible', titleKey: 'one', bodyKey: 'one.body' },
      { target: '#t-visible', titleKey: 'two', bodyKey: 'two.body' },
    ];
    stubLayout();
    const storage = mapStorage();
    render(
      React.createElement(
        GuidanceProvider,
        null,
        React.createElement(
          'main',
          { id: 'main' },
          React.createElement('button', { id: 't-visible' }, 'v')
        ),
        React.createElement(TourIsland, { steps: two, storage })
      )
    );
    expect(document.getElementById('tourPrevious').disabled).toBe(true);
    const nextLabel = document.getElementById('tourNext').textContent;

    fireEvent.click(document.getElementById('tourNext'));
    expect(document.getElementById('tourTitle').textContent).toBe('two');
    expect(document.getElementById('tourPrevious').disabled).toBe(false);
    expect(document.getElementById('tourNext').textContent).not.toBe(nextLabel);

    fireEvent.click(document.getElementById('tourPrevious'));
    expect(document.getElementById('tourTitle').textContent).toBe('one');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.getElementById('tourOverlay').hidden).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith(TOUR_STORAGE_KEY, '1');
  });

  it('still starts when storage is blocked', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    stubLayout();
    render(
      React.createElement(
        GuidanceProvider,
        null,
        React.createElement(
          'main',
          { id: 'main' },
          React.createElement('button', { id: 't-visible' }, 'v')
        ),
        React.createElement(TourIsland, { steps: [steps[1]], storage: broken })
      )
    );
    expect(document.getElementById('tourOverlay').hidden).toBe(false);
  });
});

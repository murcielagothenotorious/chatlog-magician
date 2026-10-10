import { describe, expect, it, vi } from 'vitest';

import { DICTIONARIES, createI18n } from '../public/js/i18n.ts';

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, value)),
  };
}

describe('i18n', () => {
  it('keeps Turkish, English, Spanish, and Russian dictionaries structurally identical', () => {
    const trKeys = Object.keys(DICTIONARIES.tr).sort();
    expect(Object.keys(DICTIONARIES.en).sort()).toEqual(trKeys);
    expect(Object.keys(DICTIONARIES.es).sort()).toEqual(trKeys);
    expect(Object.keys(DICTIONARIES.ru).sort()).toEqual(trKeys);
  });

  it('chooses, persists, interpolates, and falls back safely', () => {
    const store = storage();
    const i18n = createI18n({ storage: store, navigatorLanguage: 'en-US' });
    expect(i18n.locale()).toBe('en');
    expect(i18n.t('tour.progress', { current: 2, total: 5 })).toContain('2');
    expect(i18n.t('missing.key')).toBe('missing.key');

    i18n.setLocale('es');
    expect(store.setItem).toHaveBeenCalledWith('cm:locale:v1', 'es');
    expect(i18n.locale()).toBe('es');

    i18n.setLocale('ru');
    expect(store.setItem).toHaveBeenCalledWith('cm:locale:v1', 'ru');
    expect(i18n.locale()).toBe('ru');

    i18n.setLocale('tr');
    expect(store.setItem).toHaveBeenCalledWith('cm:locale:v1', 'tr');
    expect(i18n.locale()).toBe('tr');
  });

  it('updates translated text and accessible names without reloading', () => {
    const textNode = { dataset: { i18n: 'help.title' }, textContent: '' };
    const labelNode = {
      dataset: { i18nAriaLabel: 'help.close', i18nTitle: 'help.close' },
      setAttribute: vi.fn(),
    };
    const document = { querySelectorAll: vi.fn(() => [textNode, labelNode]), documentElement: {} };
    const i18n = createI18n({ storage: storage(), navigatorLanguage: 'tr', document });

    i18n.setLocale('en');

    expect(textNode.textContent).toBe(DICTIONARIES.en['help.title']);
    expect(labelNode.setAttribute).toHaveBeenCalledWith(
      'aria-label',
      DICTIONARIES.en['help.close']
    );
    expect(document.documentElement.lang).toBe('en');
  });

  it('translates dynamic toolbar and preset keys across all locales', () => {
    for (const locale of ['tr', 'en', 'es', 'ru']) {
      const i18n = createI18n({ storage: storage(), navigatorLanguage: locale });
      expect(i18n.t('ui.bgOn')).toBeTruthy();
      expect(i18n.t('ui.bgOff')).toBeTruthy();
      expect(i18n.t('ui.namesOn')).toBeTruthy();
      expect(i18n.t('ui.namesOff')).toBeTruthy();
      expect(i18n.t('ui.whisperOn')).toBeTruthy();
      expect(i18n.t('ui.whisperOff')).toBeTruthy();
      expect(i18n.t('ui.contrastLow')).toBeTruthy();
      expect(i18n.t('ui.sysmsgHidden')).toBeTruthy();
      expect(i18n.t('presets.apply')).toBeTruthy();
      expect(i18n.t('presets.preview')).toBeTruthy();
      expect(i18n.t('presets.share')).toBeTruthy();
      expect(i18n.t('presets.download')).toBeTruthy();
      expect(i18n.t('presets.delete')).toBeTruthy();
    }
  });
});

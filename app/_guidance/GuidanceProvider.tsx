'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { createI18n } from '../../public/js/i18n';

interface GuidanceValue {
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: string;
}

const GuidanceContext = createContext<GuidanceValue>({ t: (key) => key, locale: 'tr' });

export function useGuidance(): GuidanceValue {
  return useContext(GuidanceContext);
}

export const LOCALE_CHANGED_EVENT = 'cm:locale-changed';

// Island-side i18n provider. Owns a second engine instance over the same
// storage keys and dictionaries (created with document: undefined so it never
// touches the DOM), and re-syncs whenever the legacy locale selector changes
// the preference (single writer until slice 4 replaces window.i18n).
export default function GuidanceProvider({ children }: { children: ReactNode }) {
  const [engine] = useState(() =>
    createI18n({
      storage: typeof window === 'undefined' ? undefined : window.localStorage,
      navigatorLanguage: typeof navigator === 'undefined' ? 'tr' : navigator.language || 'tr',
      document: undefined,
    })
  );
  const [locale, setLocale] = useState<string>(() => engine.locale());

  useEffect(() => {
    engine.subscribe(setLocale);
    const syncFromLegacy = (event?: Event) => {
      const legacy = (window as unknown as { i18n?: { storedLocale?: () => string } }).i18n;
      const stored =
        legacy?.storedLocale?.() ?? (event as CustomEvent)?.detail ?? engine.storedLocale();
      engine.setLocale(stored);
    };
    document.addEventListener(LOCALE_CHANGED_EVENT, syncFromLegacy);
    syncFromLegacy();
    return () => {
      document.removeEventListener(LOCALE_CHANGED_EVENT, syncFromLegacy);
      engine.destroy();
    };
  }, [engine]);

  const value = useMemo<GuidanceValue>(
    () => ({ t: (key, vars) => engine.t(key, vars ?? {}), locale }),
    [engine, locale]
  );
  return <GuidanceContext.Provider value={value}>{children}</GuidanceContext.Provider>;
}

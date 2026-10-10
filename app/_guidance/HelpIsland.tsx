'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useGuidance } from './GuidanceProvider';
import {
  getDialogBridgeManager,
  waitForDialogBridgeManager,
  type DialogBridgeManager,
} from './dialog-bridge';

// Same five sections as the carved-out legacy markup, in markup order. (The old
// HELP_SECTIONS constant also listed privacy/cloud-adjacent keys that were
// never rendered; the island reproduces exactly what shipped.)
const HELP_SECTIONS = [
  { id: 'chat', titleKey: 'help.chat.title', bodyKey: 'help.chat.body' },
  { id: 'canvas', titleKey: 'help.canvas.title', bodyKey: 'help.canvas.body' },
  { id: 'local', titleKey: 'help.local.title', bodyKey: 'help.local.body' },
  { id: 'community', titleKey: 'help.community.title', bodyKey: 'help.community.body' },
  { id: 'support', titleKey: 'help.support.title', bodyKey: 'help.support.body' },
];

interface HelpIslandProps {
  // Test-only injection; production uses the window bridge to the vanilla
  // dialog-manager singleton.
  dialogs?: DialogBridgeManager | null;
}

// Wrap query matches in <mark>. Locale-aware indexOf loop (no regex, so
// special characters in the query can't break or inject).
function highlight(text: string, query: string, locale: string): ReactNode {
  const q = query.trim().toLocaleLowerCase(locale);
  if (!q) return text;
  const lower = text.toLocaleLowerCase(locale);
  const parts: ReactNode[] = [];
  let at = 0;
  let key = 0;
  for (;;) {
    const found = lower.indexOf(q, at);
    if (found < 0) break;
    if (found > at) parts.push(text.slice(at, found));
    parts.push(<mark key={key++}>{text.slice(found, found + q.length)}</mark>);
    at = found + q.length;
  }
  parts.push(text.slice(at));
  return parts;
}

export default function HelpIsland({ dialogs }: HelpIslandProps) {
  const { t, locale } = useGuidance();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const modalRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if ((event.target as Element | null)?.closest?.('#showHelpBtn')) setOpen(true);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    const onKeydown = (event: KeyboardEvent) => {
      getDialogBridgeManager(dialogs)?.routeKeydown(event);
    };
    document.addEventListener('keydown', onKeydown);
    return () => document.removeEventListener('keydown', onKeydown);
  }, [dialogs]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let session: { release(): void } | null = null;
    void (async () => {
      const manager = await waitForDialogBridgeManager(dialogs);
      if (cancelled) return;
      if (manager && modalRef.current) {
        session = manager.openModal({
          element: modalRef.current,
          initialFocus: inputRef.current,
          onEscape: () => setOpen(false),
        });
      } else {
        // Bridge unavailable: still land keyboard users inside the modal.
        inputRef.current?.focus?.();
      }
    })();
    return () => {
      cancelled = true;
      session?.release();
      session = null;
    };
  }, [open, dialogs]);

  if (!mounted) return null;

  // Parity with the legacy search: match against title+body text with no
  // separator (textContent concatenation), lowercased in the resolved locale.
  const normalized = query.trim().toLocaleLowerCase(locale);
  const matches = (titleKey: string, bodyKey: string) =>
    !normalized || (t(titleKey) + t(bodyKey)).toLocaleLowerCase(locale).includes(normalized);
  const visibleCount = HELP_SECTIONS.filter((s) => matches(s.titleKey, s.bodyKey)).length;
  const close = () => setOpen(false);

  return (
    <div
      id="helpModal"
      ref={modalRef}
      className="help-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="helpTitle"
      style={{ display: open ? 'flex' : 'none' }}
    >
      <div className="help-modal-backdrop" onClick={close} />
      <div className="help-modal-content">
        <div className="help-modal-header">
          <h2 id="helpTitle">
            <i className="fas fa-question-circle"></i> <span>{t('help.title')}</span>
          </h2>
          <button
            type="button"
            id="closeHelpModal"
            className="help-modal-close"
            aria-label={t('help.close')}
            title={t('help.close')}
            onClick={close}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="help-modal-body help-guide">
          <label className="help-search" htmlFor="helpSearch">
            <i className="fas fa-magnifying-glass" aria-hidden="true"></i>
            <input
              id="helpSearch"
              ref={inputRef}
              type="search"
              aria-label={t('help.search')}
              placeholder={t('help.search.placeholder')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <p id="helpEmpty" className="help-empty" hidden={visibleCount !== 0} role="status">
            <i className="fas fa-magnifying-glass" aria-hidden="true"></i> {t('help.empty')}
          </p>
          {HELP_SECTIONS.map((s) => (
            <section
              key={s.id}
              className="help-section"
              data-help-section={s.id}
              hidden={!matches(s.titleKey, s.bodyKey)}
            >
              <h3>{highlight(t(s.titleKey), query, locale)}</h3>
              <p>{highlight(t(s.bodyKey), query, locale)}</p>
            </section>
          ))}
        </div>
        <div className="help-modal-footer">
          <button type="button" id="restartTour" className="button secondary">
            {t('help.restartTour')}
          </button>
          <button type="button" id="closeHelpModalBtn" className="button primary" onClick={close}>
            {t('help.done')}
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useGuidance } from './GuidanceProvider';

export const TOUR_STORAGE_KEY = 'cm:tour:v1:completed';

export interface TourStep {
  target: string;
  titleKey: string;
  bodyKey: string;
  mode?: string;
}

export const TOUR_STEPS: readonly TourStep[] = Object.freeze([
  { target: '#modeChat', titleKey: 'tour.chat.title', bodyKey: 'tour.chat.body', mode: 'chat' },
  {
    target: '#modeCanvas',
    titleKey: 'tour.canvas.title',
    bodyKey: 'tour.canvas.body',
    mode: 'canvas',
  },
  { target: '#projectLocal', titleKey: 'tour.projects.title', bodyKey: 'tour.projects.body' },
  { target: '#communityOpen', titleKey: 'tour.community.title', bodyKey: 'tour.community.body' },
]);

function visibleTarget(target: Element | null): boolean {
  if (!target) return false;
  if ((target as HTMLElement).hidden) return false;
  const rects = (target as Element & { getClientRects?: () => unknown }).getClientRects;
  return typeof rects !== 'function' || (target as Element).getClientRects().length > 0;
}

function findVisible(steps: readonly TourStep[], from: number, direction = 1): number {
  for (let c = from; c >= 0 && c < steps.length; c += direction) {
    if (visibleTarget(document.querySelector(steps[c].target))) return c;
  }
  return -1;
}

function setMainInert(value: boolean) {
  const main = document.getElementById('main') as (HTMLElement & { inert?: boolean }) | null;
  if (main) main.inert = value;
}

interface TourIslandProps {
  steps?: readonly TourStep[];
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  autoStart?: boolean;
}

export default function TourIsland({
  steps = TOUR_STEPS,
  storage,
  autoStart = true,
}: TourIslandProps) {
  const { t } = useGuidance();
  const [mounted, setMounted] = useState(false);
  const [index, setIndex] = useState(-1);
  const indexRef = useRef(-1);
  indexRef.current = index;
  const returnFocusRef = useRef<Element | null>(null);
  const activeTargetRef = useRef<Element | null>(null);
  const store = storage ?? (typeof window === 'undefined' ? null : window.localStorage);

  const end = useCallback(
    (markComplete: boolean) => {
      if (markComplete) {
        try {
          store?.setItem?.(TOUR_STORAGE_KEY, '1');
        } catch {
          // Completion remains valid for the current page when storage is blocked.
        }
      }
      setMainInert(false);
      setIndex(-1);
      (returnFocusRef.current as HTMLElement | null)?.focus?.();
      returnFocusRef.current = null;
    },
    [store]
  );

  const start = useCallback(
    (force = false) => {
      try {
        if (!force && store?.getItem?.(TOUR_STORAGE_KEY)) return false;
      } catch {
        // A blocked storage API must not make guidance unavailable.
      }
      const first = findVisible(steps, 0);
      if (first < 0) return false;
      returnFocusRef.current = document.activeElement;
      setMainInert(true);
      setIndex(first);
      return true;
    },
    [steps, store]
  );

  const next = useCallback(() => {
    const candidate = findVisible(steps, indexRef.current + 1);
    if (candidate < 0) {
      end(true);
      return;
    }
    setIndex(candidate);
  }, [steps, end]);

  const previous = useCallback(() => {
    const candidate = findVisible(steps, indexRef.current - 1, -1);
    if (candidate >= 0) setIndex(candidate);
  }, [steps]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (index < 0) return;
    const step = steps[index];
    const target = document.querySelector(step.target);
    activeTargetRef.current?.classList?.remove('tour-target');
    activeTargetRef.current = target;
    activeTargetRef.current?.classList?.add('tour-target');
    if (step.mode) {
      document.getElementById(step.mode === 'canvas' ? 'modeCanvas' : 'modeChat')?.click();
    }
    (target as HTMLElement | null)?.scrollIntoView?.({ block: 'center', behavior: 'auto' });
    document.getElementById('tourNext')?.focus?.();
    return () => {
      activeTargetRef.current?.classList?.remove('tour-target');
      activeTargetRef.current = null;
    };
  }, [index, steps]);

  // #restartTour is rendered by HelpIsland, so delegate across mount order.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if ((event.target as Element | null)?.closest?.('#restartTour')) start(true);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [start]);

  // The tour owns its own Escape; the dialog manager suspends while the
  // overlay is visible — same contract as the legacy controller.
  useEffect(() => {
    const onKeydown = (event: KeyboardEvent) => {
      if (indexRef.current < 0) return;
      if (event.key === 'Escape') {
        event.preventDefault?.();
        end(true);
      }
    };
    document.addEventListener('keydown', onKeydown);
    return () => document.removeEventListener('keydown', onKeydown);
  }, [end]);

  useEffect(() => {
    if (autoStart) start();
    return () => setMainInert(false);
  }, [autoStart, start]);

  if (!mounted) return null;

  const step = index >= 0 ? steps[index] : null;
  const prevDisabled = index < 0 || findVisible(steps, index - 1, -1) < 0;
  const isLast = index >= 0 && findVisible(steps, index + 1) < 0;

  return (
    <div
      id="tourOverlay"
      className="tour-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tourTitle"
      hidden={index < 0}
      data-step={index >= 0 ? index : undefined}
    >
      <div className="tour-card">
        <div className="tour-card__meta">
          <span id="tourProgress">
            {step ? t('tour.progress', { current: index + 1, total: steps.length }) : ''}
          </span>
          <button
            id="tourSkip"
            type="button"
            className="tour-icon"
            aria-label={t('tour.skip')}
            title={t('tour.skip')}
            onClick={() => end(true)}
          >
            <i className="fas fa-xmark" aria-hidden="true"></i>
          </button>
        </div>
        <h2 id="tourTitle">{step ? t(step.titleKey) : ''}</h2>
        <p id="tourBody">{step ? t(step.bodyKey) : ''}</p>
        <div className="tour-card__actions">
          <button
            id="tourPrevious"
            type="button"
            className="button secondary"
            disabled={prevDisabled}
            onClick={previous}
          >
            {t('tour.previous')}
          </button>
          <button id="tourNext" type="button" className="button primary" onClick={next}>
            {t(isLast ? 'tour.finish' : 'tour.next')}
          </button>
        </div>
      </div>
    </div>
  );
}

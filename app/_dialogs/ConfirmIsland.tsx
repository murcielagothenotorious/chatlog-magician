'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  normalizeConfirmConfig,
  resolveTranslator,
  type ConfirmBridgeFn,
  type ConfirmDialogRequest,
  type ConfirmDialogResult,
  type NormalizedConfirmConfig,
} from './confirm-dialog';

// window.__confirmDialog itself is declared in public/js/ui-utils.ts (single
// global owner — see the bridge-type note there); the alias below is a
// structural annotation for this island's implementation.
type WindowWithConfirmBridge = Window & { __confirmDialog?: ConfirmBridgeFn };

interface PendingRequest {
  config: NormalizedConfirmConfig;
  resolve: (value: ConfirmDialogResult) => void;
}

function cancelledValue(config: NormalizedConfirmConfig): ConfirmDialogResult {
  return config.isPrompt ? null : false;
}

// Static pre-request content, matching the carved-out legacy markup defaults.
// The dialog is closed until the first request, so this never shows.
const DEFAULT_CONFIG: NormalizedConfirmConfig = normalizeConfirmConfig(undefined, (_key, fb) => fb);

// React island that owns the legacy promise-based confirm/alert/prompt
// dialog. Legacy callers dispatch through window.__confirmDialog (see the
// window.show* shims in public/js/ui-utils.ts), installed on mount. The island
// renders the same native <dialog> with the same ids and classes, so the
// vanilla dialog-manager keeps composing unchanged: this id is exempt from
// its inert walks and its Escape routing suspends while any dialog[open]
// exists — the island registers no manager layer (no double trap).
export default function ConfirmIsland() {
  const [pending, setPendingState] = useState<PendingRequest | null>(null);
  const [inputValue, setInputValue] = useState('');
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const okRef = useRef<HTMLButtonElement | null>(null);
  const pendingRef = useRef<PendingRequest | null>(null);

  const setRequest = useCallback((next: PendingRequest | null) => {
    pendingRef.current = next;
    setPendingState(next);
  }, []);

  const settle = useCallback(
    (value: ConfirmDialogResult) => {
      const current = pendingRef.current;
      if (!current) return;
      setRequest(null);
      const dialog = dialogRef.current;
      if (dialog?.open) {
        try {
          dialog.close();
        } catch {
          // Already closed (e.g. settled from the close event itself).
        }
      }
      current.resolve(value);
    },
    [setRequest]
  );
  const settleRef = useRef(settle);
  settleRef.current = settle;

  // Install the legacy bridge. A new request supersedes a pending one,
  // settling it as cancelled — the legacy implementation closed the open
  // dialog first, which resolved the old promise through its close listener.
  useEffect(() => {
    const w = window as WindowWithConfirmBridge;
    const request: ConfirmBridgeFn = (options: ConfirmDialogRequest) =>
      new Promise<ConfirmDialogResult>((resolve) => {
        const previous = pendingRef.current;
        if (previous) {
          pendingRef.current = null;
          setPendingState(null);
          previous.resolve(cancelledValue(previous.config));
        }
        const config = normalizeConfirmConfig(options, resolveTranslator());
        setInputValue(config.promptValue);
        const next = { config, resolve };
        pendingRef.current = next;
        setPendingState(next);
      });
    w.__confirmDialog = request;
    return () => {
      const current = pendingRef.current;
      if (current) {
        pendingRef.current = null;
        setPendingState(null);
        current.resolve(cancelledValue(current.config));
      }
      if (w.__confirmDialog === request) delete w.__confirmDialog;
    };
  }, []);

  // Native cancel/close events do not bubble, so they are wired imperatively;
  // React root delegation cannot see them.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onCancel = (event: Event) => {
      event.preventDefault();
      const current = pendingRef.current;
      settleRef.current(current ? cancelledValue(current.config) : false);
    };
    const onClose = () => {
      const current = pendingRef.current;
      settleRef.current(current ? cancelledValue(current.config) : false);
    };
    dialog.addEventListener('cancel', onCancel);
    dialog.addEventListener('close', onClose);
    return () => {
      dialog.removeEventListener('cancel', onCancel);
      dialog.removeEventListener('close', onClose);
    };
  }, []);

  // Open the native dialog for each request (staying open across a supersede,
  // like the legacy close-then-show which resolved the old promise first).
  useEffect(() => {
    if (!pending) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    // Legacy parity: sibling modal overlays may have frozen this subtree.
    dialog.inert = false;
    dialog.removeAttribute('inert');
    for (const el of dialog.querySelectorAll('*')) {
      (el as HTMLElement).inert = false;
      el.removeAttribute('inert');
    }
    try {
      if (!dialog.open) dialog.showModal();
    } catch {
      settleRef.current(cancelledValue(pending.config));
      return;
    }
    if (pending.config.isPrompt) {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else {
      okRef.current?.focus();
    }
  }, [pending]);

  const config = pending?.config ?? DEFAULT_CONFIG;
  const matchUnmet = config.promptMatch != null && inputValue !== config.promptMatch;

  const handleOk = () => {
    if (matchUnmet) return;
    settleRef.current(config.isPrompt ? inputValue : true);
  };

  const handleCancel = () => {
    settleRef.current(cancelledValue(config));
  };

  // Backdrop clicks land on the dialog itself; the rect check keeps clicks on
  // the dialog box (padding area) from dismissing. Same math as legacy.
  const handleBackdropClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (event.target !== dialogRef.current) return;
    const rect = dialogRef.current?.getBoundingClientRect();
    if (!rect) return;
    const inside =
      rect.top <= event.clientY &&
      event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX &&
      event.clientX <= rect.left + rect.width;
    if (!inside) settleRef.current(cancelledValue(config));
  };

  return (
    <dialog
      id="appConfirmDialog"
      ref={dialogRef}
      className="local-dialog local-dialog--decision app-confirm-dialog"
      aria-labelledby="appConfirmTitle"
      onClick={handleBackdropClick}
    >
      <h2 id="appConfirmTitle">{config.title}</h2>
      <p id="appConfirmMessage">{config.message}</p>
      <div
        id="appConfirmPromptContainer"
        className="app-confirm-prompt"
        style={{ display: config.isPrompt ? 'block' : 'none' }}
      >
        <input
          type="text"
          id="appConfirmInput"
          ref={inputRef}
          className="app-confirm-input"
          autoComplete="off"
          spellCheck="false"
          value={inputValue}
          placeholder={config.promptPlaceholder}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              handleOk();
            }
          }}
        />
      </div>
      <div className="local-dialog__actions app-confirm-actions">
        <button
          id="appConfirmCancel"
          type="button"
          className="local-action"
          style={{ display: config.type === 'alert' ? 'none' : '' }}
          onClick={handleCancel}
        >
          {config.cancelText}
        </button>
        <button
          id="appConfirmOk"
          ref={okRef}
          type="button"
          className={
            config.danger
              ? 'local-action local-action--danger'
              : 'local-action local-action--primary'
          }
          disabled={matchUnmet}
          onClick={handleOk}
        >
          {config.confirmText}
        </button>
      </div>
    </dialog>
  );
}

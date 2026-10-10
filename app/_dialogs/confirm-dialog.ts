// Island-side contract for the legacy confirm/alert/prompt dialog API.
//
// Legacy callers keep using window.showConfirmDialog/showAlertDialog (thin
// shims in public/js/ui-utils.ts); those delegate to window.__confirmDialog,
// installed by ConfirmIsland on mount. This module owns the option shapes and
// the config normalization (destructive-title heuristics, i18n defaults),
// ported 1:1 from the retired ui-utils DOM implementation.

export type ConfirmDialogType = 'confirm' | 'alert' | 'prompt';

export interface ConfirmDialogOptions {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  prompt?: boolean;
  promptPlaceholder?: string;
  promptMatch?: string | null;
  promptValue?: string;
  type?: ConfirmDialogType;
}

export type ConfirmDialogRequest = string | ConfirmDialogOptions | null | undefined;

// confirm/alert resolve boolean; prompt resolves the input string, or null
// when dismissed (cancel, Escape, backdrop, close, supersede, unmount).
export type ConfirmDialogResult = boolean | string | null;

export interface NormalizedConfirmConfig {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  danger: boolean;
  prompt: boolean;
  promptPlaceholder: string;
  promptMatch: string | null;
  promptValue: string;
  type: ConfirmDialogType;
  isPrompt: boolean;
}

export type ConfirmBridgeFn = (options: ConfirmDialogRequest) => Promise<ConfirmDialogResult>;

// Legacy destructive heuristic, verbatim: Turkish + English delete/clear
// markers in either the string message or the object title/message.
const DESTRUCTIVE_PATTERN = /sil|clear|delete|kaldır/i;

export type Translator = (key: string, fallback: string) => string;

// Same lookup the legacy implementation used: the guidance i18n when the
// legacy bootstrap published it, else the global i18n, else the Turkish
// fallback. (Slice 4 retires the window singletons; until then the legacy
// engine stays the source of truth so locale switches keep working.)
export function resolveTranslator(): Translator {
  return (key, fallback) => {
    if (typeof window === 'undefined') return fallback;
    const scope = window as unknown as {
      ChatlogGuidance?: { i18n?: { t?: (key: string) => string } };
      i18n?: { t?: (key: string) => string };
    };
    return scope.ChatlogGuidance?.i18n?.t?.(key) || scope.i18n?.t?.(key) || fallback;
  };
}

function destructiveConfig(t: Translator) {
  return {
    title: t('dialog.destructiveTitle', 'İşlemi Onayla'),
    confirmText: t('ui.delete', 'Sil'),
  };
}

function plainConfig(t: Translator, type: ConfirmDialogType) {
  return {
    title: t('dialog.confirmTitle', 'Onay'),
    confirmText: type === 'alert' ? t('help.done', 'Tamam') : t('ui.confirm', 'Onayla'),
  };
}

export function normalizeConfirmConfig(
  options: ConfirmDialogRequest,
  t: Translator
): NormalizedConfirmConfig {
  if (typeof options === 'string') {
    const isDestructive = DESTRUCTIVE_PATTERN.test(options);
    const defaults = isDestructive ? destructiveConfig(t) : plainConfig(t, 'confirm');
    return {
      title: defaults.title,
      message: options,
      confirmText: defaults.confirmText,
      cancelText: t('ui.cancel', 'Vazgeç'),
      danger: isDestructive,
      prompt: false,
      promptPlaceholder: '',
      promptMatch: null,
      promptValue: '',
      type: 'confirm',
      isPrompt: false,
    };
  }

  if (options && typeof options === 'object') {
    const isDestructive = Boolean(
      options.danger ??
      (DESTRUCTIVE_PATTERN.test(options.message || '') ||
        DESTRUCTIVE_PATTERN.test(options.title || ''))
    );
    const type: ConfirmDialogType = options.type || (options.prompt ? 'prompt' : 'confirm');
    const defaults = isDestructive ? destructiveConfig(t) : plainConfig(t, type);
    const isPrompt = Boolean(options.prompt) || type === 'prompt';
    return {
      title: options.title || defaults.title,
      message: options.message || '',
      confirmText: options.confirmText || defaults.confirmText,
      cancelText: options.cancelText || t('ui.cancel', 'Vazgeç'),
      danger: isDestructive,
      prompt: Boolean(options.prompt),
      promptPlaceholder: options.promptPlaceholder || '',
      promptMatch: options.promptMatch || null,
      promptValue: options.promptValue || '',
      type,
      isPrompt,
    };
  }

  const defaults = plainConfig(t, 'confirm');
  return {
    title: defaults.title,
    message: '',
    confirmText: defaults.confirmText,
    cancelText: t('ui.cancel', 'Vazgeç'),
    danger: false,
    prompt: false,
    promptPlaceholder: '',
    promptMatch: null,
    promptValue: '',
    type: 'confirm',
    isPrompt: false,
  };
}

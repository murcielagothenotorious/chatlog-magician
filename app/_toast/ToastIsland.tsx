'use client';

import { useEffect, useState } from 'react';
import { Toasty } from '@cloudflare/kumo/components/toast';
import { toastManager } from './toast-manager';

type KumoToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

export interface KumoToastAction {
  label: string;
  onClick?: () => void;
}

export interface KumoToastRequest {
  title: string;
  icon?: string;
  description?: string;
  variant?: KumoToastVariant;
  timeout?: number;
  actions?: KumoToastAction[];
}

type KumoToastFn = {
  (title: string, icon?: string): void;
  (request: KumoToastRequest): void;
};

const LEGACY_TOAST_TIMEOUT_MS = 3500;

function variantForIcon(icon: string | undefined): KumoToastVariant {
  if (!icon) return 'default';
  if (/(xmark|circle-x|times-circle|ban|exclamation-circle)/.test(icon)) return 'error';
  if (/(triangle|exclamation|warn)/.test(icon)) return 'warning';
  if (/(check|download|copy|upload|save|floppy)/.test(icon)) return 'success';
  if (/(info|circle-info|bell)/.test(icon)) return 'info';
  return 'default';
}

export default function ToastIsland() {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const notify: KumoToastFn = (titleOrRequest: string | KumoToastRequest, icon?: string) => {
      const request: KumoToastRequest =
        typeof titleOrRequest === 'string' ? { title: titleOrRequest, icon } : titleOrRequest;
      toastManager.add({
        title: request.title,
        description: request.description,
        variant: request.variant ?? variantForIcon(request.icon),
        timeout: request.timeout ?? LEGACY_TOAST_TIMEOUT_MS,
        actions: request.actions?.map((action) => ({
          children: action.label,
          size: 'sm' as const,
          onClick: action.onClick,
        })),
      });
    };
    window.__kumoToast = notify;
    return () => {
      if (window.__kumoToast === notify) delete window.__kumoToast;
    };
  }, []);

  // data-mode lives on the island, not <html>: Kumo sets color-scheme
  // from it, and page-level dark would restyle every native input.
  return (
    <div id="kumoToastRoot" data-mode="dark" ref={setContainer}>
      {container ? (
        <Toasty toastManager={toastManager} container={container}>
          {null}
        </Toasty>
      ) : null}
    </div>
  );
}

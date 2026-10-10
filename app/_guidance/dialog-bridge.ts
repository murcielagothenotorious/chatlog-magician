// Bridge to the vanilla dialog-manager singleton owned by legacy bootstrap.
//
// The manager MUST stay a single browser-module instance (one shared Escape
// stack across legacy modals and islands), so islands never bundle it:
// init.ts publishes window.__dialogManager and dispatches
// cm:dialog-manager-ready once loaded. Tests inject a manager directly.

export interface DialogSession {
  release(): void;
}

export interface DialogBridgeManager {
  openModal(options: {
    element: Element;
    initialFocus?: Element | null;
    exemptIds?: string[];
    onEscape?: () => void;
  }): DialogSession;
  routeKeydown(event: { key?: string }): boolean;
}

export const DIALOG_MANAGER_READY_EVENT = 'cm:dialog-manager-ready';
const BRIDGE_TIMEOUT_MS = 3000;

function windowBridge(): DialogBridgeManager | null {
  if (typeof window === 'undefined') return null;
  const candidate = (window as unknown as { __dialogManager?: DialogBridgeManager })
    .__dialogManager;
  return candidate ?? null;
}

export function getDialogBridgeManager(
  injected?: DialogBridgeManager | null
): DialogBridgeManager | null {
  return injected ?? windowBridge();
}

export function waitForDialogBridgeManager(
  injected?: DialogBridgeManager | null,
  timeoutMs: number = BRIDGE_TIMEOUT_MS
): Promise<DialogBridgeManager | null> {
  const existing = getDialogBridgeManager(injected);
  if (existing || typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(existing);
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      document.removeEventListener(DIALOG_MANAGER_READY_EVENT, onReady);
      clearTimeout(timer);
      resolve(getDialogBridgeManager(injected));
    };
    const onReady = () => finish();
    const timer = setTimeout(finish, timeoutMs);
    document.addEventListener(DIALOG_MANAGER_READY_EVENT, onReady);
  });
}

// Shared modal-layer infrastructure for the legacy vanilla UI.
//
// Framework component libraries (shadcn, Kumo/Base/Hero UI) are React-based;
// mounting React islands per modal would bloat this server-rendered vanilla
// surface, so the proven community-modal pattern (ancestor-walk inert, focus
// trap, return-focus) lives here with zero dependencies. Visibility mechanics
// stay with each caller (hidden attribute or display style); the manager owns
// cross-modal behavior: one Escape closes exactly the topmost layer.
//
// Layer order, bottom to top: persistent layers (drawer, toolbar overflow) in
// registration order, then open modals in open order. Native <dialog> top-layer
// elements and the guided tour suspend routing and own their own keys.

export const DIALOG_FOCUSABLE_SELECTOR =
  'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

// Elements the background-inert walk must never freeze: native dialogs manage
// their own top layer, the app confirm dialog renders above modals, and the
// toast root must stay live while a modal is open.
const DEFAULT_EXEMPT_IDS = ['appConfirmDialog', 'kumoToastRoot'];

const managers = new WeakMap<object, any>();
const routedEvents = new WeakSet<object>();

function focusablesOf(element: any): any[] {
  const found = element?.querySelectorAll?.(DIALOG_FOCUSABLE_SELECTOR) ?? [];
  return [...found].filter((control) => !control?.disabled && !control?.hidden);
}

function trapTab(event: any, element: any, documentLike: any): boolean {
  const focusable = focusablesOf(element);
  if (focusable.length === 0) return false;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && documentLike?.activeElement === first) {
    event.preventDefault?.();
    last.focus?.();
    return true;
  }
  if (!event.shiftKey && documentLike?.activeElement === last) {
    event.preventDefault?.();
    first.focus?.();
    return true;
  }
  return false;
}

export function getDialogManager(documentLike: any = undefined) {
  if (documentLike && managers.has(documentLike)) return managers.get(documentLike);
  const modalStack: any[] = [];
  const persistentLayers: any[] = [];
  let suspendedPredicate: any = null;

  function nativeDialogOpen(): boolean {
    // `.open === true` (not just a truthy match) so stub querySelector fakes
    // in unit tests never trip this guard; only a genuinely open dialog does.
    const match = documentLike?.querySelector?.('dialog[open]');
    return Boolean(match && match.open === true);
  }

  function inertBackground(element: any, exemptIds: string[]): Map<any, boolean> {
    const inertState = new Map<any, boolean>();
    const exempt = new Set([...DEFAULT_EXEMPT_IDS, ...exemptIds]);
    // Walk from the modal up to <body>, inerting siblings at each level, so a
    // modal nested inside a wrapper div never freezes its own ancestor chain.
    let node = element;
    while (node && node !== documentLike?.body) {
      const parent = node.parentElement;
      if (!parent) break;
      for (const sibling of parent.children ?? []) {
        if (sibling === node || sibling?.tagName === 'DIALOG' || exempt.has(sibling?.id)) {
          continue;
        }
        inertState.set(sibling, Boolean(sibling.inert));
        sibling.inert = true;
      }
      node = parent;
    }
    return inertState;
  }

  function openModal({ element, initialFocus, exemptIds = [], onEscape }: any = {}): any {
    const existing = modalStack.find((entry) => entry.element === element);
    if (existing) {
      // Re-open of an already-open modal: keep one stack entry (matches the
      // old `if (modal.hidden)` inert guards) but move focus back inside.
      initialFocus?.focus?.();
      return existing.handle;
    }
    const entry: any = {
      element,
      onEscape,
      returnFocus: documentLike?.activeElement ?? null,
      inertState: inertBackground(element, exemptIds),
      handle: null,
    };
    entry.handle = {
      release() {
        const at = modalStack.indexOf(entry);
        if (at >= 0) modalStack.splice(at, 1);
        for (const [node, previous] of entry.inertState) {
          if (node) node.inert = previous;
        }
        entry.inertState.clear();
        entry.returnFocus?.focus?.();
        entry.returnFocus = null;
      },
    };
    modalStack.push(entry);
    initialFocus?.focus?.();
    return entry.handle;
  }

  function registerPersistentLayer({ id, isActive, onEscape }: any = {}): () => void {
    const layer = { id, isActive, onEscape };
    persistentLayers.push(layer);
    return () => {
      const at = persistentLayers.indexOf(layer);
      if (at >= 0) persistentLayers.splice(at, 1);
    };
  }

  function routeKeydown(event: any): boolean {
    if (!event || (event.key !== 'Escape' && event.key !== 'Tab')) return false;
    if (routedEvents.has(event)) return false;
    if (event.key === 'Tab') {
      const top = modalStack[modalStack.length - 1];
      if (!top) return false;
      if (!trapTab(event, top.element, documentLike)) return false;
      routedEvents.add(event);
      return true;
    }
    // Escape: the tour overlay and native dialogs sit above every managed
    // layer and consume the key through their own (mark-agnostic) listeners.
    // Still mark the event: delegates registered AFTER the tour's listener
    // would otherwise re-evaluate suspension after the tour already ended and
    // close a layer the same press must not reach.
    try {
      if (typeof suspendedPredicate === 'function' && suspendedPredicate()) {
        routedEvents.add(event);
        return false;
      }
    } catch {
      // A failing predicate must not swallow Escape.
    }
    if (nativeDialogOpen()) {
      routedEvents.add(event);
      return false;
    }
    const top = modalStack[modalStack.length - 1];
    if (top) {
      routedEvents.add(event);
      event.preventDefault?.();
      top.onEscape?.();
      return true;
    }
    for (let i = persistentLayers.length - 1; i >= 0; i -= 1) {
      let active = false;
      try {
        active = persistentLayers[i].isActive?.() === true;
      } catch {
        active = false;
      }
      if (!active) continue;
      routedEvents.add(event);
      event.preventDefault?.();
      persistentLayers[i].onEscape?.();
      return true;
    }
    return false;
  }

  const manager = {
    openModal,
    registerPersistentLayer,
    routeKeydown,
    setSuspendedPredicate(predicate: any) {
      suspendedPredicate = predicate;
    },
  };
  if (documentLike) managers.set(documentLike, manager);
  return manager;
}

import { describe, expect, it, vi } from 'vitest';

import { getDialogManager } from '../public/js/dialog-manager.ts';

class FakeElement {
  constructor(tagName = 'div', id = '') {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.hidden = false;
    this.disabled = false;
    this.inert = false;
    this.open = false;
    this.children = [];
    this.parentElement = null;
    this.focusables = [];
    this.focus = vi.fn(() => {
      this.ownerDocument.activeElement = this;
    });
  }

  append(...children) {
    for (const child of children) {
      this.children.push(child);
      child.parentElement = this;
    }
  }

  querySelectorAll() {
    return this.focusables;
  }
}

function keyEvent(key, extra = {}) {
  return { key, shiftKey: false, preventDefault: vi.fn(), ...extra };
}

function setup() {
  const document = {
    activeElement: null,
    body: new FakeElement('body', 'body'),
    openDialog: null,
    getElementById: () => null,
    querySelector: (selector) => (selector === 'dialog[open]' ? document.openDialog : null),
  };
  for (const node of [document.body]) node.ownerDocument = document;
  const opener = new FakeElement('button', 'opener');
  opener.ownerDocument = document;
  document.activeElement = opener;
  document.body.append(opener);
  return { document, opener };
}

function modalNode(document, id) {
  const modal = new FakeElement('div', id);
  modal.ownerDocument = document;
  const first = new FakeElement('button', `${id}-first`);
  const last = new FakeElement('button', `${id}-last`);
  first.ownerDocument = document;
  last.ownerDocument = document;
  modal.focusables = [first, last];
  document.body.append(modal);
  return { modal, first, last };
}

describe('dialog manager', () => {
  it('returns the same manager per document and isolates others', () => {
    const a = setup();
    const b = setup();
    expect(getDialogManager(a.document)).toBe(getDialogManager(a.document));
    expect(getDialogManager(a.document)).not.toBe(getDialogManager(b.document));
  });

  it('inerts siblings, focuses inside, and restores on release', () => {
    const { document, opener } = setup();
    const main = new FakeElement('main', 'main');
    main.ownerDocument = document;
    document.body.append(main);
    const { modal, first } = modalNode(document, 'help');
    const dialogs = getDialogManager(document);

    const session = dialogs.openModal({
      element: modal,
      initialFocus: first,
      onEscape: () => {},
    });

    expect(main.inert).toBe(true);
    expect(modal.inert).toBe(false);
    expect(first.focus).toHaveBeenCalled();

    session.release();
    expect(main.inert).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it('never inerts native dialogs, the confirm dialog, or the toast root', () => {
    const { document } = setup();
    const native = new FakeElement('dialog', 'imageStackDialog');
    const confirm = new FakeElement('dialog', 'appConfirmDialog');
    const toasts = new FakeElement('div', 'kumoToastRoot');
    for (const node of [native, confirm, toasts]) {
      node.ownerDocument = document;
      document.body.append(node);
    }
    const { modal } = modalNode(document, 'community');
    const dialogs = getDialogManager(document);

    const session = dialogs.openModal({ element: modal, onEscape: () => {} });
    expect(native.inert).toBe(false);
    expect(confirm.inert).toBe(false);
    expect(toasts.inert).toBe(false);
    session.release();
  });

  it('closes only the topmost modal per Escape', () => {
    const { document } = setup();
    const a = modalNode(document, 'a');
    const b = modalNode(document, 'b');
    const dialogs = getDialogManager(document);
    const onA = vi.fn();
    const onB = vi.fn();
    let sessionA;
    let sessionB;
    sessionA = dialogs.openModal({
      element: a.modal,
      onEscape: () => {
        onA();
        sessionA.release();
      },
    });
    sessionB = dialogs.openModal({
      element: b.modal,
      onEscape: () => {
        onB();
        sessionB.release();
      },
    });

    expect(dialogs.routeKeydown(keyEvent('Escape'))).toBe(true);
    expect(onB).toHaveBeenCalledTimes(1);
    expect(onA).not.toHaveBeenCalled();

    expect(dialogs.routeKeydown(keyEvent('Escape'))).toBe(true);
    expect(onA).toHaveBeenCalledTimes(1);
  });

  it('routes each event once across several delegating listeners', () => {
    const { document } = setup();
    const { modal } = modalNode(document, 'a');
    const dialogs = getDialogManager(document);
    const onEscape = vi.fn();
    dialogs.openModal({ element: modal, onEscape });

    const event = keyEvent('Escape');
    expect(dialogs.routeKeydown(event)).toBe(true);
    expect(dialogs.routeKeydown(event)).toBe(false);
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('dismisses persistent layers below modals, newest registration first', () => {
    const { document } = setup();
    const { modal } = modalNode(document, 'a');
    const dialogs = getDialogManager(document);
    const calls = [];
    const active = { changelog: true, overflow: true };
    dialogs.registerPersistentLayer({
      id: 'changelog',
      isActive: () => active.changelog,
      onEscape: () => {
        active.changelog = false;
        calls.push('changelog');
      },
    });
    dialogs.registerPersistentLayer({
      id: 'overflow',
      isActive: () => active.overflow,
      onEscape: () => {
        active.overflow = false;
        calls.push('overflow');
      },
    });
    let session;
    session = dialogs.openModal({
      element: modal,
      onEscape: () => {
        calls.push('modal');
        session.release();
      },
    });

    dialogs.routeKeydown(keyEvent('Escape'));
    dialogs.routeKeydown(keyEvent('Escape'));
    dialogs.routeKeydown(keyEvent('Escape'));
    expect(calls).toEqual(['modal', 'overflow', 'changelog']);
  });

  it('skips inactive persistent layers and supports unregister', () => {
    const { document } = setup();
    const dialogs = getDialogManager(document);
    const onEscape = vi.fn();
    let active = false;
    const unregister = dialogs.registerPersistentLayer({
      id: 'drawer',
      isActive: () => active,
      onEscape,
    });

    expect(dialogs.routeKeydown(keyEvent('Escape'))).toBe(false);
    active = true;
    expect(dialogs.routeKeydown(keyEvent('Escape'))).toBe(true);
    unregister();
    expect(dialogs.routeKeydown(keyEvent('Escape'))).toBe(false);
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('lets the tour and native dialogs own Escape while suspended', () => {
    const { document } = setup();
    const { modal } = modalNode(document, 'a');
    const dialogs = getDialogManager(document);
    const onEscape = vi.fn();
    dialogs.openModal({ element: modal, onEscape });
    dialogs.setSuspendedPredicate(() => true);

    expect(dialogs.routeKeydown(keyEvent('Escape'))).toBe(false);
    expect(onEscape).not.toHaveBeenCalled();

    dialogs.setSuspendedPredicate(null);
    const native = new FakeElement('dialog', 'cloudDialog');
    native.open = true;
    document.openDialog = native;
    expect(dialogs.routeKeydown(keyEvent('Escape'))).toBe(false);
    expect(onEscape).not.toHaveBeenCalled();

    document.openDialog = null;
    expect(dialogs.routeKeydown(keyEvent('Escape'))).toBe(true);
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('traps Tab inside the topmost modal', () => {
    const { document } = setup();
    const a = modalNode(document, 'a');
    const b = modalNode(document, 'b');
    const dialogs = getDialogManager(document);
    dialogs.openModal({ element: a.modal, onEscape: () => {} });
    dialogs.openModal({ element: b.modal, onEscape: () => {} });

    b.last.focus();
    const wrap = keyEvent('Tab');
    expect(dialogs.routeKeydown(wrap)).toBe(true);
    expect(wrap.preventDefault).toHaveBeenCalled();
    expect(document.activeElement).toBe(b.first);

    b.first.focus();
    const back = keyEvent('Tab', { shiftKey: true });
    expect(dialogs.routeKeydown(back)).toBe(true);
    expect(document.activeElement).toBe(b.last);

    const middle = keyEvent('Tab');
    a.first.focus();
    expect(dialogs.routeKeydown(middle)).toBe(false);
    expect(middle.preventDefault).not.toHaveBeenCalled();
  });

  it('dedupes re-open of the same modal into one stack entry', () => {
    const { document } = setup();
    const main = new FakeElement('main', 'main');
    main.ownerDocument = document;
    document.body.append(main);
    const { modal } = modalNode(document, 'a');
    const dialogs = getDialogManager(document);
    const first = dialogs.openModal({ element: modal, onEscape: () => {} });
    const second = dialogs.openModal({ element: modal, onEscape: () => {} });
    expect(second).toBe(first);

    first.release();
    expect(main.inert).toBe(false);
    expect(dialogs.routeKeydown(keyEvent('Escape'))).toBe(false);
  });

  it('marks suspended events so late delegates cannot double-close', () => {
    const { document } = setup();
    const dialogs = getDialogManager(document);
    const onEscape = vi.fn();
    let active = true;
    dialogs.registerPersistentLayer({ id: 'drawer', isActive: () => active, onEscape });
    let suspended = true;
    dialogs.setSuspendedPredicate(() => suspended);

    // First delegate routes while the tour is up: nothing closes.
    const event = keyEvent('Escape');
    expect(dialogs.routeKeydown(event)).toBe(false);
    expect(onEscape).not.toHaveBeenCalled();

    // The tour's own listener ends the tour; a delegate registered after it
    // re-routes the SAME event and must not close the layer below.
    suspended = false;
    expect(dialogs.routeKeydown(event)).toBe(false);
    expect(onEscape).not.toHaveBeenCalled();

    // A fresh press reaches the layer normally.
    expect(dialogs.routeKeydown(keyEvent('Escape'))).toBe(true);
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('ignores non-Escape/Tab keys', () => {
    const { document } = setup();
    const { modal } = modalNode(document, 'a');
    const dialogs = getDialogManager(document);
    const onEscape = vi.fn();
    dialogs.openModal({ element: modal, onEscape });
    expect(dialogs.routeKeydown(keyEvent('Enter'))).toBe(false);
    expect(onEscape).not.toHaveBeenCalled();
  });
});

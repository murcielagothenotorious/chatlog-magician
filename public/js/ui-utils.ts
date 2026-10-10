interface Window {
  showToast?: any;
  showConfirmDialog?: any;
  showAlertDialog?: any;
  closeInfoBox?: any;
  // Canonical __kumoToast bridge type (single global owner: this file is
  // bundled by scripts/bundle-legacy.ts and compiled by tsconfig.json, while
  // app/_toast/ToastIsland.tsx is only in the former — declaring it there
  // as well breaks one program or the other).
  __kumoToast?: {
    (title: string, icon?: string): void;
    (request: {
      title: string;
      icon?: string;
      description?: string;
      variant?: 'default' | 'success' | 'error' | 'warning' | 'info';
      timeout?: number;
      actions?: Array<{ label: string; onClick?: () => void }>;
    }): void;
  };
  // Canonical __confirmDialog bridge type (same single-owner rule as
  // __kumoToast above: declare only here, never in the island).
  __confirmDialog?: (options: any) => Promise<any>;
  ChatlogGuidance?: any;
  i18n?: any;
}

/** UI utilities: toast notifications, support nudge, and DOM listeners. */
(function () {
  'use strict';
  /* ── 1. Toast Notification Logic ── */
  // Delegates to the Kumo Toast island (app/_toast/ToastIsland.tsx), which
  // installs window.__kumoToast on mount. Falls back to silence when the
  // island is not ready yet (same graceful degradation the old #cmToast
  // lookup had when its markup was absent).
  function showToast(msg, icon) {
    const defaultMsg =
      window.ChatlogGuidance?.i18n?.t('toast.copied') ||
      window.i18n?.t('toast.copied') ||
      'Panoya kopyalandı';
    if (typeof window.__kumoToast === 'function') {
      window.__kumoToast(msg || defaultMsg, icon);
    }
  }
  window.showToast = showToast;

  /* ── 2. Application Confirm & Alert Modal Logic ── */
  // Thin shims: the ConfirmIsland (app/_dialogs/ConfirmIsland.tsx) owns the
  // dialog rendering and installs window.__confirmDialog on mount. Before the
  // island mounts, fall back to native dialogs (the same last-resort shapes
  // the old implementation used when <dialog> was unsupported) so no caller
  // ever hangs on an unsettled promise.
  function showConfirmDialog(options) {
    if (typeof window.__confirmDialog === 'function') {
      return window.__confirmDialog(options);
    }
    const type =
      options && typeof options === 'object'
        ? options.type || (options.prompt ? 'prompt' : 'confirm')
        : 'confirm';
    const message = typeof options === 'string' ? options : options?.message || '';
    try {
      if (type === 'alert') {
        window.alert(message);
        return Promise.resolve(true);
      }
      if (type === 'prompt' || (options && options.prompt)) {
        return Promise.resolve(window.prompt(message, options.promptValue || ''));
      }
      return Promise.resolve(window.confirm(message));
    } catch {
      return Promise.resolve(true);
    }
  }
  window.showConfirmDialog = showConfirmDialog;
  window.showAlertDialog = function (message, title) {
    return showConfirmDialog({
      type: 'alert',
      title: title || 'Bilgilendirme',
      message,
      confirmText: 'Tamam',
    });
  };

  /* ── 2. Support Nudge ── */
  const SUPPORT_FORUM_URL = 'https://forum-tr.gta.world/index.php?/topic/27368-chatlog-magician/';
  const NudgeSystem = (function () {
    var sessionFirstExport = false;

    function showNudgeToast() {
      // The Kumo island owns the notification viewport now; silence before
      // mount matches the old absent-markup degradation.
      if (typeof window.__kumoToast !== 'function') return;
      window.__kumoToast({
        title: 'Chatlog Magician işinize yarıyor mu?',
        description: 'Bir beğeni veya yorum bırakarak destek olabilirsiniz.',
        variant: 'info',
        timeout: 8000,
        actions: [
          {
            label: 'Tanıtıma',
            onClick: () => window.open(SUPPORT_FORUM_URL, '_blank', 'noopener,noreferrer'),
          },
        ],
      });
    }

    return {
      onExport: function () {
        if (sessionFirstExport) return;
        sessionFirstExport = true;
        showNudgeToast();
      },
    };
  })();

  /* ── 4. Info Box Persistence ── */
  const INFO_BOX_KEY = 'cm_infobox_closed';

  window.closeInfoBox = function () {
    var el = document.getElementById('infoBox');
    if (el) el.style.display = 'none';
    localStorage.setItem(INFO_BOX_KEY, '1');
  };

  function initInfoBox() {
    if (localStorage.getItem(INFO_BOX_KEY)) {
      var el = document.getElementById('infoBox');
      if (el) el.style.display = 'none';
    }
  }

  /* ── 5. Main Initialization ── */
  document.addEventListener('DOMContentLoaded', function () {
    var copyBtn = document.getElementById('copyOutputImage');
    var dlBtn = document.getElementById('downloadOutputTransparent');
    if (copyBtn) copyBtn.addEventListener('click', () => setTimeout(NudgeSystem.onExport, 3500));
    if (dlBtn) dlBtn.addEventListener('click', () => setTimeout(NudgeSystem.onExport, 3500));

    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        const text =
          window.ChatlogGuidance?.i18n?.t('toast.copiedHint') ||
          window.i18n?.t('toast.copiedHint') ||
          'Kopyalandı — CTRL+V ile yapıştır';
        setTimeout(() => showToast(text, 'fa-check-circle'), 300);
      });
    }
    if (dlBtn) {
      dlBtn.addEventListener('click', function () {
        const text =
          window.ChatlogGuidance?.i18n?.t('toast.downloading') ||
          window.i18n?.t('toast.downloading') ||
          'Görsel indiriliyor...';
        setTimeout(() => showToast(text, 'fa-download'), 200);
      });
    }

    var SEEN_KEY = 'cm_changelog_seen_v2_1_0';
    var badge = document.getElementById('changelogBadge');
    var openChangelogBtn = document.getElementById('openChangelogBtn');
    var closeChangelogModal = document.getElementById('closeChangelogModal');
    if (badge && !localStorage.getItem(SEEN_KEY)) {
      badge.style.display = 'block';
    }
    function markChangelogSeen() {
      localStorage.setItem(SEEN_KEY, '1');
      if (badge) badge.style.display = 'none';
      var drawer = document.getElementById('changelogDrawer');
      if (drawer) drawer.classList.remove('open');
    }
    if (openChangelogBtn) openChangelogBtn.addEventListener('click', markChangelogSeen);
    if (closeChangelogModal) closeChangelogModal.addEventListener('click', markChangelogSeen);

    initInfoBox();

    var floatingBtn = document.getElementById('floatingSysMsgToggle');
    var drawer = document.getElementById('changelogDrawer');
    var historyPanel = document.getElementById('historyPanel');
    function syncFloating() {
      if (!floatingBtn || !floatingBtn.classList.contains('floating-sys-btn')) return;
      var hidden =
        (drawer && drawer.classList.contains('open')) ||
        (historyPanel && historyPanel.classList.contains('open'));
      floatingBtn.style.transition = 'opacity 0.2s';
      floatingBtn.style.opacity = hidden ? '0' : '';
      floatingBtn.style.pointerEvents = hidden ? 'none' : '';
    }
    if (drawer)
      new MutationObserver(syncFloating).observe(drawer, {
        attributes: true,
        attributeFilter: ['class'],
      });
    if (historyPanel)
      new MutationObserver(syncFloating).observe(historyPanel, {
        attributes: true,
        attributeFilter: ['class'],
      });
  });
})();

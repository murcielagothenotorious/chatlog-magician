interface Window {
  ColorPalette?: any;
  toggleHistoryPanel?: any;
  ChatlogFeedback?: any;
  ChatlogLocal?: any;
  ChatlogGuidance?: any;
  i18n?: any;
  showConfirmDialog?: any;
  __dialogManager?: any;
}

document.addEventListener('DOMContentLoaded', function () {
  const initPalette = () => {
    if (
      typeof window.ColorPalette !== 'undefined' &&
      typeof window.ColorPalette.init === 'function'
    ) {
      window.ColorPalette.init();
    }
  };
  if (typeof window.ColorPalette === 'undefined') {
    setTimeout(initPalette, 100);
  } else {
    initPalette();
  }

  const historyTab = document.querySelector('.history-tab');
  if (historyTab) {
    const handler = () => {
      if (typeof window.toggleHistoryPanel === 'function') {
        window.toggleHistoryPanel();
      }
    };
    historyTab.addEventListener('click', handler);
  }

  document.querySelectorAll('dialog').forEach((dialog) => {
    if (dialog.id === 'recoveryDialog' || dialog.id === 'appConfirmDialog') return;
    dialog.addEventListener('click', (e) => {
      if (e.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const inside =
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.left + rect.width;
      if (!inside) {
        dialog.close();
      }
    });
  });

  // Shared modal-layer manager (loaded async below; classic scripts cannot
  // statically import it). Null until ready; Escape falls back to the legacy
  // branch in the keydown listener meanwhile.
  let dialogManager: any = null;
  let featuresSession: any = null;

  // ── Features modal ───────────────────────────────────────────────────────────
  const featuresModal = document.getElementById('featuresModal');
  const openFeaturesBtn = document.getElementById('openFeaturesBtn');
  const closeFeaturesModal = document.getElementById('closeFeaturesModal');
  const closeFeaturesBtn = document.getElementById('closeFeaturesBtn');
  const featuresBackdrop = document.getElementById('featuresBackdrop');

  function showFeaturesModal() {
    if (featuresModal) {
      featuresModal.style.display = 'flex';
      featuresModal.querySelectorAll('video').forEach((v) => v.play().catch(() => {}));
      featuresSession = dialogManager?.openModal({
        element: featuresModal,
        initialFocus: closeFeaturesBtn,
        onEscape: () => hideFeaturesModal(),
      });
    }
  }
  function hideFeaturesModal() {
    featuresSession?.release?.();
    featuresSession = null;
    if (featuresModal) {
      featuresModal.style.display = 'none';
      featuresModal.querySelectorAll('video').forEach((v) => {
        v.pause();
        v.currentTime = 0;
      });
    }
  }
  if (openFeaturesBtn) openFeaturesBtn.addEventListener('click', showFeaturesModal);
  if (closeFeaturesModal) closeFeaturesModal.addEventListener('click', hideFeaturesModal);
  if (closeFeaturesBtn) closeFeaturesBtn.addEventListener('click', hideFeaturesModal);
  if (featuresBackdrop) featuresBackdrop.addEventListener('click', hideFeaturesModal);

  // ── Compact changelog popover ────────────────────────────────────────────────
  const changelogDrawer = document.getElementById('changelogDrawer');
  const openChangelogBtn = document.getElementById('openChangelogBtn');
  const closeChangelogModal = document.getElementById('closeChangelogModal');

  function showChangelogModal() {
    if (changelogDrawer) changelogDrawer.classList.add('open');
    if (openChangelogBtn) openChangelogBtn.setAttribute('aria-expanded', 'true');
  }
  function isTourOverlayActive() {
    const overlay = document.getElementById('tourOverlay');
    return Boolean(overlay && !overlay.hidden);
  }
  function hideChangelogModal() {
    if (changelogDrawer) changelogDrawer.classList.remove('open');
    if (openChangelogBtn) openChangelogBtn.setAttribute('aria-expanded', 'false');
    try {
      localStorage.setItem('cm_changelog_seen_v2_1_1', '1');
    } catch (_) {
      /* storage unavailable */
    }
  }
  if (openChangelogBtn) openChangelogBtn.addEventListener('click', showChangelogModal);
  if (closeChangelogModal) {
    closeChangelogModal.addEventListener('click', () => {
      hideChangelogModal();
      openChangelogBtn?.focus();
    });
  }
  const toolbarOverflow: any = document.querySelector('.toolbar-overflow');
  toolbarOverflow?.addEventListener('click', (event: any) => {
    if (event.target.closest('.toolbar-overflow__panel button')) {
      toolbarOverflow.removeAttribute('open');
    }
  });
  document.addEventListener('pointerdown', (event: any) => {
    if (toolbarOverflow?.open && !toolbarOverflow.contains(event.target)) {
      toolbarOverflow.removeAttribute('open');
    }
    if (
      !isTourOverlayActive() &&
      changelogDrawer?.classList.contains('open') &&
      !changelogDrawer.contains(event.target)
    ) {
      hideChangelogModal();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (dialogManager) {
      dialogManager.routeKeydown(event);
      return;
    }
    toolbarOverflow?.removeAttribute('open');
    if (isTourOverlayActive()) return;
    if (!changelogDrawer?.classList.contains('open')) return;
    hideChangelogModal();
    openChangelogBtn?.focus();
  });

  import('./dialog-manager.js')
    .then(({ getDialogManager }) => {
      dialogManager = getDialogManager(document);
      // Publish the singleton for React islands (same module instance, one
      // shared Escape stack) and wake any island waiting on it.
      window.__dialogManager = dialogManager;
      document.dispatchEvent(new CustomEvent('cm:dialog-manager-ready'));
      dialogManager.setSuspendedPredicate(isTourOverlayActive);
      // Persistent (non-modal) layers live below modals; the transient
      // toolbar overflow dismisses before the changelog drawer.
      dialogManager.registerPersistentLayer({
        id: 'changelog',
        isActive: () => changelogDrawer?.classList.contains('open') === true,
        onEscape: () => {
          hideChangelogModal();
          openChangelogBtn?.focus();
        },
      });
      dialogManager.registerPersistentLayer({
        id: 'toolbar-overflow',
        isActive: () => Boolean(toolbarOverflow?.open),
        onEscape: () => toolbarOverflow?.removeAttribute('open'),
      });
    })
    .catch(() => {
      /* dialog-manager failed to load; the legacy Escape branch above stays in effect */
    });

  try {
    if (!localStorage.getItem('cm_changelog_seen_v2_1_1')) {
      showChangelogModal();
    }
  } catch (_) {
    /* storage unavailable */
  }

  // Help + tour now live in React islands (app/_guidance); the legacy engine
  // stays only for locale storage, the selector, and cm:locale-changed.
  Promise.all([import('./i18n.js')])
    .then(([{ createI18n }]) => {
      const i18n = createI18n({
        storage: window.localStorage,
        navigatorLanguage: navigator.language || 'tr',
        document,
      } as any);
      window.ChatlogGuidance = { i18n };
      window.i18n = i18n;

      const localeSelect: any = document.getElementById('localeSelect');
      if (localeSelect) {
        localeSelect.value = i18n.storedLocale();
        localeSelect.addEventListener('change', (e: any) => {
          i18n.setLocale(e.target.value);
        });
        i18n.subscribe((loc) => {
          localeSelect.value = i18n.storedLocale();
          document.dispatchEvent(new CustomEvent('cm:locale-changed', { detail: loc }));
        });
      }

      document.dispatchEvent(new CustomEvent('cm:locale-changed', { detail: i18n.locale() }));

      window.addEventListener(
        'pagehide',
        () => {
          i18n.destroy();
        },
        { once: true }
      );
    })
    .catch(() => document.getElementById('localeSelect')?.setAttribute('disabled', ''));

  import('./feedback-client.js')
    .then(({ initializeFeedbackController }) => {
      window.ChatlogFeedback = initializeFeedbackController(window, document);
    })
    .catch(() => document.getElementById('submitFeedbackBtn')?.setAttribute('disabled', ''));

  import('./community-controller.js')
    .then(({ initializeCommunityController }) => initializeCommunityController(window, document))
    .catch((error) => console.warn('Community gallery initialization failed', error));

});

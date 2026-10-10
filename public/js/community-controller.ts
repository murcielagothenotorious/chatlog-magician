import { renderProjectState } from './project-state-bridge.js';
import {
  COMMUNITY_PRESET_SCHEMA_VERSION,
  createPresetProjectPatch,
  extractCommunityPreset,
  validateCommunityPreset,
} from './community-preset-contract.js';
import { getDialogManager } from './dialog-manager.js';

const DISCLOSURE =
  'Yalnızca görünüm ve yerleşim ayarları kaydedilir. Sohbet metni, görseller ve özel fontlar presetinize dahil edilmez. Kaydetmek istiyor musunuz?';
const MAX_GALLERY_PRESETS = 100;

function escapeXml(unsafe = '') {
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function generatePreviewSvgUri(title = '', appearance: any = {}) {
  const font = appearance?.chat?.fontId || 'sans-serif';
  const bg = appearance?.canvas?.backgroundColor || '#15161a';
  const size = Math.max(10, Math.min(16, appearance?.chat?.fontSize || 12));
  const safeTitle = escapeXml(title || 'Preset');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">` +
    `<rect width="320" height="180" fill="${bg}"/>` +
    `<g transform="translate(16, 22)" font-family="${font}, Arial, sans-serif" font-size="${size}">` +
    `<text y="18" fill="#ffffff" font-weight="600">John Doe: Selam millet!</text>` +
    `<text y="38" fill="#c2a3da">* Sarah Smith tezgaha doğru yürür.</text>` +
    `<text y="58" fill="#56d64b">[BİLGİ] İşlem başarıyla tamamlandı.</text>` +
    `<text y="78" fill="#ffec8b">** [S:1 | CH: BASE] John Doe: Merhaba Dünya!</text>` +
    `</g>` +
    `<rect x="0" y="148" width="320" height="32" fill="rgba(0,0,0,0.55)"/>` +
    `<text x="12" y="169" fill="#8b8e98" font-family="sans-serif" font-size="11">${safeTitle}</text>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const BUILT_IN_PRESETS = Object.freeze([
  {
    id: 'builtin-gtaw-standard',
    title: 'GTAW Standart',
    description:
      'Klasik GTA World sohbet görünümü: 13px Arial, yüksek kontrast ve temiz kenar boşlukları.',
    isCustom: false,
    publishedAt: '2026-01-01T00:00:00.000Z',
    previewUrl: generatePreviewSvgUri('GTAW Standart', {
      chat: { fontId: 'Arial', fontSize: 13 },
      canvas: { backgroundColor: '#000000' },
    }),
    appearance: {
      chat: {
        fontId: 'Arial',
        fontSize: 13,
        lineHeight: 1.25,
        contrast: 'high',
        censorMode: 'blur',
        showSystemMessages: true,
      },
      canvas: {
        width: 1280,
        height: 720,
        backgroundColor: '#000000',
      },
      blockLayout: [
        {
          x: 30,
          y: 30,
          width: 620,
          height: 380,
          opacity: 1,
          composition: 'inset',
          paddingX: 20,
          paddingY: 20,
        },
      ],
    },
  },
  {
    id: 'builtin-compact-cinema',
    title: 'Kompakt Sinematik',
    description:
      'Ekran görüntüsü ve video kesitleri için 11px sıkı satır aralıklı, düşük alan kaplayan sinematik stil.',
    isCustom: false,
    publishedAt: '2026-01-01T00:00:00.000Z',
    previewUrl: generatePreviewSvgUri('Kompakt Sinematik', {
      chat: { fontId: 'Arial', fontSize: 11 },
      canvas: { backgroundColor: '#050505' },
    }),
    appearance: {
      chat: {
        fontId: 'Arial',
        fontSize: 11,
        lineHeight: 1.15,
        contrast: 'high',
        censorMode: 'remove',
        showSystemMessages: false,
      },
      canvas: {
        width: 1920,
        height: 1080,
        backgroundColor: '#050505',
      },
      blockLayout: [
        {
          x: 40,
          y: 40,
          width: 540,
          height: 300,
          opacity: 0.9,
          composition: 'inset',
          paddingX: 16,
          paddingY: 16,
        },
      ],
    },
  },
  {
    id: 'builtin-bold-scene',
    title: 'Vurgulu Sahne',
    description:
      'Okunabilirliği artıran 14px Trebuchet MS ve hafif gölgeli koyu tonlu sahne tasarımı.',
    isCustom: false,
    publishedAt: '2026-01-01T00:00:00.000Z',
    previewUrl: generatePreviewSvgUri('Vurgulu Sahne', {
      chat: { fontId: 'Trebuchet MS', fontSize: 14 },
      canvas: { backgroundColor: '#101114' },
    }),
    appearance: {
      chat: {
        fontId: 'Trebuchet MS',
        fontSize: 14,
        lineHeight: 1.35,
        contrast: 'medium',
        censorMode: 'blur',
        showSystemMessages: true,
      },
      canvas: {
        width: 1280,
        height: 720,
        backgroundColor: '#101114',
      },
      blockLayout: [
        {
          x: 35,
          y: 35,
          width: 650,
          height: 420,
          opacity: 0.95,
          composition: 'inset',
          paddingX: 24,
          paddingY: 24,
        },
      ],
    },
  },
]);

export function createLocalPresetClient({ storage = globalThis.localStorage }: any = {}) {
  const STORAGE_KEY = 'cm_local_presets_v1';

  function readCustomPresets() {
    if (!storage) return [];
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return [];
      return list;
    } catch {
      return [];
    }
  }

  function writeCustomPresets(list) {
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      // Ignore storage quota errors
    }
  }

  return {
    isLocal: true,
    async capabilities() {
      return { available: true };
    },
    async list({ query = '' }: any = {}) {
      const custom = readCustomPresets();
      const all = [...custom, ...BUILT_IN_PRESETS];
      const q = String(query).toLowerCase().trim();
      const filtered = q
        ? all.filter(
            (p) =>
              p.title.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q)
          )
        : all;
      return {
        presets: filtered.slice(0, MAX_GALLERY_PRESETS),
        nextCursor: null,
      };
    },
    async get(id) {
      const custom = readCustomPresets();
      const found = [...custom, ...BUILT_IN_PRESETS].find((p) => p.id === id);
      if (!found) {
        throw new Error('Preset bulunamadı.');
      }
      return found;
    },
    async submit(preset) {
      const custom = readCustomPresets();
      const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newPreset = {
        id,
        title: preset.title,
        description: preset.description || '',
        appearance: preset.appearance,
        previewUrl: generatePreviewSvgUri(preset.title, preset.appearance),
        publishedAt: new Date().toISOString(),
        isCustom: true,
      };
      custom.unshift(newPreset);
      writeCustomPresets(custom);
      return { id, status: 'saved' };
    },
    async delete(id) {
      const custom = readCustomPresets();
      const filtered = custom.filter((p) => p.id !== id);
      writeCustomPresets(filtered);
      return { id, status: 'deleted' };
    },
  };
}

function presetEnvelope(preset) {
  return {
    schemaVersion: COMMUNITY_PRESET_SCHEMA_VERSION,
    title: preset.title,
    description: preset.description,
    appearance: preset.appearance,
  };
}

function replaceDraft(draft, snapshot) {
  for (const key of Object.keys(draft)) delete draft[key];
  Object.assign(draft, globalThis.structuredClone(snapshot));
}

export function createCommunityController({
  client,
  projectController,
  getProject,
  document: documentLike,
  confirm = () => true,
  renderProject = () => {},
}: any = {}) {
  if (
    !client ||
    typeof projectController?.commit !== 'function' ||
    typeof projectController?.undo !== 'function' ||
    typeof getProject !== 'function'
  ) {
    throw new TypeError('Community controller dependencies are incomplete');
  }
  const byId = new Map();
  const order = [];
  const cleanups = [];
  const t = (key, vars = {}, fallback = '') => {
    const i18n = (globalThis as any).ChatlogGuidance?.i18n || (globalThis as any).i18n;
    if (i18n && typeof i18n.t === 'function') {
      return i18n.t(key, vars);
    }
    return fallback;
  };
  let initialized = false;
  let destroyed = false;
  let activeRequest = null;
  let activeLoadMore = null;
  let requestGeneration = 0;
  let nextCursor = null;
  let currentQuery = '';
  let selectedId = null;
  let offline = false;
  let modalSession: any = null;
  const dialogs = getDialogManager(documentLike);

  const element = (id) => documentLike.getElementById(id);
  const modal = element('communityModal');
  const status = element('communityStatus');
  const grid = element('communityGrid');
  const loadMoreButton = element('communityLoadMore');
  const submitButton = element('communitySubmit');
  const searchInput = element('communitySearchInput');

  function listen(target, type, listener) {
    if (!target) return;
    target.addEventListener(type, listener);
    cleanups.push(() => target.removeEventListener(type, listener));
  }

  function setStatus(message, state = 'idle') {
    if (!status) return;
    status.textContent = message;
    status.dataset.state = state;
  }

  function setOffline(error) {
    offline = true;
    setStatus(
      error?.code === 'community_unavailable'
        ? 'Topluluk galerisi şu anda kullanılamıyor. Kayıtlı presetler uygulanabilir.'
        : 'Topluluk galerisi çevrimdışı. Yerel düzenleme etkilenmedi.',
      'offline'
    );
    if (submitButton) submitButton.disabled = true;
    if (loadMoreButton) loadMoreButton.hidden = true;
  }

  function setOnline() {
    offline = false;
    if (submitButton) submitButton.disabled = false;
  }

  function createButton(label, iconClass, action, extraClass = '') {
    const button = documentLike.createElement('button');
    button.type = 'button';
    button.className = `community-card__action${extraClass ? ` ${extraClass}` : ''}`;
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    const icon = documentLike.createElement('i');
    icon.className = iconClass;
    icon.setAttribute('aria-hidden', 'true');
    const text = documentLike.createElement('span');
    text.textContent = label;
    button.append(icon, text);
    button.addEventListener('click', action);
    return button;
  }

  function renderCards() {
    if (!grid) return;
    const cards = order.map((id) => {
      const preset = byId.get(id);
      const card = documentLike.createElement('article');
      card.className = 'community-card';
      card.dataset.presetId = id;

      const image = documentLike.createElement('img');
      image.className = 'community-card__preview';
      image.src = preset.previewUrl;
      image.alt = `${preset.title} preset önizlemesi`;
      image.loading = 'lazy';
      image.addEventListener('error', () => {
        image.hidden = true;
        fallback.hidden = false;
      });

      const fallback = documentLike.createElement('div');
      fallback.className = 'community-card__fallback';
      fallback.textContent = t('presets.fallbackPreview', {}, 'Önizleme kullanılamıyor');
      fallback.hidden = true;

      const heading = documentLike.createElement('h3');
      heading.textContent = preset.title;
      const description = documentLike.createElement('p');
      description.textContent =
        preset.description || t('presets.noDescription', {}, 'Açıklama yok');
      const actions = documentLike.createElement('div');
      actions.className = 'community-card__actions';

      const applyBtn = createButton(
        t('presets.apply', {}, 'Uygula'),
        'fas fa-wand-magic-sparkles',
        () => void apply(id),
        'community-card__action--primary'
      );

      const secondaryActions = documentLike.createElement('div');
      secondaryActions.className = 'community-card__secondary-actions';
      secondaryActions.append(
        createButton(t('presets.preview', {}, 'Önizle'), 'fas fa-eye', () => void preview(id)),
        createButton(t('presets.share', {}, 'Paylaş'), 'fas fa-share-nodes', () => void share(id)),
        createButton(t('presets.download', {}, 'İndir'), 'fas fa-download', () => void download(id))
      );
      if (preset.isCustom) {
        secondaryActions.append(
          createButton(
            t('presets.delete', {}, 'Sil'),
            'fas fa-trash',
            () => void deletePreset(id),
            'community-card__action--danger'
          )
        );
      }
      actions.append(applyBtn, secondaryActions);
      card.append(image, fallback, heading, description, actions);
      return card;
    });
    grid.replaceChildren(...cards);
    if (loadMoreButton) loadMoreButton.hidden = !nextCursor || offline;
  }

  function mergePresets(presets, reset) {
    if (reset) {
      byId.clear();
      order.length = 0;
    }
    for (const preset of presets) {
      if (order.length >= MAX_GALLERY_PRESETS) break;
      if (!preset?.id || byId.has(preset.id)) continue;
      byId.set(preset.id, preset);
      order.push(preset.id);
    }
    if (order.length >= MAX_GALLERY_PRESETS) nextCursor = null;
    renderCards();
  }

  async function search(query = searchInput?.value ?? '') {
    if (destroyed) return null;
    const generation = ++requestGeneration;
    activeRequest?.abort();
    activeLoadMore?.abort();
    activeLoadMore = null;
    const request = new AbortController();
    activeRequest = request;
    currentQuery = String(query).trim();
    setStatus('Presetler yükleniyor…', 'loading');
    try {
      const result = await client.list({ query: currentQuery, signal: request.signal });
      if (
        destroyed ||
        request.signal.aborted ||
        activeRequest !== request ||
        generation !== requestGeneration
      )
        return null;
      setOnline();
      nextCursor = result.nextCursor;
      mergePresets(result.presets, true);
      setStatus(
        order.length ? `${order.length} preset gösteriliyor.` : 'Eşleşen preset yok.',
        'ready'
      );
      return result;
    } catch (error) {
      if (request.signal.aborted || error?.code === 'request_cancelled') return null;
      setOffline(error);
      return null;
    } finally {
      if (activeRequest === request) activeRequest = null;
    }
  }

  async function loadMore() {
    if (!nextCursor || offline || destroyed || activeLoadMore) return null;
    const cursor = nextCursor;
    const query = currentQuery;
    const generation = requestGeneration;
    const request = new AbortController();
    activeLoadMore = request;
    if (loadMoreButton) loadMoreButton.disabled = true;
    setStatus('Daha fazla preset yükleniyor…', 'loading');
    try {
      const result = await client.list({ query, cursor, signal: request.signal });
      if (
        destroyed ||
        request.signal.aborted ||
        generation !== requestGeneration ||
        query !== currentQuery ||
        cursor !== nextCursor
      )
        return null;
      nextCursor = result.nextCursor;
      mergePresets(result.presets, false);
      setStatus(`${order.length} preset gösteriliyor.`, 'ready');
      return result;
    } catch (error) {
      if (request.signal.aborted || error?.code === 'request_cancelled') return null;
      setOffline(error);
      return null;
    } finally {
      if (activeLoadMore === request) activeLoadMore = null;
      if (loadMoreButton) loadMoreButton.disabled = false;
    }
  }

  async function findPreset(id) {
    if (byId.has(id)) return byId.get(id);
    const preset = await client.get(id);
    byId.set(id, preset);
    if (!order.includes(id)) order.push(id);
    return preset;
  }

  async function preview(id) {
    const preset = await findPreset(id);
    selectedId = id;
    const panel = element('communityPreview');
    const image = element('communityPreviewImage');
    const fallback = element('communityPreviewFallback');
    if (panel) panel.hidden = false;
    if (image) {
      image.hidden = false;
      image.src = preset.previewUrl;
      image.alt = `${preset.title} preset önizlemesi`;
    }
    if (fallback) fallback.hidden = true;
    const title = element('communityPreviewTitle');
    const description = element('communityPreviewDescription');
    if (title) title.textContent = preset.title;
    if (description) description.textContent = preset.description || 'Açıklama yok';
    return preset;
  }

  async function apply(id = selectedId) {
    const preset = await findPreset(id);
    const before = getProject();
    const after = createPresetProjectPatch(before, presetEnvelope(preset));
    const committed = projectController.commit((draft) => replaceDraft(draft, after));
    try {
      await renderProject(committed);
      setStatus(`“${preset.title}” uygulandı.`, 'success');
      return committed;
    } catch (error) {
      const rolledBack = projectController.undo();
      try {
        await renderProject(rolledBack);
      } catch {
        // The project model rollback remains authoritative when repainting also fails.
      }
      setStatus('Preset uygulanamadı; önceki görünüm geri yüklendi.', 'error');
      throw error;
    }
  }

  function download(id) {
    const preset = byId.get(id);
    if (!preset) return;
    const envelope = presetEnvelope(preset);
    const json = JSON.stringify(envelope, null, 2);
    const slug = (preset.title || 'preset').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const filename = `${slug}.chatlog-preset.json`;
    if (
      typeof globalThis.Blob === 'function' &&
      typeof globalThis.URL?.createObjectURL === 'function'
    ) {
      const blob = new globalThis.Blob([json], { type: 'application/json' });
      const url = globalThis.URL.createObjectURL(blob);
      const a = documentLike.createElement('a');
      a.href = url;
      a.download = filename;
      documentLike.body?.append?.(a);
      if (typeof a.click === 'function') a.click();
      if (typeof a.remove === 'function') a.remove();
      if (typeof globalThis.URL?.revokeObjectURL === 'function') {
        globalThis.URL.revokeObjectURL(url);
      }
      setStatus(`“${preset.title}” indirildi.`, 'success');
    } else {
      setStatus(`“${preset.title}” indirilemedi.`, 'error');
    }
  }

  async function share(id) {
    const preset = await findPreset(id);
    if (!preset) return;
    const envelope = presetEnvelope(preset);
    const json = JSON.stringify(envelope, null, 2);
    let copied = false;
    if (globalThis.navigator?.clipboard?.writeText) {
      try {
        await globalThis.navigator.clipboard.writeText(json);
        copied = true;
      } catch {
        copied = false;
      }
    }
    if (copied) {
      setStatus(
        `“${preset.title}” preset kodu panoya kopyalandı! Arkadaşınızla paylaşabilirsiniz.`,
        'success'
      );
    } else {
      download(id);
      setStatus(`“${preset.title}” panoya kopyalanamadı, dosya olarak indirildi.`, 'ready');
    }
  }

  async function deletePreset(id) {
    const preset = byId.get(id);
    if (!preset) return false;
    const confirmMsg = t(
      'presets.deleteConfirm',
      { title: preset.title },
      `“${preset.title}” presetini silmek istediğinize emin misiniz?`
    );
    const accepted = await Promise.resolve(confirm(confirmMsg));
    if (!accepted) return false;
    if (typeof client.delete === 'function') {
      await client.delete(id);
    }
    byId.delete(id);
    const index = order.indexOf(id);
    if (index !== -1) order.splice(index, 1);
    renderCards();
    setStatus(`“${preset.title}” silindi.`, 'ready');
    return true;
  }

  async function importPreset(rawContent) {
    try {
      const parsed = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;
      const validated = validateCommunityPreset(parsed);
      const result = await client.submit(validated);
      try {
        const refreshed = await client.list({ query: currentQuery });
        if (refreshed?.presets) mergePresets(refreshed.presets, true);
      } catch {
        // Keep existing card state
      }
      setStatus(`“${validated.title}” preseti başarıyla içe aktarıldı!`, 'success');
      return result;
    } catch (error) {
      setStatus('Preset içe aktarılamadı: Geçersiz preset formatı.', 'error');
      return null;
    }
  }

  async function submit() {
    if (offline) return null;
    const accepted = await Promise.resolve(confirm(DISCLOSURE));
    if (!accepted) return { status: 'cancelled' };
    try {
      const currentProj =
        typeof projectController?.captureCurrentChat === 'function'
          ? projectController.captureCurrentChat()
          : getProject();
      const preset = extractCommunityPreset(currentProj, {
        title: element('communityPresetTitle')?.value ?? '',
        description: element('communityPresetDescription')?.value ?? '',
      });
      const result = await client.submit(preset);
      if (element('communityPresetTitle')) element('communityPresetTitle').value = '';
      if (element('communityPresetDescription')) element('communityPresetDescription').value = '';
      try {
        const refreshed = await client.list({ query: currentQuery });
        if (refreshed?.presets) mergePresets(refreshed.presets, true);
      } catch {
        // Keep existing card state
      }
      if (result?.status === 'pending') {
        setStatus('Preset moderasyona gönderildi.', 'success');
      } else {
        setStatus('Preset yerel kütüphaneye kaydedildi.', 'success');
      }
      return result;
    } catch (error) {
      if (['community_unavailable', 'network_error'].includes(error?.code)) setOffline(error);
      else setStatus(error?.message || 'Preset gönderilemedi.', 'error');
      return null;
    }
  }

  async function open() {
    if (destroyed || !modal) return null;
    modal.hidden = false;
    modalSession = dialogs.openModal({
      element: modal,
      initialFocus: searchInput,
      onEscape: () => close(),
    });
    if (order.length === 0) return search('');
    renderCards();
    return null;
  }

  function close() {
    if (modal) modal.hidden = true;
    modalSession?.release();
    modalSession = null;
  }

  function init() {
    if (initialized || destroyed) return api;
    initialized = true;
    listen(element('communityOpen'), 'click', () => void open());
    listen(element('communityClose'), 'click', close);
    listen(element('communityBackdrop'), 'click', close);
    listen(element('communitySearchForm'), 'submit', (event) => {
      event.preventDefault();
      void search();
    });
    listen(loadMoreButton, 'click', () => void loadMore());
    listen(element('communityPreviewApply'), 'click', () => void apply());
    listen(element('communitySubmitForm'), 'submit', (event) => {
      event.preventDefault();
      void submit();
    });
    listen(element('communityPreviewImage'), 'error', () => {
      const image = element('communityPreviewImage');
      const fallback = element('communityPreviewFallback');
      if (image) image.hidden = true;
      if (fallback) fallback.hidden = false;
    });

    const importBtn = element('communityImportBtn');
    const importFile = element('communityImportFile');
    const pasteBtn = element('communityPasteBtn');

    if (importBtn && importFile) {
      listen(importBtn, 'click', () => {
        importFile.value = '';
        importFile.click();
      });
      listen(importFile, 'change', (event) => {
        const file = event.target?.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          void importPreset(reader.result);
        };
        reader.readAsText(file);
      });
    }

    if (pasteBtn) {
      listen(pasteBtn, 'click', async () => {
        let text = '';
        if (globalThis.navigator?.clipboard?.readText) {
          try {
            text = await globalThis.navigator.clipboard.readText();
          } catch {
            text = '';
          }
        }
        if (!text) {
          text = globalThis.prompt?.('Preset JSON kodunu yapıştırın:') ?? '';
        }
        if (text && text.trim()) {
          void importPreset(text.trim());
        }
      });
    }

    // Escape + focus trap resolve through the shared layer stack, so one key
    // press affects exactly the topmost layer even with several modals open.
    const keydown = (event) => {
      dialogs.routeKeydown(event);
    };
    documentLike.addEventListener('keydown', keydown);
    cleanups.push(() => documentLike.removeEventListener('keydown', keydown));

    const onLocaleChanged = () => {
      renderCards();
    };
    documentLike.addEventListener?.('cm:locale-changed', onLocaleChanged);
    cleanups.push(() => documentLike.removeEventListener?.('cm:locale-changed', onLocaleChanged));
    return api;
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    activeRequest?.abort();
    activeLoadMore?.abort();
    for (const cleanup of cleanups.splice(0)) cleanup();
    close();
  }

  const api = {
    init,
    open,
    close,
    search,
    loadMore,
    preview,
    apply,
    submit,
    destroy,
    share,
    download,
    deletePreset,
    importPreset,
  };
  return api;
}

export function initializeCommunityController(
  windowLike: any = window,
  documentLike: any = document
) {
  if (!windowLike.ChatlogProject || windowLike.ChatlogCommunity) {
    return windowLike.ChatlogCommunity ?? null;
  }
  const controller = createCommunityController({
    client: createLocalPresetClient({ storage: windowLike.localStorage }),
    projectController: windowLike.ChatlogProject,
    getProject: () =>
      typeof windowLike.ChatlogProject?.captureCurrentChat === 'function'
        ? windowLike.ChatlogProject.captureCurrentChat()
        : windowLike.ChatlogProject?.getSnapshot?.(),
    document: documentLike,
    confirm: (message) =>
      typeof windowLike.showConfirmDialog === 'function'
        ? windowLike.showConfirmDialog(message)
        : windowLike.confirm(message),
    renderProject: (snapshot) =>
      renderProjectState(documentLike, snapshot, { canvas: windowLike.ChatlogCanvas }),
  });
  controller.init();
  windowLike.ChatlogCommunity = controller;
  return controller;
}

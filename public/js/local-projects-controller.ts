import { createAutosaveController } from './autosave-controller.js';
import { createBcmagFile, readBcmagFile } from './bcmag-file.js';
import { createCustomFontService } from './custom-fonts.js';
import { createImageStack } from './image-stack.js';
import { createLocalAssetService, referencedAssetIds } from './local-asset-service.js';
import { createLocalDatabase } from './local-database.js';
import { createProject, serializeProject } from './project-model.js';
import { applyChatState } from './project-state-bridge.js';

const STORAGE_UNAVAILABLE =
  'Yerel depolama kullanılamıyor; dosya ile kaydetmeye devam edebilirsiniz.';
const OPEN_FAILED = 'Proje açılamadı; önceki çalışmanız korundu.';
const STORAGE_CONTROLS = [
  'projectLocal',
  'projectSnapshot',
  'projectStack',
  'projectFonts',
  'clearLocalData',
];
const DIALOG_IDS = [
  'localProjectsDialog',
  'imageStackDialog',
  'customFontsDialog',
  'clearLocalDialog',
];

function safeFilename(value) {
  const name = String(value || 'Adsız Proje')
    .replace(/[<>:"/\\|?*]/gu, '_')
    .trim()
    .replace(/[. ]+$/u, '');
  return `${(name || 'Adsız Proje').slice(0, 80)}.bcmag`;
}

function fontIds(project) {
  return [...new Set((project.fonts ?? []).map(({ id }) => id))];
}

function recordsByIds(ids, records) {
  const byId = new Map(records.map((record) => [record.id, record]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

function sameSnapshot(left, right) {
  try {
    return serializeProject(left) === serializeProject(right);
  } catch {
    return false;
  }
}

function metadataOnly(font) {
  return {
    id: font.id,
    family: font.family,
    name: font.name,
    type: font.type,
    size: font.size,
  };
}

function projectUsesFont(snapshot, font) {
  if (snapshot.chat?.font === font.family) return true;
  return (snapshot.blocks ?? []).some((block) => block?.style?.font === font.family);
}

export function createLocalProjectsController(dependencies: any = {}) {
  const {
    document,
    project,
    canvas,
    database,
    assetService,
    fontService,
    autosave,
    imageStack,
    readBcmagFile: parseBcmag,
    createBcmagFile: buildBcmag,
    saveAs,
    applyProjectState,
    createProject: makeProject,
    now,
    confirm,
    storage,
  } = dependencies;
  if (
    !document ||
    !project?.getSnapshot ||
    !project?.replaceSnapshot ||
    !canvas ||
    !database ||
    !assetService ||
    !fontService ||
    !autosave ||
    !imageStack ||
    typeof parseBcmag !== 'function' ||
    typeof buildBcmag !== 'function' ||
    typeof saveAs !== 'function'
  ) {
    throw new TypeError('Local project controller dependencies are required.');
  }

  const get = (id) => document.getElementById(id);
  const listeners = [];
  const thumbnailUrls = new Set();
  let storageAvailable = true;
  let destroyed = false;
  let recoveryCandidate = null;
  let lastExplicitSnapshot = project.getSnapshot();
  let unsubscribeProject = null;
  let dependencyWrites = Promise.resolve();

  function listen(element, type, handler) {
    if (!element) return;
    element.addEventListener(type, handler);
    listeners.push(() => element.removeEventListener(type, handler));
  }

  function status(message) {
    const target = get('projectStatus');
    if (target) target.textContent = message;
    if (message === 'Proje açıldı.') {
      const showToast =
        document?.defaultView?.showToast ||
        (typeof window !== 'undefined' ? window.showToast : null);
      if (typeof showToast === 'function') {
        showToast('Proje açıldı', 'fa-folder-open');
      }
    }
  }

  function closeDialogs() {
    for (const id of [...DIALOG_IDS, 'recoveryDialog']) {
      const dialog = get(id);
      if (dialog?.open) dialog.close();
    }
  }

  function showDialog(id, trigger?) {
    const dialog = get(id);
    if (!dialog) return false;
    dialog.dataset.returnFocus = trigger?.id ?? '';
    if (!dialog.open) dialog.showModal?.();
    return true;
  }

  function rememberProject(projectId) {
    try {
      storage?.setItem?.('chatlog-current-project-id', projectId);
    } catch (_error) {
      // Recovery discovery must not make editing depend on localStorage.
    }
  }

  async function loadDependencies(snapshot) {
    const assetIds = referencedAssetIds(snapshot);
    const requiredFontIds = fontIds(snapshot);
    const storedAssets = storageAvailable ? await database.getAssets(assetIds) : [];
    const storedFonts = storageAvailable ? await database.getFonts(requiredFontIds) : [];
    const assetsById = new Map(storedAssets.map((entry) => [entry.id, entry]));
    for (const id of assetIds) {
      const runtime = canvas.getAsset?.(id);
      if (!assetsById.has(id) && runtime) assetsById.set(id, runtime);
    }
    const fontsById = new Map(storedFonts.map((entry) => [entry.id, entry]));
    for (const runtime of fontService.list?.() ?? []) {
      if (!fontsById.has(runtime.id)) fontsById.set(runtime.id, runtime);
    }
    const assets = recordsByIds(assetIds, [...assetsById.values()]);
    const fonts = recordsByIds(requiredFontIds, [...fontsById.values()]);
    if (assets.length !== assetIds.length || fonts.length !== requiredFontIds.length) {
      throw new Error('Projede gereken bir görsel ya da font eksik.');
    }
    return { assets, fonts };
  }

  async function persistBundle(bundle) {
    const backups = await database.transaction(
      ['projects', 'assets', 'fonts'],
      'readwrite',
      async (stores) => {
        const previous = {
          project: await stores.projects.get(bundle.project.metadata.id),
          assets: await Promise.all(bundle.assets.map(({ id }) => stores.assets.get(id))),
          fonts: await Promise.all(bundle.fonts.map(({ id }) => stores.fonts.get(id))),
        };
        await stores.projects.put({
          id: bundle.project.metadata.id,
          project: bundle.project,
          savedAt: now(),
        });
        await Promise.all(bundle.assets.map((record) => stores.assets.put(record)));
        await Promise.all(bundle.fonts.map((record) => stores.fonts.put(record)));
        return previous;
      }
    );
    return async () => {
      await database.transaction(['projects', 'assets', 'fonts'], 'readwrite', async (stores) => {
        const restore = async (store, id, record) =>
          record === undefined ? store.delete(id) : store.put(record);
        await restore(stores.projects, bundle.project.metadata.id, backups.project);
        await Promise.all(
          bundle.assets.map((record, index) =>
            restore(stores.assets, record.id, backups.assets[index])
          )
        );
        await Promise.all(
          bundle.fonts.map((record, index) =>
            restore(stores.fonts, record.id, backups.fonts[index])
          )
        );
      });
    };
  }

  async function persistDependencies(snapshot) {
    const { assets, fonts } = await loadDependencies(snapshot);
    await database.transaction(['assets', 'fonts'], 'readwrite', async (stores) => {
      await Promise.all(assets.map((record) => stores.assets.put(record)));
      await Promise.all(fonts.map((record) => stores.fonts.put(record)));
    });
  }

  function queueDependencyPersistence(snapshot) {
    dependencyWrites = dependencyWrites
      .catch(() => {})
      .then(() => persistDependencies(snapshot))
      .catch(() => {
        status('Yerel varlıklar kaydedilemedi; dosya ile kaydetmeye devam edebilirsiniz.');
      });
    return dependencyWrites;
  }

  function settleDependencies() {
    return dependencyWrites.catch(() => {});
  }

  async function captureAutosaves(projectIds) {
    if (!storageAvailable || !database.getAutosave) return new Map();
    const records = new Map();
    for (const projectId of new Set(projectIds)) {
      records.set(projectId, await database.getAutosave(projectId));
    }
    return records;
  }

  async function restoreAutosaves(records) {
    for (const [projectId, record] of records) {
      if (record === undefined) await database.deleteAutosave(projectId);
      else await database.putAutosave(record);
    }
  }

  async function applyBundle(bundle, { explicitSaveAt }: any = {}) {
    const previous = project.getSnapshot();
    let assetStage;
    let fontStage;
    let replaced = false;
    let compensatePersistence;
    let autosaveBackups = new Map();
    let autosaveQuiesced = false;
    try {
      await autosave.quiesce?.({ flushPending: true });
      autosaveQuiesced = true;
      await settleDependencies();
      autosaveBackups = await captureAutosaves([previous.metadata.id, bundle.project.metadata.id]);
      const requiredAssets = referencedAssetIds(bundle.project);
      const requiredFonts = fontIds(bundle.project);
      if (
        recordsByIds(requiredAssets, bundle.assets).length !== requiredAssets.length ||
        recordsByIds(requiredFonts, bundle.fonts).length !== requiredFonts.length
      ) {
        throw new Error('Projede gereken bir görsel ya da font eksik.');
      }
      assetStage = await assetService.stage(bundle.assets);
      fontStage = await fontService.stage(bundle.fonts);
      if (storageAvailable) compensatePersistence = await persistBundle(bundle);
      await assetStage.commit();
      await fontStage.commit();
      project.replaceSnapshot(bundle.project);
      replaced = true;
      applyProjectState?.(document, bundle.project);
      await (canvas.refresh?.() ?? canvas.render?.());
      try {
        await assetStage.finalize?.();
        await fontStage.finalize?.();
        const requiredAssetIds = new Set(requiredAssets);
        for (const runtime of canvas.listAssets?.() ?? []) {
          if (!requiredAssetIds.has(runtime.id)) canvas.removeAsset?.(runtime.id);
        }
        fontService.pruneRuntime?.(requiredFonts);
      } catch {
        // Cleanup failures must not roll back a successfully rendered project.
      }
      rememberProject(bundle.project.metadata.id);
      project.markExplicitSave(Number.isFinite(explicitSaveAt) ? explicitSaveAt : 0);
      lastExplicitSnapshot = project.getSnapshot();
      status('Proje açıldı.');
      return true;
    } catch {
      try {
        await fontStage?.rollback?.();
      } catch {
        // Preserve the import failure while attempting every rollback.
      }
      try {
        await assetStage?.rollback?.();
      } catch {
        // Preserve the import failure while attempting every rollback.
      }
      if (compensatePersistence) {
        try {
          await compensatePersistence();
        } catch {
          // Memory rollback remains useful even if IndexedDB compensation itself fails.
        }
      }
      try {
        await restoreAutosaves(autosaveBackups);
      } catch {
        // Preserve the original open failure after best-effort autosave compensation.
      }
      if (replaced) {
        try {
          project.replaceSnapshot(previous);
          applyProjectState?.(document, previous);
          await (canvas.refresh?.() ?? canvas.render?.());
        } catch {
          // The original project remains the authoritative recovery target.
        }
      }
      status(replaced ? OPEN_FAILED : 'Proje açılamadı; mevcut çalışmanız değiştirilmedi.');
      return false;
    } finally {
      if (autosaveQuiesced) {
        try {
          await autosave.start();
        } catch {
          // Opening remains usable even if autosave cannot restart.
        }
      }
    }
  }

  async function openFile(file) {
    if (!file) return false;
    try {
      const imported = await parseBcmag(file);
      return applyBundle(imported, { explicitSaveAt: imported.savedAt });
    } catch (error) {
      status(error?.message || 'Proje dosyası açılamadı.');
      return false;
    }
  }

  async function importProjectBytes(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) return false;
    return openFile(new Blob([bytes as any], { type: 'application/x-bcmag' }));
  }

  async function exportProjectBytes() {
    const snapshot = project.captureCurrentChat?.() ?? project.getSnapshot();
    await settleDependencies();
    try {
      await autosave.flush();
    } catch {
      // Best-effort flush; failures are non-fatal.
    }
    const { assets, fonts } = await loadDependencies(snapshot);
    const file = await buildBcmag({ project: snapshot, assets, fonts, savedAt: now() });
    return new Uint8Array(await file.arrayBuffer());
  }

  async function saveFile() {
    try {
      const snapshot = project.captureCurrentChat?.() ?? project.getSnapshot();
      await settleDependencies();
      try {
        await autosave.flush();
      } catch {
        // A file export is the fallback when IndexedDB/autosave is unavailable.
      }
      const { assets, fonts } = await loadDependencies(snapshot);
      const savedAt = now();
      const file = await buildBcmag({ project: snapshot, assets, fonts, savedAt });
      await saveAs(file, safeFilename(snapshot.metadata.title));
      project.markExplicitSave(savedAt);
      lastExplicitSnapshot = snapshot;
      let localWarning = false;
      if (storageAvailable) {
        try {
          await database.putProject({ id: snapshot.metadata.id, project: snapshot, savedAt });
        } catch {
          localWarning = true;
        }
        try {
          await autosave.discard?.(snapshot.metadata.id);
        } catch {
          localWarning = true;
        }
      }
      status(
        localWarning ? 'BCMAG kaydedildi; yerel kayıt güncellenemedi.' : 'BCMAG projesi kaydedildi.'
      );
      return true;
    } catch (error) {
      status(error?.message || 'Proje kaydedilemedi.');
      return false;
    }
  }

  async function saveSnapshot() {
    if (!storageAvailable) return false;
    try {
      const snapshot = project.captureCurrentChat?.() ?? project.getSnapshot();
      const bundle = { project: snapshot, ...(await loadDependencies(snapshot)) };
      await persistBundle(bundle);
      status('Yerel proje kaydedildi.');
      return true;
    } catch {
      status('Yerel proje kaydedilemedi.');
      return false;
    }
  }

  async function openSnapshot(id) {
    if (!storageAvailable) return false;
    try {
      const record = await database.getProject(id);
      const snapshot = record?.project ?? record;
      if (!snapshot) {
        status('Yerel proje bulunamadı.');
        return false;
      }
      return applyBundle(
        { project: snapshot, ...(await loadDependencies(snapshot)) },
        { explicitSaveAt: Number.isFinite(record?.savedAt) ? record.savedAt : 0 }
      );
    } catch {
      status('Yerel proje açılamadı.');
      return false;
    }
  }

  async function showLocalProjects(trigger = get('projectLocal')) {
    if (!storageAvailable) return false;
    const list = get('localProjectsList');
    if (!list) return false;
    try {
      const records = await database.listProjects();
      if (records.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'local-empty-state';
        empty.textContent = 'Henüz yerel proje kaydı yok.';
        list.replaceChildren(empty);
      } else {
        const rows = records.map((record) => {
          const row = document.createElement('div');
          row.className = 'local-project-row';
          const details = document.createElement('span');
          details.textContent = record.project?.metadata?.title || 'Adsız Proje';
          const open = button('fa-folder-open', 'Yerel projeyi aç');
          listen(open, 'click', async () => {
            if (await openSnapshot(record.id)) get('localProjectsDialog')?.close();
          });
          row.append(details, open);
          return row;
        });
        list.replaceChildren(...rows);
      }
      return showDialog('localProjectsDialog', trigger);
    } catch (error) {
      status(error?.message || 'Yerel projeler yüklenemedi.');
      return false;
    }
  }

  function clearThumbnails() {
    const urlApi = document.defaultView?.URL ?? globalThis.URL;
    for (const url of thumbnailUrls) urlApi?.revokeObjectURL?.(url);
    thumbnailUrls.clear();
  }

  function button(icon, label) {
    const control = document.createElement('button');
    control.type = 'button';
    control.className = 'local-icon-button';
    control.title = label;
    control.setAttribute('aria-label', label);
    const symbol = document.createElement('i');
    symbol.className = `fas ${icon}`;
    symbol.setAttribute('aria-hidden', 'true');
    control.append(symbol);
    return control;
  }

  async function reopenStack(id) {
    try {
      return applyBundle(await imageStack.prepareReopen(id));
    } catch (error) {
      status(error?.message || 'Yığın kaydı açılamadı.');
      return false;
    }
  }

  async function showStack(trigger = get('projectStack')) {
    if (!storageAvailable) return false;
    const list = get('imageStackList');
    if (!list) return false;
    clearThumbnails();
    let entries;
    try {
      entries = await imageStack.list();
    } catch (error) {
      status(error?.message || 'Görsel yığını yüklenemedi.');
      return false;
    }
    if (entries.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'local-empty-state';
      empty.textContent = 'Henüz kaydedilmiş görsel yok.';
      list.replaceChildren(empty);
    } else {
      const rows = entries.map((entry) => {
        const row = document.createElement('div');
        row.className = 'image-stack-row';
        const selected = document.createElement('input');
        selected.type = 'checkbox';
        selected.checked = imageStack.selected().has(entry.id);
        selected.setAttribute('aria-label', `${entry.name} seç`);
        listen(selected, 'change', () => {
          const ids = imageStack.selected();
          if (selected.checked) ids.add(entry.id);
          else ids.delete(entry.id);
          imageStack.select([...ids]);
        });
        const thumbnail = document.createElement('img');
        thumbnail.alt = '';
        const urlApi = document.defaultView?.URL ?? globalThis.URL;
        if (entry.blob && urlApi?.createObjectURL) {
          thumbnail.src = urlApi.createObjectURL(entry.blob);
          thumbnailUrls.add(thumbnail.src);
        }
        const name = document.createElement('input');
        name.value = entry.name;
        name.maxLength = 80;
        name.setAttribute('aria-label', 'Görsel adı');
        listen(name, 'change', async () => {
          try {
            await imageStack.rename(entry.id, name.value);
          } catch (error) {
            status(error?.message || 'Görsel adı değiştirilemedi.');
          }
        });
        const actions = document.createElement('div');
        actions.className = 'local-row-actions';
        const reopen = button('fa-folder-open', 'Projeyi yeniden aç');
        const download = button('fa-download', 'Görseli indir');
        const remove = button('fa-trash-can', 'Görseli sil');
        listen(reopen, 'click', () => void reopenStack(entry.id));
        listen(download, 'click', async () => {
          try {
            await imageStack.download(entry.id);
          } catch (error) {
            status(error?.message || 'Görsel indirilemedi.');
          }
        });
        listen(remove, 'click', async () => {
          imageStack.select([entry.id]);
          try {
            await imageStack.deleteSelected();
            await showStack(trigger);
          } catch (error) {
            status(error?.message || 'Görsel silinemedi.');
          }
        });
        actions.append(reopen, download, remove);
        row.append(selected, thumbnail, name, actions);
        return row;
      });
      list.replaceChildren(...rows);
    }
    return showDialog('imageStackDialog', trigger);
  }

  async function showFonts(trigger = get('projectFonts')) {
    if (!storageAvailable) return false;
    const list = get('customFontsList');
    if (!list) return false;
    const rows = (fontService.list?.() ?? []).map((font) => {
      const row = document.createElement('div');
      row.className = 'custom-font-row';
      const details = document.createElement('button');
      details.type = 'button';
      details.className = 'custom-font-row__select';
      details.textContent = `${font.family} · ${font.name} · ${Math.ceil(font.size / 1024)} KB`;
      const remove = button('fa-trash-can', 'Fontu sil');
      listen(details, 'click', () => {
        project.commit((draft) => {
          draft.chat.font = font.family;
        });
        applyProjectState?.(document, project.getSnapshot());
        void (canvas.refresh?.() ?? canvas.render?.());
      });
      listen(remove, 'click', async () => {
        const previous = project.getSnapshot();
        try {
          if (projectUsesFont(previous, font)) {
            throw new Error('Bu özel font etkin projede kullanılıyor.');
          }
          project.replaceSnapshot({
            ...previous,
            fonts: previous.fonts.filter(({ id }) => id !== font.id),
          });
          await fontService.remove(font.id);
        } catch (error) {
          if (!sameSnapshot(project.getSnapshot(), previous)) {
            project.replaceSnapshot(previous);
            applyProjectState?.(document, previous);
          }
          status(error?.message || 'Font silinemedi.');
          return;
        }
        try {
          await showFonts(trigger);
        } catch (error) {
          status(error?.message || 'Font listesi yenilenemedi.');
        }
      });
      row.append(details, remove);
      return row;
    });
    if (rows.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'local-empty-state';
      empty.textContent = 'Henüz özel font eklenmedi.';
      rows.push(empty);
    }
    list.replaceChildren(...rows);
    return showDialog('customFontsDialog', trigger);
  }

  async function clearLocalData(confirmed = false) {
    if (
      !storageAvailable ||
      (!confirmed &&
        !(await Promise.resolve(confirm('Tüm yerel projeler, görseller ve fontlar silinsin mi?'))))
    ) {
      return false;
    }
    await (autosave.quiesce?.() ?? Promise.resolve(autosave.stop()));
    await settleDependencies();
    closeDialogs();
    try {
      await database.clearAllLocalData();
    } catch {
      await autosave.start();
      status('Yerel veriler silinemedi.');
      return false;
    }
    try {
      for (const cleanup of [
        () => canvas.clearAssets?.(),
        () => assetService.clear?.(),
        () => fontService.clear(),
      ]) {
        try {
          cleanup();
        } catch {
          // IndexedDB is authoritative; continue releasing independent registries.
        }
      }
      const fresh = makeProject();
      project.replaceSnapshot(fresh);
      project.clearHistory?.();
      applyProjectState?.(document, fresh);
      try {
        await (canvas.refresh?.() ?? canvas.render?.());
      } catch {
        // The clean project remains authoritative even if preview rendering failed.
      }
      lastExplicitSnapshot = fresh;
      project.markExplicitSave(0);
      try {
        storage?.removeItem?.('chatlog-current-project-id');
      } catch {
        // IndexedDB deletion remains authoritative.
      }
      status('Yerel veriler silindi.');
      return true;
    } finally {
      await autosave.start();
    }
  }

  async function newProject() {
    const current = project.captureCurrentChat?.() ?? project.getSnapshot();
    if (
      !sameSnapshot(current, lastExplicitSnapshot) &&
      !(await Promise.resolve(confirm('Kaydedilmemiş değişiklikler silinsin mi?')))
    ) {
      return false;
    }
    const fresh = makeProject();
    project.replaceSnapshot(fresh);
    project.clearHistory?.();
    applyProjectState?.(document, fresh);
    await (canvas.refresh?.() ?? canvas.render?.());
    lastExplicitSnapshot = fresh;
    project.markExplicitSave(0);
    rememberProject(fresh.metadata.id);
    status('Yeni proje oluşturuldu.');
    return true;
  }

  async function start() {
    try {
      await database.open();
    } catch {
      storageAvailable = false;
      for (const id of STORAGE_CONTROLS) {
        const control = get(id);
        if (control) control.disabled = true;
      }
      if (document.body?.dataset) document.body.dataset.localReady = 'true';
      status(STORAGE_UNAVAILABLE);
      return false;
    }
    try {
      const snapshot = project.getSnapshot();
      let recoveryProjectId = snapshot.metadata.id;
      try {
        recoveryProjectId = storage?.getItem?.('chatlog-current-project-id') || recoveryProjectId;
      } catch {
        // Fall back to the active in-memory project.
      }
      await assetService.hydrateProject(snapshot);
      await fontService.hydrate(snapshot.fonts);
      autosave.setBarrier?.(settleDependencies);
      await autosave.start();
      unsubscribeProject ??= project.subscribe?.((event) => {
        const next = event?.snapshot ?? project.getSnapshot();
        rememberProject(next.metadata.id);
        void queueDependencyPersistence(next);
      });
      const persistedProject = await database.getProject(recoveryProjectId);
      recoveryCandidate = Number.isFinite(persistedProject?.savedAt)
        ? await autosave.getRecoveryCandidate(recoveryProjectId, persistedProject.savedAt)
        : await autosave.getRecoveryCandidate(recoveryProjectId);
      if (!recoveryCandidate) rememberProject(snapshot.metadata.id);
      if (recoveryCandidate && document.body?.dataset?.canvasActive === 'true') {
        promptRecoveryIfNeeded();
      }
      if (document.body?.dataset) document.body.dataset.localReady = 'true';
      return true;
    } catch {
      if (document.body?.dataset) document.body.dataset.localReady = 'true';
      status('Yerel proje verileri yüklenemedi; düzenlemeye devam edebilirsiniz.');
      return false;
    }
  }

  function pagehide() {
    return settleDependencies()
      .then(() => autosave.flush())
      .catch(() => {});
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    listeners.splice(0).forEach((remove) => remove());
    unsubscribeProject?.();
    unsubscribeProject = null;
    autosave.stop();
    clearThumbnails();
    fontService.clear();
    canvas.clearAssets?.();
    database.close();
  }

  listen(get('projectNew'), 'click', () => void newProject());
  listen(get('projectOpen'), 'click', () => get('projectFileInput')?.click());
  listen(get('projectSave'), 'click', () => void saveFile());
  listen(get('projectLocal'), 'click', (event) => void showLocalProjects(event.currentTarget));
  listen(get('projectSnapshot'), 'click', async () => {
    if (await saveSnapshot()) await showLocalProjects(get('projectLocal'));
  });
  listen(get('projectStack'), 'click', (event) => void showStack(event.currentTarget));
  listen(get('projectFonts'), 'click', (event) => void showFonts(event.currentTarget));
  listen(get('projectFileInput'), 'change', (event) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    void openFile(file);
  });
  if (typeof document.addEventListener === 'function') {
    listen(document, 'dragover', (event) => {
      event.preventDefault?.();
    });
    listen(document, 'drop', (event) => {
      const file = event.dataTransfer?.files?.[0];
      if (file && /\.bcmag$/i.test(file.name)) {
        event.preventDefault?.();
        void openFile(file);
      }
    });
  }
  listen(get('customFontAdd'), 'click', () => get('projectFontInput')?.click());
  listen(get('projectFontInput'), 'change', async (event) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    try {
      const family = document.defaultView?.prompt?.(
        'Font ailesi adı',
        file.name.replace(/\.[^.]+$/u, '')
      );
      if (!family) return;
      const font = await fontService.add(file, family);
      project.commit((draft) => {
        draft.fonts = [...draft.fonts.filter(({ id }) => id !== font.id), metadataOnly(font)];
        draft.chat.font = font.family;
      });
      applyProjectState?.(document, project.getSnapshot());
      await (canvas.refresh?.() ?? canvas.render?.());
      await showFonts();
    } catch (error) {
      status(error?.message || 'Font eklenemedi.');
    }
  });
  listen(get('imageStackSave'), 'click', async () => {
    try {
      const snapshot = project.captureCurrentChat?.() ?? project.getSnapshot();
      await imageStack.save(snapshot, snapshot.metadata.title);
      await showStack();
    } catch {
      status('Canvas kaydedilemedi; önce görünür bir içerik ekleyin.');
    }
  });
  listen(get('imageStackDownloadSelected'), 'click', async () => {
    try {
      const result = await imageStack.downloadSelected();
      if (result?.failedIds?.length) {
        status(`${result.failedIds.length} görsel indirilemedi.`);
      }
    } catch (error) {
      status(error?.message || 'Seçili görseller indirilemedi.');
    }
  });
  listen(get('imageStackDeleteSelected'), 'click', async () => {
    try {
      await imageStack.deleteSelected();
      await showStack();
    } catch (error) {
      status(error?.message || 'Seçili görseller silinemedi.');
    }
  });
  function promptRecoveryIfNeeded() {
    if (recoveryCandidate && !get('recoveryDialog')?.open) {
      showDialog('recoveryDialog');
    }
  }

  listen(get('modeCanvas'), 'click', promptRecoveryIfNeeded);
  listen(get('clearLocalData'), 'click', () =>
    showDialog('clearLocalDialog', get('clearLocalData'))
  );
  listen(get('clearLocalConfirm'), 'click', () => void clearLocalData(true));
  listen(get('recoveryDialog'), 'cancel', (event) => event.preventDefault());
  listen(get('recoveryRestore'), 'click', async () => {
    if (!recoveryCandidate) return;
    try {
      const candidate = recoveryCandidate;
      const assets = await database.getAssets(candidate.assetIds);
      const fonts = await database.getFonts(candidate.fontIds);
      await autosave.restore(candidate, async () => {
        if (
          !(await applyBundle(
            { project: candidate.project, assets, fonts },
            { explicitSaveAt: candidate.lastExplicitSaveAt }
          ))
        ) {
          throw new Error(OPEN_FAILED);
        }
      });
      recoveryCandidate = null;
      get('recoveryDialog')?.close();
    } catch {
      status('Otomatik kayıt geri yüklenemedi.');
    }
  });
  listen(get('recoveryFresh'), 'click', async () => {
    try {
      const projectId = recoveryCandidate?.projectId ?? project.getSnapshot().metadata.id;
      await autosave.startFresh(projectId, async (fresh) => {
        if (!(await applyBundle({ project: fresh, assets: [], fonts: [] }))) {
          throw new Error(OPEN_FAILED);
        }
      });
      recoveryCandidate = null;
      get('recoveryDialog')?.close();
    } catch {
      status('Otomatik kayıt geri yüklenemedi.');
    }
  });
  for (const id of DIALOG_IDS) {
    listen(get(id), 'close', (event) => get(event.currentTarget.dataset.returnFocus)?.focus?.());
  }

  return {
    start,
    saveFile,
    openFile,
    exportProjectBytes,
    importProjectBytes,
    saveSnapshot,
    openSnapshot,
    showLocalProjects,
    showStack,
    showFonts,
    clearLocalData,
    pagehide,
    destroy,
  };
}

function defaultId(prefix) {
  return () =>
    globalThis.crypto?.randomUUID?.() ??
    `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function initializeLocalProjectsController(
  windowLike: any = window,
  documentLike: any = document
) {
  if (windowLike.ChatlogLocal) return windowLike.ChatlogLocal;
  const missingDependencies = [
    !windowLike.ChatlogProject && 'ChatlogProject',
    !windowLike.ChatlogCanvas && 'ChatlogCanvas',
  ].filter(Boolean);
  if (missingDependencies.length > 0) {
    console.error(
      `Local projects controller requires ${missingDependencies.join(' and ')}; local projects disabled.`
    );
    for (const id of STORAGE_CONTROLS) {
      const control = documentLike.getElementById?.(id);
      if (control) control.disabled = true;
    }
    const status = documentLike.getElementById?.('projectStatus');
    if (status) status.textContent = 'Yerel projeler kullanılamıyor.';
    return null;
  }
  const database = createLocalDatabase();
  const canvas = windowLike.ChatlogCanvas;
  const registryAdapter = {
    prepareWithId: canvas.prepareAsset,
    prepareReplacementWithId: canvas.prepareReplacementAsset,
    has: canvas.hasAsset,
    get: canvas.getAsset,
    listMetadata: () => canvas.listAssets().map(({ blob: _blob, ...metadata }) => metadata),
    remove: canvas.removeAsset,
    clear: canvas.clearAssets,
  };
  const assetService = createLocalAssetService({ database, assetRegistry: registryAdapter });
  const fontService = createCustomFontService({
    database,
    fontSet: documentLike.fonts,
    FontFace: windowLike.FontFace,
    isReferenced: (id) => {
      const snapshot = windowLike.ChatlogProject.getSnapshot();
      const font = snapshot.fonts.find((entry) => entry.id === id);
      return Boolean(font && projectUsesFont(snapshot, font));
    },
  });
  const autosave = createAutosaveController({
    project: windowLike.ChatlogProject,
    database,
    onError: (message) => {
      const target = documentLike.getElementById('projectStatus');
      if (target) target.textContent = message;
    },
  });
  const imageStack = createImageStack({
    database,
    renderer: { toBlob: canvas.toBlob },
    saveAs: windowLike.saveAs,
    createId: defaultId('stack'),
    now: () => new Date(),
  });
  const controller = createLocalProjectsController({
    document: documentLike,
    project: windowLike.ChatlogProject,
    canvas,
    database,
    assetService,
    fontService,
    autosave,
    imageStack,
    readBcmagFile,
    createBcmagFile,
    saveAs: windowLike.saveAs,
    applyProjectState: applyChatState,
    createProject,
    now: () => Date.now(),
    confirm: (message) => {
      if (
        typeof windowLike.confirm === 'function' &&
        !windowLike.confirm.toString().includes('[native code]')
      ) {
        return windowLike.confirm(message);
      }
      return typeof windowLike.showConfirmDialog === 'function'
        ? windowLike.showConfirmDialog(message)
        : windowLike.confirm(message);
    },
    storage: windowLike.localStorage,
  });
  const api = {
    saveFile: controller.saveFile,
    openFile: controller.openFile,
    exportProjectBytes: controller.exportProjectBytes,
    importProjectBytes: controller.importProjectBytes,
    saveSnapshot: controller.saveSnapshot,
    openSnapshot: controller.openSnapshot,
    showLocalProjects: controller.showLocalProjects,
    showStack: controller.showStack,
    showFonts: controller.showFonts,
    clearLocalData: controller.clearLocalData,
    destroy() {
      windowLike.removeEventListener?.('pagehide', controller.pagehide);
      controller.destroy();
      if (windowLike.ChatlogLocal === api) delete windowLike.ChatlogLocal;
    },
  };
  windowLike.ChatlogLocal = api;
  windowLike.addEventListener?.('pagehide', controller.pagehide);
  void controller.start();
  return api;
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => initializeLocalProjectsController());
}

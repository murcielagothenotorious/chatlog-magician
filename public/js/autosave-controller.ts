import { createProject, deserializeProject, serializeProject } from './project-model.js';

const DEFAULT_DEBOUNCE_MS = 800;
const SAVE_ERROR_MESSAGE = 'Otomatik kayıt başarısız; çalışmaya devam edebilirsiniz.';
const AUTOSAVE_REASONS = new Set(['commit', 'undo', 'redo', 'replace']);

function canonicalSnapshot(value) {
  return deserializeProject(serializeProject(value));
}

function uniqueIds(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((value) => typeof value === 'string' && value.length > 0))];
}

function defaultCollectReferences(project) {
  const assetIds = [];
  const backgroundAssetId = project.canvas?.background?.assetId;
  if (typeof backgroundAssetId === 'string' && backgroundAssetId) assetIds.push(backgroundAssetId);
  for (const layer of project.layers ?? []) {
    if (typeof layer?.assetId === 'string' && layer.assetId) assetIds.push(layer.assetId);
  }

  return {
    assetIds: uniqueIds(assetIds),
    fontIds: uniqueIds((project.fonts ?? []).map((font) => font?.id)),
  };
}

function validTimestamp(value) {
  return Number.isFinite(value) && value >= 0;
}

function normalizeRecoveryCandidate(record, projectId, lastExplicitSaveAt) {
  if (!record || typeof record !== 'object' || record.projectId !== projectId) return null;
  if (!Number.isInteger(record.revision) || record.revision < 1) return null;
  if (!validTimestamp(record.savedAt) || !validTimestamp(record.lastExplicitSaveAt)) return null;
  if (record.savedAt <= record.lastExplicitSaveAt || record.savedAt <= lastExplicitSaveAt)
    return null;

  try {
    const project = canonicalSnapshot(record.project);
    if (project.metadata.id !== projectId) return null;
    return {
      ...record,
      project,
      assetIds: uniqueIds(record.assetIds),
      fontIds: uniqueIds(record.fontIds),
    };
  } catch {
    return null;
  }
}

export function createAutosaveController(options) {
  const {
    project,
    database,
    collectReferences = defaultCollectReferences,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    now = () => Date.now(),
    setTimer = globalThis.setTimeout,
    clearTimer = globalThis.clearTimeout,
    onError = () => {},
  } = options ?? {};

  if (!project?.getSnapshot || !project?.subscribe || !project?.getLastExplicitSaveAt) {
    throw new TypeError('Autosave requires a project controller.');
  }
  if (!database?.getAutosave || !database?.putAutosave || !database?.deleteAutosave) {
    throw new TypeError('Autosave requires a local database.');
  }

  const delay = Number.isFinite(debounceMs) ? Math.max(0, debounceMs) : DEFAULT_DEBOUNCE_MS;
  const revisions = new Map();
  let unsubscribe = null;
  let timer = null;
  let pending = null;
  let activeFlush = null;
  let applyingRecovery = false;
  let writeBarrier = async () => {};

  function report(error) {
    try {
      onError(SAVE_ERROR_MESSAGE, error);
    } catch {
      // Autosave failures must not interrupt editing.
    }
  }

  function cancelTimer() {
    if (timer === null) return;
    clearTimer(timer);
    timer = null;
  }

  async function loadRevision(projectId) {
    if (revisions.has(projectId)) return revisions.get(projectId);
    const existing = await database.getAutosave(projectId);
    const revision =
      Number.isInteger(existing?.revision) && existing.revision > 0 ? existing.revision : 0;
    revisions.set(projectId, revision);
    return revision;
  }

  function schedule(snapshot) {
    try {
      pending = canonicalSnapshot(snapshot);
    } catch (error) {
      report(error);
      return;
    }

    cancelTimer();
    timer = setTimer(() => {
      timer = null;
      void flush().catch(() => {});
    }, delay);
  }

  async function writeSnapshot(snapshot) {
    await writeBarrier();
    const projectId = snapshot.metadata.id;
    const revision = (await loadRevision(projectId)) + 1;
    const savedAt = now();
    if (!validTimestamp(savedAt)) throw new TypeError('Autosave time must be non-negative.');
    const references = collectReferences(snapshot) ?? {};
    const record = {
      projectId,
      revision,
      savedAt,
      lastExplicitSaveAt: project.getLastExplicitSaveAt(),
      project: snapshot,
      assetIds: uniqueIds(references.assetIds),
      fontIds: uniqueIds(references.fontIds),
    };

    if (!validTimestamp(record.lastExplicitSaveAt)) {
      throw new TypeError('Explicit save time must be non-negative.');
    }

    await database.putAutosave(record);
    revisions.set(projectId, revision);
    return record;
  }

  async function flush() {
    cancelTimer();
    if (activeFlush) {
      await activeFlush;
      return pending ? flush() : undefined;
    }
    if (!pending) return undefined;

    const snapshot = pending;
    pending = null;
    activeFlush = writeSnapshot(snapshot);
    try {
      return await activeFlush;
    } catch (error) {
      if (!pending) pending = snapshot;
      report(error);
      throw error;
    } finally {
      activeFlush = null;
    }
  }

  async function start() {
    if (unsubscribe) return;
    unsubscribe = project.subscribe((event) => {
      if (applyingRecovery || !AUTOSAVE_REASONS.has(event?.reason)) return;
      schedule(event.snapshot ?? project.getSnapshot());
    });

    try {
      const current = canonicalSnapshot(project.getSnapshot());
      await loadRevision(current.metadata.id);
    } catch (error) {
      report(error);
    }
  }

  function detach() {
    unsubscribe?.();
    unsubscribe = null;
    cancelTimer();
  }

  function stop() {
    detach();
    pending = null;
  }

  async function quiesce({ flushPending = false } = {}) {
    detach();
    if (flushPending && pending) {
      try {
        await flush();
      } catch {
        // The current in-memory project remains authoritative when persistence fails.
      }
    } else {
      pending = null;
    }
    if (activeFlush) {
      try {
        await activeFlush;
      } catch {
        // The write was already reported by flush; destructive callers only need it settled.
      }
    }
    pending = null;
  }

  function setBarrier(barrier) {
    if (typeof barrier !== 'function') throw new TypeError('Autosave barrier must be a function.');
    writeBarrier = barrier;
  }

  async function discard(projectId) {
    cancelTimer();
    pending = null;
    if (activeFlush) {
      try {
        await activeFlush;
      } catch {
        // A failed write must still be removable after an explicit save.
      }
    }
    revisions.delete(projectId);
    await database.deleteAutosave(projectId);
  }

  async function getRecoveryCandidate(projectId, persistedExplicitSaveAt) {
    let record;
    try {
      record = await database.getAutosave(projectId);
    } catch (error) {
      report(error);
      return null;
    }
    const explicitSaveAt = Math.max(
      project.getLastExplicitSaveAt(),
      validTimestamp(persistedExplicitSaveAt) ? persistedExplicitSaveAt : 0
    );
    return normalizeRecoveryCandidate(record, projectId, explicitSaveAt);
  }

  async function applyRecovery(value, projectId, apply) {
    if (typeof apply !== 'function') throw new TypeError('Recovery apply callback is required.');
    applyingRecovery = true;
    try {
      await apply(value);
      cancelTimer();
      pending = null;
      revisions.delete(projectId);
      await database.deleteAutosave(projectId);
    } finally {
      applyingRecovery = false;
    }
  }

  function restore(candidate, apply) {
    if (!candidate?.projectId) throw new TypeError('Recovery candidate is required.');
    return applyRecovery(candidate, candidate.projectId, apply);
  }

  function startFresh(projectId, apply) {
    return applyRecovery(createProject({ metadata: { id: projectId } }), projectId, apply);
  }

  return {
    start,
    stop,
    quiesce,
    setBarrier,
    discard,
    flush,
    getRecoveryCandidate,
    restore,
    startFresh,
  };
}

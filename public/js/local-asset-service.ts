import { validateCanvasImageFile } from './canvas-asset-registry.js';
import { assertOpaqueAssetId } from './canvas-scene.js';

function stableAssetId(value) {
  if (typeof value === 'string' && value.toLowerCase().startsWith('blob:')) {
    throw new TypeError('Project asset references cannot contain blob URLs');
  }
  return assertOpaqueAssetId(value);
}

export function referencedAssetIds(project: any = {}) {
  const ids = [];
  const background = project?.canvas?.background;
  if (background?.type === 'image' && background.assetId) {
    ids.push(stableAssetId(background.assetId));
  }
  for (const layer of Array.isArray(project?.layers) ? project.layers : []) {
    if (layer?.kind === 'image' && layer.assetId) ids.push(stableAssetId(layer.assetId));
  }
  return [...new Set(ids)];
}

function persistentRecord(record) {
  const id = stableAssetId(record?.id);
  const blob = record?.blob;
  if (record?.type && blob?.type && record.type !== blob.type) {
    throw new TypeError('Persisted image type does not match the Blob type');
  }
  const type = blob?.type || record?.type;
  const validation = validateCanvasImageFile({
    type,
    size: blob?.size,
  });
  if (!validation.valid) throw new TypeError(validation.error);
  const width = Number(record?.width);
  const height = Number(record?.height);
  return {
    id,
    name: typeof record.name === 'string' && record.name.length > 0 ? record.name : 'image',
    type,
    size: blob.size,
    width: Number.isFinite(width) ? width : undefined,
    height: Number.isFinite(height) ? height : undefined,
    blob,
  };
}

function preparedCleanup(prepared, activatedIds, assetRegistry) {
  let firstError;
  for (const id of [...activatedIds].reverse()) {
    try {
      assetRegistry.remove(id);
    } catch (error) {
      firstError ??= error;
    }
  }
  for (const entry of prepared) {
    try {
      if (!entry.rollback?.()) entry.dispose();
    } catch (error) {
      firstError ??= error;
    }
  }
  return firstError;
}

export function createLocalAssetService({ database, assetRegistry }: any = {}) {
  if (!database || !assetRegistry) {
    throw new TypeError('Local asset service dependencies are required');
  }

  async function persist(record) {
    const stored = persistentRecord(record);
    await database.putAsset(stored);
    return stored;
  }

  async function stage(records = []) {
    if (!Array.isArray(records)) throw new TypeError('Asset stage records must be an array');
    const normalized = records.map(persistentRecord);
    const ids = normalized.map(({ id }) => id);
    if (new Set(ids).size !== ids.length) throw new Error('Asset stage contains duplicate IDs');

    const prepared = [];
    try {
      for (const record of normalized) {
        const prepare =
          assetRegistry.has(record.id) && assetRegistry.prepareReplacementWithId
            ? assetRegistry.prepareReplacementWithId
            : assetRegistry.prepareWithId;
        prepared.push(await prepare(record.blob, record));
      }
    } catch (error) {
      preparedCleanup(prepared, [], assetRegistry);
      throw error;
    }

    const activatedIds = [];
    let state = 'prepared';
    const metadata = prepared.map((entry) => ({ ...entry.metadata }));
    return {
      commit() {
        if (state === 'rolledback') throw new Error('Asset stage was rolled back');
        if (state === 'committed') return metadata.map((entry) => ({ ...entry }));
        try {
          for (const entry of prepared) {
            const activated = entry.activate();
            if (!entry.rollback) activatedIds.push(activated.id);
          }
          state = 'committed';
          return metadata.map((entry) => ({ ...entry }));
        } catch (error) {
          preparedCleanup(prepared, activatedIds, assetRegistry);
          state = 'rolledback';
          throw error;
        }
      },
      rollback() {
        if (state === 'rolledback') return false;
        const cleanupError = preparedCleanup(prepared, activatedIds, assetRegistry);
        state = 'rolledback';
        if (cleanupError) throw cleanupError;
        return true;
      },
      finalize() {
        if (state !== 'committed') return false;
        for (const entry of prepared) entry.finalize?.();
        state = 'finalized';
        return true;
      },
    };
  }

  async function hydrateProject(project) {
    const missingRuntimeIds = referencedAssetIds(project).filter((id) => !assetRegistry.has(id));
    if (missingRuntimeIds.length === 0) return [];
    const records = await database.getAssets(missingRuntimeIds);
    const recordsById = new Map(records.map((record) => [record.id, record]));
    const missing = missingRuntimeIds.find((id) => !recordsById.has(id));
    if (missing) throw new Error(`Referenced canvas asset is missing: ${missing}`);
    const staged = await stage(missingRuntimeIds.map((id) => recordsById.get(id)));
    return staged.commit();
  }

  async function removeUnreferenced(project) {
    const referenced = new Set(referencedAssetIds(project));
    const orphanIds = assetRegistry
      .listMetadata()
      .map(({ id }) => id)
      .filter((id) => !referenced.has(id));
    let firstError;
    for (const id of orphanIds) {
      try {
        assetRegistry.remove(id);
      } catch (error) {
        firstError ??= error;
      }
      try {
        await database.deleteAsset(id);
      } catch (error) {
        firstError ??= error;
      }
    }
    if (firstError) throw firstError;
    return orphanIds;
  }

  return { persist, hydrateProject, removeUnreferenced, stage };
}

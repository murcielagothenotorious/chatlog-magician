import { describe, expect, it, vi } from 'vitest';
import { createCanvasAssetRegistry } from '../public/js/canvas-asset-registry.ts';
import { createImageLayer } from '../public/js/canvas-scene.ts';
import { createProject } from '../public/js/project-model.ts';
import { createLocalAssetService, referencedAssetIds } from '../public/js/local-asset-service.ts';

function storedAsset(id, overrides = {}) {
  const blob = overrides.blob ?? new globalThis.Blob([id], { type: 'image/png' });
  return {
    id,
    name: `${id}.png`,
    type: blob.type,
    size: blob.size,
    width: 20,
    height: 10,
    blob,
    ...overrides,
  };
}

function registryHarness(overrides = {}) {
  let sequence = 0;
  const sources = [];
  const revoked = [];
  const registry = createCanvasAssetRegistry({
    createObjectURL: () => `blob:runtime-${(sequence += 1)}`,
    revokeObjectURL: (url) => revoked.push(url),
    decodeImage: async (blob) => {
      if (overrides.failText && (await blob.text()) === overrides.failText) {
        throw new Error('decode failed');
      }
      const source = { width: 20, height: 10, close: vi.fn() };
      sources.push(source);
      return { source, width: 20, height: 10 };
    },
    createId: () => `generated-${sequence}`,
  });
  return { registry, sources, revoked };
}

function databaseHarness(records = []) {
  const byId = new Map(records.map((record) => [record.id, record]));
  return {
    putAsset: vi.fn(async (record) => byId.set(record.id, record)),
    getAssets: vi.fn(async (ids) => ids.map((id) => byId.get(id)).filter(Boolean)),
    deleteAsset: vi.fn(async (id) => byId.delete(id)),
  };
}

describe('persistent canvas assets', () => {
  it('discovers deterministic unique references and rejects transient blob URLs', () => {
    const project = createProject({
      canvas: { background: { type: 'image', assetId: 'background' } },
      layers: [
        createImageLayer({ id: 'one', assetId: 'layer' }),
        createImageLayer({ id: 'two', assetId: 'background' }),
      ],
    });

    expect(referencedAssetIds(project)).toEqual(['background', 'layer']);
    expect(() =>
      referencedAssetIds(
        createProject({ canvas: { background: { type: 'image', assetId: 'blob:unsafe' } } })
      )
    ).toThrow(/blob/i);
  });

  it('persists only stable asset metadata and its blob', async () => {
    const record = storedAsset('asset-1', {
      objectUrl: 'blob:runtime',
      source: { width: 20, height: 10 },
    });
    const database = databaseHarness();
    const { registry } = registryHarness();
    const service = createLocalAssetService({ database, assetRegistry: registry });

    await service.persist(record);

    expect(database.putAsset).toHaveBeenCalledWith({
      id: 'asset-1',
      name: 'asset-1.png',
      type: 'image/png',
      size: record.blob.size,
      width: 20,
      height: 10,
      blob: record.blob,
    });
  });

  it('rejects forged persisted MIME metadata before writing', async () => {
    const database = databaseHarness();
    const { registry } = registryHarness();
    const service = createLocalAssetService({ database, assetRegistry: registry });

    await expect(
      service.persist(
        storedAsset('asset-1', {
          type: 'image/png',
          blob: new globalThis.Blob(['plain'], { type: 'text/plain' }),
        })
      )
    ).rejects.toThrow(/type/i);

    expect(database.putAsset).not.toHaveBeenCalled();
  });

  it('hydrates a stored blob using its original opaque ID', async () => {
    const record = storedAsset('asset-1', { width: 0, height: -1 });
    const database = databaseHarness([record]);
    const { registry } = registryHarness();
    const service = createLocalAssetService({ database, assetRegistry: registry });

    await service.hydrateProject(
      createProject({ canvas: { background: { type: 'image', assetId: 'asset-1' } } })
    );

    expect(database.getAssets).toHaveBeenCalledWith(['asset-1']);
    expect(registry.has('asset-1')).toBe(true);
    expect(registry.get('asset-1').blob).toBe(record.blob);
    expect(registry.metadata('asset-1')).toMatchObject({ width: 20, height: 10 });
  });

  it('does not decode any record when one referenced asset is missing', async () => {
    const database = databaseHarness([storedAsset('asset-1')]);
    const harness = registryHarness();
    const service = createLocalAssetService({ database, assetRegistry: harness.registry });
    const project = createProject({
      layers: [
        createImageLayer({ id: 'l1', assetId: 'asset-1' }),
        createImageLayer({ id: 'l2', assetId: 'asset-missing' }),
      ],
    });

    await expect(service.hydrateProject(project)).rejects.toThrow(/asset-missing/);
    expect(harness.registry.has('asset-1')).toBe(false);
    expect(harness.sources).toEqual([]);
  });

  it('rolls back every prepared source when staged decoding fails', async () => {
    const first = storedAsset('asset-1');
    const broken = storedAsset('asset-broken', {
      blob: new globalThis.Blob(['broken'], { type: 'image/png' }),
    });
    const harness = registryHarness({ failText: 'broken' });
    const service = createLocalAssetService({
      database: databaseHarness(),
      assetRegistry: harness.registry,
    });

    await expect(service.stage([first, broken])).rejects.toThrow('decode failed');

    expect(harness.registry.listMetadata()).toEqual([]);
    expect(harness.sources[0].close).toHaveBeenCalledOnce();
    expect(harness.revoked).toHaveLength(2);
  });

  it('preserves pre-existing runtime assets when project hydration decoding fails', async () => {
    const existing = storedAsset('existing');
    const first = storedAsset('asset-1');
    const broken = storedAsset('asset-broken', {
      blob: new globalThis.Blob(['broken'], { type: 'image/png' }),
    });
    const harness = registryHarness({ failText: 'broken' });
    await harness.registry.addWithId(existing.blob, existing);
    const service = createLocalAssetService({
      database: databaseHarness([first, broken]),
      assetRegistry: harness.registry,
    });
    const project = createProject({
      layers: [
        createImageLayer({ id: 'one', assetId: 'asset-1' }),
        createImageLayer({ id: 'two', assetId: 'asset-broken' }),
      ],
    });

    await expect(service.hydrateProject(project)).rejects.toThrow('decode failed');

    expect(harness.registry.listMetadata().map(({ id }) => id)).toEqual(['existing']);
    expect(harness.sources[0].close).not.toHaveBeenCalled();
    expect(harness.sources[1].close).toHaveBeenCalledOnce();
  });

  it('activates a complete stage atomically and rolls back only its records', async () => {
    const existing = storedAsset('existing');
    const harness = registryHarness();
    await harness.registry.addWithId(existing.blob, existing);
    const service = createLocalAssetService({
      database: databaseHarness(),
      assetRegistry: harness.registry,
    });
    const stage = await service.stage([storedAsset('asset-1'), storedAsset('asset-2')]);
    expect(harness.registry.listMetadata().map(({ id }) => id)).toEqual(['existing']);

    expect(stage.commit().map(({ id }) => id)).toEqual(['asset-1', 'asset-2']);
    expect(harness.registry.listMetadata().map(({ id }) => id)).toEqual([
      'existing',
      'asset-1',
      'asset-2',
    ]);

    expect(stage.rollback()).toBe(true);
    expect(stage.rollback()).toBe(false);
    expect(harness.registry.listMetadata().map(({ id }) => id)).toEqual(['existing']);
  });

  it('replaces a same-id runtime asset and can roll it back before finalization', async () => {
    const original = storedAsset('asset-1', {
      blob: new globalThis.Blob(['old'], { type: 'image/png' }),
    });
    const replacement = storedAsset('asset-1', {
      blob: new globalThis.Blob(['new'], { type: 'image/png' }),
    });
    const harness = registryHarness();
    await harness.registry.addWithId(original.blob, original);
    const service = createLocalAssetService({
      database: databaseHarness(),
      assetRegistry: harness.registry,
    });

    const stage = await service.stage([replacement]);
    stage.commit();
    expect(await harness.registry.get('asset-1').blob.text()).toBe('new');
    stage.rollback();
    expect(await harness.registry.get('asset-1').blob.text()).toBe('old');
  });

  it('does not remove a colliding runtime record if activation races after preparation', async () => {
    const harness = registryHarness();
    const service = createLocalAssetService({
      database: databaseHarness(),
      assetRegistry: harness.registry,
    });
    const stagedRecord = storedAsset('asset-1');
    const stage = await service.stage([stagedRecord]);
    const winner = storedAsset('asset-1', {
      blob: new globalThis.Blob(['winner'], { type: 'image/png' }),
    });
    await harness.registry.addWithId(winner.blob, winner);

    expect(() => stage.commit()).toThrow(/already exists/i);

    expect(harness.registry.has('asset-1')).toBe(true);
    expect(await harness.registry.get('asset-1').blob.text()).toBe('winner');
  });

  it('removes runtime and persisted assets that the project no longer references', async () => {
    const referenced = storedAsset('referenced');
    const orphan = storedAsset('orphan');
    const harness = registryHarness();
    await harness.registry.addWithId(referenced.blob, referenced);
    await harness.registry.addWithId(orphan.blob, orphan);
    const database = databaseHarness([referenced, orphan]);
    const service = createLocalAssetService({ database, assetRegistry: harness.registry });

    const removed = await service.removeUnreferenced(
      createProject({ canvas: { background: { type: 'image', assetId: 'referenced' } } })
    );

    expect(removed).toEqual(['orphan']);
    expect(harness.registry.has('referenced')).toBe(true);
    expect(harness.registry.has('orphan')).toBe(false);
    expect(database.deleteAsset).toHaveBeenCalledWith('orphan');
  });
});

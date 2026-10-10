import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createImageStack } from '../public/js/image-stack.ts';
import { createProject, PROJECT_SCHEMA_VERSION } from '../public/js/project-model.ts';

function createDatabase(entries = [], assets = [], fonts = []) {
  const stackEntries = new Map(entries.map((entry) => [entry.id, entry]));
  const assetRecords = new Map(assets.map((asset) => [asset.id, asset]));
  const fontRecords = new Map(fonts.map((font) => [font.id, font]));
  return {
    putStackEntry: vi.fn(async (entry) => {
      stackEntries.set(entry.id, entry);
    }),
    getStackEntry: vi.fn(async (id) => stackEntries.get(id)),
    listStackEntries: vi.fn(async () =>
      [...stackEntries.values()].sort((left, right) =>
        String(right.createdAt).localeCompare(String(left.createdAt))
      )
    ),
    deleteStackEntries: vi.fn(async (ids) => {
      ids.forEach((id) => stackEntries.delete(id));
    }),
    getAssets: vi.fn(async (ids) => ids.map((id) => assetRecords.get(id)).filter(Boolean)),
    getFonts: vi.fn(async (ids) => ids.map((id) => fontRecords.get(id)).filter(Boolean)),
  };
}

function setup(options = {}) {
  const database = options.database ?? createDatabase();
  const renderer = {
    toBlob: vi.fn(async () => new globalThis.Blob(['png'], { type: 'image/png' })),
  };
  const saveAs = vi.fn();
  const createId = vi.fn(() => 'stack-1');
  const now = vi.fn(() => new Date('2026-07-11T21:34:00.000Z'));
  const stack = createImageStack({ database, renderer, saveAs, createId, now });
  return { stack, database, renderer, saveAs, createId, now };
}

describe('local image stack', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('stores one rendered export with a reopenable canonical project snapshot', async () => {
    const { stack, database, renderer } = setup();
    const project = createProject({
      metadata: { id: 'p1' },
      canvas: { width: 640, height: 360, composition: 'inset', padding: { x: 10, y: 20 } },
    });

    const entry = await stack.save(project, '  Gece Sahnesi  ');

    expect(renderer.toBlob).toHaveBeenCalledWith(project);
    expect(database.putStackEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'stack-1',
        projectId: 'p1',
        name: 'Gece Sahnesi',
        type: 'image/png',
        size: 3,
        width: 660,
        height: 400,
        createdAt: '2026-07-11T21:34:00.000Z',
        project: expect.objectContaining({ schemaVersion: PROJECT_SCHEMA_VERSION }),
      })
    );
    expect(entry.blob).toBeInstanceOf(globalThis.Blob);
    expect(entry.project).not.toBe(project);
  });

  it('uses a timestamped default name and rejects control characters', async () => {
    const { stack } = setup();
    const entry = await stack.save(createProject(), '   ');
    expect(entry.name).toBe('Görsel 2026-07-12 00.34');
    await expect(stack.rename(entry.id, 'bozuk\u0000ad')).rejects.toThrow(/kontrol/i);
  });

  it('clamps names and renames an existing record without changing its image data', async () => {
    const original = {
      id: 'one',
      name: 'Eski',
      createdAt: '2026-07-11T00:00:00.000Z',
      blob: new globalThis.Blob(['png']),
    };
    const database = createDatabase([original]);
    const { stack } = setup({ database });

    const renamed = await stack.rename('one', `  ${'a'.repeat(100)}  `);

    expect(renamed.name).toHaveLength(80);
    expect(renamed.blob).toBe(original.blob);
    expect(database.putStackEntry).toHaveBeenCalledWith({ ...original, name: 'a'.repeat(80) });
  });

  it('selects unique records and bulk deletes only the current selection', async () => {
    const database = createDatabase([
      { id: 'one', createdAt: '2026-07-11T02:00:00.000Z' },
      { id: 'two', createdAt: '2026-07-11T01:00:00.000Z' },
    ]);
    const { stack } = setup({ database });

    stack.select(['one', 'two', 'one']);
    expect(stack.selected()).toEqual(new Set(['one', 'two']));
    expect(await stack.deleteSelected()).toEqual(['one', 'two']);
    expect(database.deleteStackEntries).toHaveBeenCalledTimes(1);
    expect(database.deleteStackEntries).toHaveBeenCalledWith(['one', 'two']);
    expect(stack.selected().size).toBe(0);
  });

  it('downloads selected records newest-first with collision-safe filenames', async () => {
    const entries = [
      {
        id: 'old',
        name: 'Gece: Sahnesi',
        type: 'image/png',
        blob: new globalThis.Blob(['old'], { type: 'image/png' }),
        createdAt: '2026-07-11T01:00:00.000Z',
      },
      {
        id: 'new',
        name: 'Gece: Sahnesi',
        type: 'image/png',
        blob: new globalThis.Blob(['new'], { type: 'image/png' }),
        createdAt: '2026-07-11T02:00:00.000Z',
      },
    ];
    const { stack, saveAs } = setup({ database: createDatabase(entries) });
    stack.select(['old', 'new']);

    await expect(stack.downloadSelected()).resolves.toEqual({
      downloadedIds: ['new', 'old'],
      failedIds: [],
    });
    expect(saveAs.mock.calls.map(([, filename]) => filename)).toEqual([
      'Gece_ Sahnesi.png',
      'Gece_ Sahnesi (2).png',
    ]);
  });

  it('continues selected downloads and reports failed record ids', async () => {
    const entries = ['new', 'middle', 'old'].map((id, index) => ({
      id,
      name: id,
      type: 'image/jpeg',
      blob: new globalThis.Blob([id], { type: 'image/jpeg' }),
      createdAt: `2026-07-11T0${3 - index}:00:00.000Z`,
    }));
    const { stack, saveAs } = setup({ database: createDatabase(entries) });
    saveAs.mockImplementationOnce(() => {}).mockRejectedValueOnce(new Error('blocked'));
    stack.select([...entries.map(({ id }) => id), 'missing']);

    await expect(stack.downloadSelected()).resolves.toEqual({
      downloadedIds: ['new', 'old'],
      failedIds: ['middle', 'missing'],
    });
    expect(saveAs).toHaveBeenCalledTimes(3);
  });

  it('hydrates all dependencies before returning a side-effect-free reopen payload', async () => {
    const asset = { id: 'asset-1', blob: new globalThis.Blob(['image']) };
    const font = {
      id: 'font-1',
      family: 'Custom',
      name: 'custom.woff2',
      type: 'font/woff2',
      size: 4,
      blob: new globalThis.Blob(['font']),
    };
    const project = createProject({
      metadata: { id: 'p1' },
      canvas: { background: { type: 'image', assetId: asset.id } },
      fonts: [font],
    });
    const entry = {
      id: 'stack-1',
      project,
      assetIds: [asset.id],
      fontIds: [font.id],
      createdAt: '2026-07-11T00:00:00.000Z',
    };
    const database = createDatabase([entry], [asset], [font]);
    const { stack } = setup({ database });

    const prepared = await stack.prepareReopen(entry.id);

    expect(prepared).toEqual({ project, assets: [asset], fonts: [font] });
    expect(prepared.project).not.toBe(project);
    expect(database.putStackEntry).not.toHaveBeenCalled();
    expect(database.deleteStackEntries).not.toHaveBeenCalled();
  });

  it('rejects reopen when the record or any declared dependency is missing', async () => {
    const project = createProject({ metadata: { id: 'p1' } });
    const database = createDatabase([
      {
        id: 'stack-1',
        project,
        assetIds: ['missing-asset'],
        fontIds: [],
        createdAt: '2026-07-11T00:00:00.000Z',
      },
    ]);
    const { stack } = setup({ database });

    await expect(stack.prepareReopen('missing-entry')).rejects.toThrow(
      'Bu yığın kaydının proje verileri eksik.'
    );
    await expect(stack.prepareReopen('stack-1')).rejects.toThrow(
      'Bu yığın kaydının proje verileri eksik.'
    );
  });
});

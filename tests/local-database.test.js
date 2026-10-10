import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLocalDatabase } from '../public/js/local-database.ts';

const STORE_NAMES = ['projects', 'assets', 'fonts', 'autosaves', 'imageStack'];

function createRepository(options = {}) {
  return createLocalDatabase({
    indexedDB: options.indexedDB ?? new IDBFactory(),
    name: options.name ?? `test-${globalThis.crypto.randomUUID()}`,
    version: options.version,
  });
}

function openRaw(indexedDB, name, version, upgrade) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = () => upgrade?.(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

describe('local database', () => {
  let database;

  beforeEach(() => {
    database = createRepository();
  });

  afterEach(() => {
    database.close();
  });

  it('creates the five stores and image stack indexes', async () => {
    const connection = await database.open();

    expect([...connection.objectStoreNames].sort()).toEqual([...STORE_NAMES].sort());

    const transaction = connection.transaction('imageStack', 'readonly');
    const store = transaction.objectStore('imageStack');
    expect([...store.indexNames]).toEqual(['createdAt', 'projectId']);
    expect(store.index('createdAt').unique).toBe(false);
    expect(store.index('projectId').unique).toBe(false);
  });

  it('round-trips records and blobs without sharing object references', async () => {
    const project = {
      id: 'project-1',
      title: 'Bir',
      revision: 1,
      savedAt: '2026-07-11T00:00:00.000Z',
      lastExplicitSaveAt: '2026-07-11T00:00:00.000Z',
      project: { chat: { input: 'selam' } },
    };
    const blob = new globalThis.Blob(['png'], { type: 'image/png' });
    const asset = {
      id: 'asset-1',
      name: 'a.png',
      type: blob.type,
      size: blob.size,
      width: 1,
      height: 1,
      blob,
      createdAt: '2026-07-11T00:00:00.000Z',
    };

    await database.putProject(project);
    await database.putAsset(asset);
    project.project.chat.input = 'değişti';

    const storedProject = await database.getProject('project-1');
    const firstAsset = await database.getAsset('asset-1');
    const secondAsset = await database.getAsset('asset-1');

    expect(storedProject.project.chat.input).toBe('selam');
    expect(await firstAsset.blob.text()).toBe('png');
    expect(firstAsset).not.toBe(secondAsset);
    expect(firstAsset.blob).not.toBe(asset.blob);
  });

  it('supports font and autosave CRUD with undefined missing reads', async () => {
    const font = { id: 'font-1', name: 'Özel', blob: new globalThis.Blob(['font']) };
    const autosave = {
      projectId: 'project-1',
      revision: 2,
      savedAt: '2026-07-11T00:01:00.000Z',
      lastExplicitSaveAt: '2026-07-11T00:00:00.000Z',
      project: { chat: { input: 'taslak' } },
      assetIds: [],
      fontIds: ['font-1'],
    };

    await database.putFont(font);
    await database.putAutosave(autosave);
    expect((await database.getFont('font-1')).name).toBe('Özel');
    expect((await database.getAutosave('project-1')).revision).toBe(2);

    await database.deleteFont('font-1');
    await database.deleteAutosave('project-1');
    expect(await database.getFont('font-1')).toBeUndefined();
    expect(await database.getAutosave('project-1')).toBeUndefined();
  });

  it('preserves requested order in bulk reads and omits missing IDs', async () => {
    for (const id of ['a', 'b', 'c']) {
      await database.putAsset({ id, blob: new globalThis.Blob([id]) });
      await database.putFont({ id, blob: new globalThis.Blob([id]) });
    }

    expect((await database.getAssets(['c', 'missing', 'a'])).map(({ id }) => id)).toEqual([
      'c',
      'a',
    ]);
    expect((await database.getFonts(['b', 'missing', 'c'])).map(({ id }) => id)).toEqual([
      'b',
      'c',
    ]);
    expect(await database.getAssets([])).toEqual([]);
  });

  it('lists saved projects newest-first', async () => {
    await database.putProject({ id: 'old', project: {}, savedAt: 10 });
    await database.putProject({ id: 'new', project: {}, savedAt: 20 });

    expect((await database.listProjects()).map(({ id }) => id)).toEqual(['new', 'old']);
  });

  it('lists stack entries newest-first and deletes selected entries', async () => {
    await database.putStackEntry({
      id: 'middle',
      projectId: 'project-1',
      createdAt: '2026-07-11T00:02:00.000Z',
    });
    await database.putStackEntry({
      id: 'old',
      projectId: 'project-1',
      createdAt: '2026-07-11T00:01:00.000Z',
    });
    await database.putStackEntry({
      id: 'new',
      projectId: 'project-2',
      createdAt: '2026-07-11T00:03:00.000Z',
    });

    expect((await database.listStackEntries()).map(({ id }) => id)).toEqual([
      'new',
      'middle',
      'old',
    ]);
    expect((await database.getStackEntry('middle')).projectId).toBe('project-1');

    await database.deleteStackEntries(['new', 'old', 'missing']);
    expect((await database.listStackEntries()).map(({ id }) => id)).toEqual(['middle']);
  });

  it('aborts every write when a multi-store transaction fails', async () => {
    await expect(
      database.transaction(['projects', 'assets'], 'readwrite', async (stores) => {
        await stores.projects.put({ id: 'project-1', title: 'Geçici' });
        await stores.assets.put({ id: 'asset-1', blob: new globalThis.Blob(['x']) });
        throw new Error('abort import');
      })
    ).rejects.toThrow('abort import');

    expect(await database.getProject('project-1')).toBeUndefined();
    expect(await database.getAsset('asset-1')).toBeUndefined();
  });

  it('exposes promise wrappers for all transaction request operations', async () => {
    await database.transaction('projects', 'readwrite', async ({ projects }) => {
      await projects.put({ id: 'one', title: 'Bir' });
      await projects.put({ id: 'two', title: 'İki' });
      expect((await projects.get('one')).title).toBe('Bir');
      expect((await projects.getAll()).map(({ id }) => id)).toEqual(['one', 'two']);
      await projects.delete('one');
      expect(await projects.get('one')).toBeUndefined();
      await projects.clear();
    });

    expect(await database.getProject('two')).toBeUndefined();
  });

  it('clears every local store in one operation', async () => {
    await database.transaction(STORE_NAMES, 'readwrite', async (stores) => {
      await stores.projects.put({ id: 'project-1' });
      await stores.assets.put({ id: 'asset-1' });
      await stores.fonts.put({ id: 'font-1' });
      await stores.autosaves.put({ projectId: 'project-1' });
      await stores.imageStack.put({ id: 'stack-1', createdAt: '2026-07-11T00:00:00.000Z' });
    });

    await database.clearAllLocalData();

    await database.transaction(STORE_NAMES, 'readonly', async (stores) => {
      for (const name of STORE_NAMES) expect(await stores[name].getAll()).toEqual([]);
    });
  });

  it('rejects unavailable IndexedDB with stable Turkish copy', async () => {
    const unavailable = createLocalDatabase({ indexedDB: undefined });
    await expect(unavailable.open()).rejects.toThrow(
      'Yerel depolama bu tarayıcıda kullanılamıyor.'
    );
  });

  it('rejects a blocked upgrade and closes a late connection', async () => {
    const indexedDB = new IDBFactory();
    const name = `blocked-${globalThis.crypto.randomUUID()}`;
    const blocker = await openRaw(indexedDB, name, 1, (connection) => {
      connection.createObjectStore('legacy');
    });
    const upgrading = createRepository({ indexedDB, name, version: 2 });

    await expect(upgrading.open()).rejects.toThrow(/engellendi/i);
    blocker.close();
    upgrading.close();
  });

  it('closes on versionchange and reopens lazily at the upgraded version', async () => {
    const indexedDB = new IDBFactory();
    const name = `upgrade-${globalThis.crypto.randomUUID()}`;
    const original = createRepository({ indexedDB, name, version: 1 });
    const first = await original.open();

    const upgraded = createRepository({ indexedDB, name, version: 2 });
    const second = await upgraded.open();
    expect(first.version).toBe(1);
    expect(second.version).toBe(2);

    upgraded.close();
    const reopened = await original.open();
    expect(reopened.version).toBe(2);
    original.close();
  });
});

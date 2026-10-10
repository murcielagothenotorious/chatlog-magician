import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAutosaveController } from '../public/js/autosave-controller.ts';
import { createProject } from '../public/js/project-model.ts';

function snapshot(input = '', id = 'project-1') {
  return createProject({ metadata: { id }, chat: { input } });
}

function projectHarness(initial = snapshot()) {
  let current = initial;
  let lastExplicitSaveAt = 0;
  const listeners = new Set();

  return {
    getSnapshot: () => globalThis.structuredClone(current),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit(reason, nextSnapshot) {
      current = nextSnapshot;
      for (const listener of listeners) {
        listener({ reason, snapshot: globalThis.structuredClone(nextSnapshot) });
      }
    },
    markExplicitSave(value) {
      lastExplicitSaveAt = value;
    },
    getLastExplicitSaveAt: () => lastExplicitSaveAt,
    listenerCount: () => listeners.size,
  };
}

function databaseHarness(overrides = {}) {
  return {
    getAutosave: vi.fn(async () => undefined),
    putAutosave: vi.fn(async () => {}),
    deleteAutosave: vi.fn(async () => {}),
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('autosave controller', () => {
  it('debounces mutations and writes the latest canonical snapshot once', async () => {
    vi.useFakeTimers();
    const database = databaseHarness();
    const project = projectHarness();
    const collectReferences = vi.fn(() => ({
      assetIds: ['asset-2', 'asset-1', 'asset-2'],
      fontIds: ['font-1', 'font-1'],
    }));
    const autosave = createAutosaveController({
      project,
      database,
      collectReferences,
      now: () => 1000,
    });

    await autosave.start();
    project.emit('commit', snapshot('bir'));
    project.emit('commit', snapshot('iki'));
    await vi.advanceTimersByTimeAsync(799);
    expect(database.putAutosave).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(database.putAutosave).toHaveBeenCalledOnce();
    expect(database.putAutosave.mock.calls[0][0]).toMatchObject({
      projectId: 'project-1',
      revision: 1,
      savedAt: 1000,
      lastExplicitSaveAt: 0,
      project: { chat: expect.objectContaining({ input: 'iki' }) },
      assetIds: ['asset-2', 'asset-1'],
      fontIds: ['font-1'],
    });
    expect(collectReferences).toHaveBeenCalledOnce();
    autosave.stop();
  });

  it('loads the existing revision and increments only after successful writes', async () => {
    const database = databaseHarness({
      getAutosave: vi.fn(async () => ({ revision: 7 })),
    });
    const project = projectHarness();
    const autosave = createAutosaveController({ project, database, now: () => 2000 });

    await autosave.start();
    project.emit('undo', snapshot('geri'));
    await autosave.flush();
    project.emit('redo', snapshot('ileri'));
    await autosave.flush();

    expect(database.putAutosave.mock.calls.map(([record]) => record.revision)).toEqual([8, 9]);
    autosave.stop();
  });

  it('isolates a write failure and retries the newest pending change', async () => {
    const failure = new Error('disk failed');
    const database = databaseHarness({
      putAutosave: vi.fn().mockRejectedValueOnce(failure).mockResolvedValue(undefined),
    });
    const onError = vi.fn();
    const project = projectHarness();
    const autosave = createAutosaveController({ project, database, onError });

    await autosave.start();
    project.emit('commit', snapshot('başarısız'));
    await expect(autosave.flush()).rejects.toBe(failure);
    expect(onError).toHaveBeenCalledWith(
      'Otomatik kayıt başarısız; çalışmaya devam edebilirsiniz.',
      failure
    );

    project.emit('commit', snapshot('en yeni'));
    await autosave.flush();
    expect(database.putAutosave.mock.calls.map(([record]) => record.revision)).toEqual([1, 1]);
    expect(database.putAutosave.mock.calls[1][0].project.chat.input).toBe('en yeni');
    autosave.stop();
  });

  it('flushes immediately and waits for IndexedDB completion', async () => {
    let finishWrite;
    const database = databaseHarness({
      putAutosave: vi.fn(
        () =>
          new Promise((resolve) => {
            finishWrite = resolve;
          })
      ),
    });
    const project = projectHarness();
    const autosave = createAutosaveController({ project, database });
    await autosave.start();
    project.emit('commit', snapshot('bekle'));

    let completed = false;
    const flushing = autosave.flush().then(() => {
      completed = true;
    });
    await vi.waitFor(() => expect(finishWrite).toBeTypeOf('function'));
    expect(completed).toBe(false);
    finishWrite();
    await flushing;
    expect(completed).toBe(true);
    autosave.stop();
  });

  it('quiesces an active write and discards pending work before destructive operations', async () => {
    let finishWrite;
    const database = databaseHarness({
      putAutosave: vi.fn(
        () =>
          new Promise((resolve) => {
            finishWrite = resolve;
          })
      ),
    });
    const project = projectHarness();
    const autosave = createAutosaveController({ project, database });
    await autosave.start();
    project.emit('commit', snapshot('active'));
    const flushing = autosave.flush();
    await vi.waitFor(() => expect(finishWrite).toBeTypeOf('function'));

    let quiesced = false;
    const quiescing = autosave.quiesce().then(() => {
      quiesced = true;
    });
    expect(quiesced).toBe(false);
    finishWrite();
    await Promise.all([flushing, quiescing]);

    project.emit('commit', snapshot('ignored'));
    await autosave.flush();
    expect(database.putAutosave).toHaveBeenCalledOnce();
  });

  it('flushes pending work before quiescing a reversible project replacement', async () => {
    const database = databaseHarness();
    const project = projectHarness();
    const autosave = createAutosaveController({ project, database, now: () => 1000 });
    await autosave.start();
    project.emit('commit', snapshot('pending'));

    await autosave.quiesce({ flushPending: true });

    expect(database.putAutosave).toHaveBeenCalledWith(
      expect.objectContaining({
        project: expect.objectContaining({ chat: expect.objectContaining({ input: 'pending' }) }),
      })
    );
    expect(project.listenerCount()).toBe(0);
  });

  it('subscribes once, ignores unrelated events, and disposes timers/listeners', async () => {
    vi.useFakeTimers();
    const database = databaseHarness();
    const project = projectHarness();
    const autosave = createAutosaveController({ project, database });

    await autosave.start();
    await autosave.start();
    expect(project.listenerCount()).toBe(1);
    project.emit('selection', snapshot('yok'));
    await vi.advanceTimersByTimeAsync(800);
    expect(database.putAutosave).not.toHaveBeenCalled();

    project.emit('replace', snapshot('iptal'));
    autosave.stop();
    expect(project.listenerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(800);
    expect(database.putAutosave).not.toHaveBeenCalled();
  });

  it('offers recovery only when a valid autosave is newer than the explicit save', async () => {
    const project = projectHarness();
    const candidate = {
      projectId: 'project-1',
      savedAt: 2000,
      lastExplicitSaveAt: 1000,
      revision: 3,
      project: snapshot('kurtar'),
      assetIds: ['asset-1'],
      fontIds: ['font-1'],
    };
    const database = databaseHarness({ getAutosave: vi.fn(async () => candidate) });
    const autosave = createAutosaveController({ project, database });

    await expect(autosave.getRecoveryCandidate('project-1')).resolves.toMatchObject({
      revision: 3,
      project: { chat: expect.objectContaining({ input: 'kurtar' }) },
    });
    project.markExplicitSave(3000);
    await expect(autosave.getRecoveryCandidate('project-1')).resolves.toBeNull();
  });

  it('uses a persisted explicit-save timestamp when checking recovery after reload', async () => {
    const candidate = {
      projectId: 'project-1',
      savedAt: 2000,
      lastExplicitSaveAt: 0,
      revision: 1,
      project: snapshot('stale'),
    };
    const autosave = createAutosaveController({
      project: projectHarness(),
      database: databaseHarness({ getAutosave: vi.fn(async () => candidate) }),
    });

    await expect(autosave.getRecoveryCandidate('project-1', 3000)).resolves.toBeNull();
  });

  it.each([
    { projectId: 'other', savedAt: 2, lastExplicitSaveAt: 0, revision: 1, project: snapshot() },
    {
      projectId: 'project-1',
      savedAt: -1,
      lastExplicitSaveAt: 0,
      revision: 1,
      project: snapshot(),
    },
    { projectId: 'project-1', savedAt: 2, lastExplicitSaveAt: 0, revision: 0, project: snapshot() },
    {
      projectId: 'project-1',
      savedAt: 2,
      lastExplicitSaveAt: 0,
      revision: 1,
      project: { schemaVersion: 999 },
    },
  ])('rejects a malformed recovery candidate %#', async (record) => {
    const database = databaseHarness({ getAutosave: vi.fn(async () => record) });
    const autosave = createAutosaveController({ project: projectHarness(), database });
    await expect(autosave.getRecoveryCandidate('project-1')).resolves.toBeNull();
  });

  it('restores before deleting and ignores the replacement event emitted by apply', async () => {
    const calls = [];
    const project = projectHarness();
    const database = databaseHarness({
      deleteAutosave: vi.fn(async () => calls.push('delete')),
    });
    const autosave = createAutosaveController({ project, database });
    await autosave.start();
    const candidate = {
      projectId: 'project-1',
      revision: 2,
      savedAt: 2,
      lastExplicitSaveAt: 0,
      project: snapshot('restore'),
      assetIds: [],
      fontIds: [],
    };

    await autosave.restore(candidate, async (received) => {
      calls.push('apply');
      expect(received).toBe(candidate);
      project.emit('replace', received.project);
    });

    expect(calls).toEqual(['apply', 'delete']);
    expect(database.putAutosave).not.toHaveBeenCalled();
    autosave.stop();
  });

  it('preserves a recovery record when restore apply fails', async () => {
    const database = databaseHarness();
    const autosave = createAutosaveController({ project: projectHarness(), database });
    const failure = new Error('apply failed');

    await expect(
      autosave.restore({ projectId: 'project-1' }, async () => {
        throw failure;
      })
    ).rejects.toBe(failure);
    expect(database.deleteAutosave).not.toHaveBeenCalled();
  });

  it('starts fresh with the same project ID before deleting recovery', async () => {
    const calls = [];
    const project = projectHarness();
    const database = databaseHarness({
      deleteAutosave: vi.fn(async () => calls.push('delete')),
    });
    const autosave = createAutosaveController({ project, database });
    await autosave.start();

    await autosave.startFresh('project-1', async (fresh) => {
      calls.push('apply');
      expect(fresh.metadata.id).toBe('project-1');
      expect(fresh.chat.input).toBe('');
      project.emit('replace', fresh);
    });

    expect(calls).toEqual(['apply', 'delete']);
    expect(database.putAutosave).not.toHaveBeenCalled();
    autosave.stop();
  });
});

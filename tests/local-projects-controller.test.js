import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TextEncoder } from 'node:util';
import {
  createLocalProjectsController,
  initializeLocalProjectsController,
} from '../public/js/local-projects-controller.ts';
import { createProject } from '../public/js/project-model.ts';

class FakeElement {
  constructor(id) {
    this.id = id;
    this.textContent = '';
    this.disabled = false;
    this.hidden = false;
    this.value = '';
    this.files = [];
    this.open = false;
    this.dataset = {};
    this.children = [];
    this.listeners = new Map();
    this.classList = { toggle: vi.fn() };
  }

  addEventListener(type, listener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  removeEventListener(type, listener) {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((candidate) => candidate !== listener)
    );
  }

  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ currentTarget: this, target: this, preventDefault() {}, ...event });
    }
  }

  click() {
    this.dispatch('click');
  }

  showModal() {
    this.open = true;
  }

  close() {
    this.open = false;
    this.dispatch('close');
  }

  replaceChildren(...children) {
    this.children = children;
  }

  append(...children) {
    this.children.push(...children);
  }

  setAttribute(name, value) {
    this[name] = String(value);
  }

  focus() {}
}

function createDocument() {
  const ids = [
    'projectNew',
    'projectOpen',
    'projectSave',
    'projectLocal',
    'projectStack',
    'projectFonts',
    'projectSnapshot',
    'projectFileInput',
    'projectFontInput',
    'projectStatus',
    'recoveryDialog',
    'recoveryRestore',
    'recoveryFresh',
    'localProjectsDialog',
    'localProjectsList',
    'imageStackDialog',
    'imageStackList',
    'imageStackSave',
    'imageStackDownloadSelected',
    'imageStackDeleteSelected',
    'customFontsDialog',
    'customFontsList',
    'customFontAdd',
    'clearLocalData',
    'clearLocalDialog',
    'clearLocalConfirm',
    'modeCanvas',
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement(id)]));
  return {
    defaultView: { confirm: vi.fn(() => true), prompt: vi.fn(() => 'Özel Font') },
    getElementById: (id) => elements[id] ?? null,
    createElement: (tag) => {
      const element = new FakeElement();
      element.tagName = tag.toUpperCase();
      return element;
    },
    elements,
  };
}

function stageHarness(name, order) {
  return {
    commit: vi.fn(async () => order.push(`${name}:commit`)),
    rollback: vi.fn(async () => order.push(`${name}:rollback`)),
  };
}

function bundle() {
  return {
    project: createProject({ metadata: { id: 'imported', title: 'Imported' } }),
    assets: [{ id: 'asset-1', blob: new globalThis.Blob(['asset']) }],
    fonts: [{ id: 'font-1', blob: new globalThis.Blob(['font']) }],
    savedAt: 1000,
  };
}

function setup(overrides = {}) {
  const document = createDocument();
  let snapshot = createProject({ metadata: { id: 'current', title: 'Current' } });
  const projectListeners = new Set();
  const emitProject = (reason) => {
    for (const listener of projectListeners) {
      listener({ reason, snapshot: globalThis.structuredClone(snapshot) });
    }
  };
  const project = {
    getSnapshot: vi.fn(() => globalThis.structuredClone(snapshot)),
    captureCurrentChat: vi.fn(() => globalThis.structuredClone(snapshot)),
    replaceSnapshot: vi.fn((next) => {
      snapshot = globalThis.structuredClone(next);
      emitProject('replace');
      return globalThis.structuredClone(snapshot);
    }),
    commit: vi.fn((mutator) => {
      const draft = globalThis.structuredClone(snapshot);
      mutator(draft);
      snapshot = createProject(draft);
      emitProject('commit');
      return globalThis.structuredClone(snapshot);
    }),
    subscribe: vi.fn((listener) => {
      projectListeners.add(listener);
      return () => projectListeners.delete(listener);
    }),
    markExplicitSave: vi.fn(),
    getLastExplicitSaveAt: vi.fn(() => 0),
    clearHistory: vi.fn(),
  };
  const transaction = vi.fn(async (_stores, _mode, callback) =>
    callback({
      projects: { get: vi.fn(), put: vi.fn(async () => {}), delete: vi.fn(async () => {}) },
      assets: { get: vi.fn(), put: vi.fn(async () => {}), delete: vi.fn(async () => {}) },
      fonts: { get: vi.fn(), put: vi.fn(async () => {}), delete: vi.fn(async () => {}) },
    })
  );
  const database = {
    open: vi.fn(async () => {}),
    close: vi.fn(),
    transaction,
    getAssets: vi.fn(async () => []),
    getFonts: vi.fn(async () => []),
    getProject: vi.fn(async () => null),
    listProjects: vi.fn(async () => []),
    putProject: vi.fn(async () => {}),
    getAutosave: vi.fn(async () => undefined),
    putAutosave: vi.fn(async () => {}),
    deleteAutosave: vi.fn(async () => {}),
    clearAllLocalData: vi.fn(async () => {}),
  };
  const order = [];
  const assetStage = stageHarness('assets', order);
  const fontStage = stageHarness('fonts', order);
  assetStage.finalize = vi.fn(async () => {});
  fontStage.finalize = vi.fn(async () => {});
  const assetService = {
    stage: vi.fn(async () => {
      order.push('assets:stage');
      return assetStage;
    }),
    hydrateProject: vi.fn(async () => []),
    removeUnreferenced: vi.fn(async () => []),
    clear: vi.fn(),
  };
  const fontService = {
    stage: vi.fn(async () => {
      order.push('fonts:stage');
      return fontStage;
    }),
    hydrate: vi.fn(async () => []),
    add: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
    list: vi.fn(() => []),
    pruneRuntime: vi.fn(),
  };
  const autosave = {
    start: vi.fn(async () => {}),
    stop: vi.fn(),
    quiesce: vi.fn(async () => {}),
    setBarrier: vi.fn(),
    discard: vi.fn(async () => {}),
    flush: vi.fn(async () => {}),
    getRecoveryCandidate: vi.fn(async () => null),
    restore: vi.fn(),
    startFresh: vi.fn(),
  };
  const imageStack = {
    save: vi.fn(),
    list: vi.fn(async () => []),
    select: vi.fn(),
    selected: vi.fn(() => new Set()),
    rename: vi.fn(),
    deleteSelected: vi.fn(),
    download: vi.fn(),
    downloadSelected: vi.fn(),
    prepareReopen: vi.fn(),
  };
  const dependencies = {
    document,
    project,
    canvas: {
      refresh: vi.fn(async () => {}),
      listAssets: vi.fn(() => []),
      removeAsset: vi.fn(),
    },
    database,
    assetService,
    fontService,
    autosave,
    imageStack,
    readBcmagFile: vi.fn(async () => bundle()),
    createBcmagFile: vi.fn(async () => new globalThis.Blob(['bcmag'])),
    saveAs: vi.fn(async () => {}),
    applyProjectState: vi.fn(),
    createProject,
    now: vi.fn(() => 2000),
    confirm: vi.fn(() => true),
    ...overrides,
  };
  const controller = createLocalProjectsController(dependencies);
  return {
    controller,
    dependencies,
    document,
    project,
    database,
    assetService,
    fontService,
    assetStage,
    fontStage,
    autosave,
    order,
  };
}

describe('local projects controller', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('opens a project only after assets and fonts persist and stage successfully', async () => {
    const { controller, dependencies, database, project, order } = setup();

    await expect(controller.openFile(new globalThis.Blob(['{}']))).resolves.toBe(true);

    expect(order).toEqual(['assets:stage', 'fonts:stage', 'assets:commit', 'fonts:commit']);
    expect(database.transaction).toHaveBeenCalledWith(
      ['projects', 'assets', 'fonts'],
      'readwrite',
      expect.any(Function)
    );
    expect(project.replaceSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ title: 'Imported' }) })
    );
    expect(dependencies.canvas.refresh).toHaveBeenCalled();
    expect(project.markExplicitSave).toHaveBeenCalledWith(1000);
  });

  it('rolls back staged resources and preserves current state when persistence fails', async () => {
    const { controller, database, assetStage, fontStage, project, document } = setup();
    database.transaction.mockRejectedValueOnce(new Error('quota'));

    await expect(controller.openFile(new globalThis.Blob(['{}']))).resolves.toBe(false);

    expect(assetStage.rollback).toHaveBeenCalled();
    expect(fontStage.rollback).toHaveBeenCalled();
    expect(project.replaceSnapshot).not.toHaveBeenCalled();
    expect(document.elements.projectStatus.textContent).toMatch(/açılamadı/i);
  });

  it('saves a BCMAG only after chat capture, autosave flush, and dependencies load', async () => {
    const { controller, dependencies, database, autosave, project } = setup();
    const current = project.getSnapshot();
    current.canvas.background = { type: 'image', assetId: 'asset-1' };
    current.fonts = [
      { id: 'font-1', family: 'Local', name: 'local.woff2', type: 'font/woff2', size: 4 },
    ];
    project.captureCurrentChat.mockReturnValue(current);
    database.getAssets.mockResolvedValue([{ id: 'asset-1' }]);
    database.getFonts.mockResolvedValue([{ id: 'font-1' }]);

    await expect(controller.saveFile()).resolves.toBe(true);

    expect(autosave.flush).toHaveBeenCalledBefore(dependencies.createBcmagFile);
    expect(dependencies.createBcmagFile).toHaveBeenCalledWith(
      expect.objectContaining({
        project: current,
        assets: [{ id: 'asset-1' }],
        fonts: [{ id: 'font-1' }],
      })
    );
    expect(dependencies.saveAs).toHaveBeenCalledWith(expect.any(globalThis.Blob), 'Current.bcmag');
    expect(project.markExplicitSave).toHaveBeenCalledWith(2000);
    expect(database.putProject).toHaveBeenCalledWith({
      id: 'current',
      project: current,
      savedAt: 2000,
    });
  });

  it('exports BCMAG bytes for cloud sync without downloading or advancing explicit-save state', async () => {
    const { controller, dependencies, autosave, project } = setup();

    await expect(controller.exportProjectBytes()).resolves.toEqual(
      new Uint8Array(new TextEncoder().encode('bcmag'))
    );

    expect(autosave.flush).toHaveBeenCalledBefore(dependencies.createBcmagFile);
    expect(dependencies.saveAs).not.toHaveBeenCalled();
    expect(project.markExplicitSave).not.toHaveBeenCalled();
  });

  it('imports cloud BCMAG bytes through the same atomic staging path', async () => {
    const { controller, dependencies, project, assetStage, fontStage } = setup();
    const bytes = new TextEncoder().encode('{encrypted-then-decrypted-bcmag}');

    await expect(controller.importProjectBytes(bytes)).resolves.toBe(true);

    expect(dependencies.readBcmagFile).toHaveBeenCalledWith(expect.any(globalThis.Blob));
    expect(assetStage.commit).toHaveBeenCalled();
    expect(fontStage.commit).toHaveBeenCalled();
    expect(project.replaceSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ title: 'Imported' }) })
    );
  });

  it('rejects invalid cloud bytes before changing the active project', async () => {
    const { controller, dependencies, project } = setup();

    await expect(controller.importProjectBytes('not-bytes')).resolves.toBe(false);

    expect(dependencies.readBcmagFile).not.toHaveBeenCalled();
    expect(project.replaceSnapshot).not.toHaveBeenCalled();
  });

  it('does not advance explicit-save state when browser download fails', async () => {
    const saveAs = vi.fn(async () => {
      throw new Error('blocked');
    });
    const { controller, project, database } = setup({ saveAs });

    await expect(controller.saveFile()).resolves.toBe(false);

    expect(project.markExplicitSave).not.toHaveBeenCalled();
    expect(database.putProject).not.toHaveBeenCalled();
  });

  it('still exports BCMAG when an autosave write fails', async () => {
    const { controller, dependencies, autosave, project } = setup();
    autosave.flush.mockRejectedValueOnce(new Error('quota'));

    await expect(controller.saveFile()).resolves.toBe(true);

    expect(dependencies.saveAs).toHaveBeenCalled();
    expect(project.markExplicitSave).toHaveBeenCalledWith(2000);
  });

  it('restores the previous project and staged registries when rendering the import fails', async () => {
    const canvas = { refresh: vi.fn(async () => Promise.reject(new Error('render'))) };
    const { controller, project, assetStage, fontStage, document, dependencies } = setup({
      canvas,
    });
    const previous = project.getSnapshot();

    await expect(controller.openFile(new globalThis.Blob(['{}']))).resolves.toBe(false);

    expect(project.replaceSnapshot).toHaveBeenLastCalledWith(previous);
    expect(assetStage.rollback).toHaveBeenCalled();
    expect(fontStage.rollback).toHaveBeenCalled();
    expect(dependencies.database.transaction).toHaveBeenCalledTimes(2);
    expect(document.elements.projectStatus.textContent).toBe(
      'Proje açılamadı; önceki çalışmanız korundu.'
    );
  });

  it('quiesces autosave before an import and restores its record after a late render failure', async () => {
    const order = [];
    const autosaveRecord = { projectId: 'current', revision: 4, savedAt: 1200 };
    const autosave = {
      start: vi.fn(async () => order.push('autosave:start')),
      stop: vi.fn(),
      quiesce: vi.fn(async () => order.push('autosave:quiesce')),
      setBarrier: vi.fn(),
      discard: vi.fn(async () => {}),
      flush: vi.fn(async () => {}),
      getRecoveryCandidate: vi.fn(async () => null),
      restore: vi.fn(),
      startFresh: vi.fn(),
    };
    const canvas = {
      refresh: vi.fn(async () => {
        order.push('render');
        throw new Error('render');
      }),
      listAssets: vi.fn(() => []),
      removeAsset: vi.fn(),
    };
    const { controller, database, assetService } = setup({ autosave, canvas });
    database.getAutosave.mockResolvedValue(autosaveRecord);
    assetService.stage.mockImplementation(async () => {
      order.push('asset:stage');
      return stageHarness('assets', order);
    });

    await expect(controller.openFile(new globalThis.Blob(['{}']))).resolves.toBe(false);

    expect(order.indexOf('autosave:quiesce')).toBeLessThan(order.indexOf('asset:stage'));
    expect(database.putAutosave).toHaveBeenCalledWith(autosaveRecord);
    expect(autosave.start).toHaveBeenCalled();
  });

  it('discards stale autosave recovery after an explicit file save', async () => {
    const { controller, autosave } = setup();

    await controller.saveFile();

    expect(autosave.discard).toHaveBeenCalledWith('current');
  });

  it('disables only storage-backed controls when IndexedDB is unavailable', async () => {
    const { controller, database, document } = setup();
    database.open.mockRejectedValueOnce(new Error('unavailable'));

    await controller.start();

    expect(document.elements.projectOpen.disabled).toBe(false);
    expect(document.elements.projectSave.disabled).toBe(false);
    expect(document.elements.projectSnapshot.disabled).toBe(true);
    expect(document.elements.projectStack.disabled).toBe(true);
    expect(document.elements.projectFonts.disabled).toBe(true);
    expect(document.elements.projectStatus.textContent).toBe(
      'Yerel depolama kullanılamıyor; dosya ile kaydetmeye devam edebilirsiniz.'
    );
  });

  it('checks recovery for the last active project id after a reload', async () => {
    const candidate = {
      projectId: 'previous',
      project: createProject({ metadata: { id: 'previous' } }),
    };
    const storage = {
      getItem: vi.fn(() => 'previous'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    const { controller, autosave, document } = setup({ storage });
    autosave.getRecoveryCandidate.mockResolvedValueOnce(candidate);

    await controller.start();

    expect(autosave.getRecoveryCandidate).toHaveBeenCalledWith('previous');
    expect(document.elements.recoveryDialog.open).toBe(false);

    document.elements.modeCanvas.dispatch('click');
    expect(document.elements.recoveryDialog.open).toBe(true);
  });

  it('clears local data only after confirmation and replaces the current project', async () => {
    const confirm = vi.fn(() => false);
    const { controller, database, project, fontService, dependencies } = setup({ confirm });

    await expect(controller.clearLocalData()).resolves.toBe(false);
    expect(database.clearAllLocalData).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    await expect(controller.clearLocalData()).resolves.toBe(true);
    expect(database.clearAllLocalData).toHaveBeenCalled();
    expect(fontService.clear).toHaveBeenCalled();
    expect(project.replaceSnapshot).toHaveBeenCalledWith(expect.objectContaining({ blocks: [] }));
    expect(dependencies.autosave.start).toHaveBeenCalled();
  });

  it('waits for autosave quiescence before clearing storage', async () => {
    const order = [];
    const { controller, autosave, database } = setup();
    autosave.quiesce.mockImplementation(async () => order.push('quiesce'));
    database.clearAllLocalData.mockImplementation(async () => order.push('clear'));

    await controller.clearLocalData(true);

    expect(order).toEqual(['quiesce', 'clear']);
  });

  it('waits for queued dependency persistence before clearing storage', async () => {
    const order = [];
    let releaseAssets;
    const assetsBlocked = new Promise((resolve) => {
      releaseAssets = resolve;
    });
    const { controller, project, database } = setup();
    database.getAssets.mockImplementation(async () => {
      order.push('dependencies:start');
      await assetsBlocked;
      order.push('dependencies:end');
      return [];
    });
    database.clearAllLocalData.mockImplementation(async () => order.push('clear'));
    await controller.start();
    project.commit((draft) => {
      draft.chat.input = 'pending';
    });

    const clearing = controller.clearLocalData(true);
    await vi.waitFor(() => expect(order).toContain('dependencies:start'));
    expect(order).not.toContain('clear');
    releaseAssets();
    await clearing;

    expect(order.indexOf('dependencies:end')).toBeLessThan(order.indexOf('clear'));
  });

  it('uses the saved snapshot timestamp as the active project explicit-save baseline', async () => {
    const { controller, database, project } = setup();
    database.getProject.mockResolvedValue({
      id: 'saved',
      project: createProject({ metadata: { id: 'saved', title: 'Saved' } }),
      savedAt: 777,
    });

    await expect(controller.openSnapshot('saved')).resolves.toBe(true);

    expect(project.markExplicitSave).toHaveBeenLastCalledWith(777);
  });

  it('restarts autosave and preserves the project when storage clearing fails', async () => {
    const { controller, database, project, autosave } = setup();
    const previous = project.getSnapshot();
    database.clearAllLocalData.mockRejectedValueOnce(new Error('blocked'));

    await expect(controller.clearLocalData(true)).resolves.toBe(false);

    expect(project.replaceSnapshot).not.toHaveBeenCalled();
    expect(project.getSnapshot()).toEqual(previous);
    expect(autosave.start).toHaveBeenCalled();
  });

  it('finishes a successful clear when one runtime registry cleanup throws', async () => {
    const canvas = {
      refresh: vi.fn(async () => {}),
      clearAssets: vi.fn(() => {
        throw new Error('cleanup');
      }),
      listAssets: vi.fn(() => []),
      removeAsset: vi.fn(),
    };
    const { controller, project, autosave, fontService } = setup({ canvas });

    await expect(controller.clearLocalData(true)).resolves.toBe(true);

    expect(fontService.clear).toHaveBeenCalled();
    expect(project.replaceSnapshot).toHaveBeenCalled();
    expect(autosave.start).toHaveBeenCalled();
  });

  it('keeps recovery available and reports dependency load failures', async () => {
    const candidate = {
      projectId: 'current',
      project: createProject({ metadata: { id: 'current' } }),
      assetIds: ['missing'],
      fontIds: [],
    };
    const { controller, autosave, database, document } = setup();
    autosave.getRecoveryCandidate.mockResolvedValueOnce(candidate);
    database.getAssets.mockRejectedValueOnce(new Error('read failed'));
    await controller.start();
    document.elements.modeCanvas.dispatch('click');

    document.elements.recoveryRestore.click();
    await vi.waitFor(() =>
      expect(document.elements.projectStatus.textContent).toBe('Otomatik kayıt geri yüklenemedi.')
    );

    expect(document.elements.recoveryDialog.open).toBe(true);
    expect(autosave.restore).not.toHaveBeenCalled();
  });

  it('restores font metadata when persistent font deletion fails', async () => {
    const font = {
      id: 'font-1',
      family: 'Local Font',
      name: 'local.woff2',
      type: 'font/woff2',
      size: 8,
    };
    const { controller, project, fontService, document } = setup();
    project.commit((draft) => {
      draft.fonts = [font];
    });
    project.commit.mockClear();
    fontService.list.mockReturnValue([{ ...font, blob: new globalThis.Blob(['font']) }]);
    fontService.remove.mockRejectedValueOnce(new Error('delete failed'));

    await controller.showFonts();
    document.elements.customFontsList.children[0].children[1].click();
    await vi.waitFor(() => expect(fontService.remove).toHaveBeenCalledWith('font-1'));

    expect(project.getSnapshot().fonts).toEqual([font]);
    expect(document.elements.projectStatus.textContent).toBe('delete failed');
  });

  it('does not delete persisted font data when the project update fails', async () => {
    const font = {
      id: 'font-1',
      family: 'Local Font',
      name: 'local.woff2',
      type: 'font/woff2',
      size: 8,
    };
    const { controller, project, fontService, document } = setup();
    project.commit((draft) => {
      draft.fonts = [font];
    });
    project.replaceSnapshot.mockImplementationOnce(() => {
      throw new Error('model failed');
    });
    fontService.list.mockReturnValue([{ ...font, blob: new globalThis.Blob(['font']) }]);

    await controller.showFonts();
    document.elements.customFontsList.children[0].children[1].click();
    await vi.waitFor(() =>
      expect(document.elements.projectStatus.textContent).toBe('model failed')
    );

    expect(fontService.remove).not.toHaveBeenCalled();
    expect(project.getSnapshot().fonts).toEqual([font]);
  });

  it('removes font metadata non-undoably so undo cannot restore a deleted binary', async () => {
    const font = {
      id: 'font-1',
      family: 'Local Font',
      name: 'local.woff2',
      type: 'font/woff2',
      size: 8,
    };
    const { controller, project, fontService, document } = setup();
    project.commit((draft) => {
      draft.fonts = [font];
    });
    project.commit.mockClear();
    project.replaceSnapshot.mockClear();
    fontService.list.mockReturnValue([{ ...font, blob: new globalThis.Blob(['font']) }]);

    await controller.showFonts();
    document.elements.customFontsList.children[0].children[1].click();
    await vi.waitFor(() => expect(fontService.remove).toHaveBeenCalledWith('font-1'));

    expect(project.commit).not.toHaveBeenCalled();
    expect(project.replaceSnapshot).toHaveBeenCalledWith(expect.objectContaining({ fonts: [] }));
  });

  it('refuses to delete a custom font referenced by a canvas chat block', async () => {
    const font = {
      id: 'font-1',
      family: 'Local Font',
      name: 'local.woff2',
      type: 'font/woff2',
      size: 8,
    };
    const { controller, project, fontService, document } = setup();
    project.commit((draft) => {
      draft.fonts = [font];
      draft.blocks = [
        {
          id: 'chat-1',
          kind: 'chat',
          name: 'Block',
          input: 'x',
          style: { font: 'Local Font' },
        },
      ];
    });
    fontService.list.mockReturnValue([{ ...font, blob: new globalThis.Blob(['font']) }]);

    await controller.showFonts();
    document.elements.customFontsList.children[0].children[1].click();
    await vi.waitFor(() =>
      expect(document.elements.projectStatus.textContent).toMatch(/kullanılıyor/i)
    );

    expect(fontService.remove).not.toHaveBeenCalled();
    expect(project.getSnapshot().fonts).toEqual([font]);
  });

  it('renders and opens the local snapshots dialog from the toolbar', async () => {
    const { controller, database, document } = setup();
    database.listProjects.mockResolvedValueOnce([
      {
        id: 'saved',
        project: createProject({ metadata: { id: 'saved', title: 'Saved' } }),
        savedAt: 7,
      },
    ]);
    await controller.start();

    document.elements.projectLocal.click();
    await vi.waitFor(() => expect(document.elements.localProjectsDialog.open).toBe(true));

    expect(document.elements.localProjectsList.children[0].children[0].textContent).toContain(
      'Saved'
    );
  });

  it('flushes on pagehide and releases services on destroy', async () => {
    const { controller, autosave, database, fontService } = setup();
    await controller.start();
    await controller.pagehide();
    controller.destroy();

    expect(autosave.flush).toHaveBeenCalled();
    expect(autosave.stop).toHaveBeenCalled();
    expect(fontService.clear).toHaveBeenCalled();
    expect(database.close).toHaveBeenCalled();
  });

  it('disables local controls with an error when canvas dependencies are missing', () => {
    const document = createDocument();
    const errorSpy = vi.spyOn(globalThis.console, 'error').mockImplementation(() => {});

    const api = initializeLocalProjectsController({}, document);

    expect(api).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('ChatlogProject'));
    for (const id of [
      'projectLocal',
      'projectSnapshot',
      'projectStack',
      'projectFonts',
      'clearLocalData',
    ]) {
      expect(document.elements[id].disabled).toBe(true);
    }
    expect(document.elements.projectStatus.textContent).toBe('Yerel projeler kullanılamıyor.');
    errorSpy.mockRestore();
  });

  it('returns the existing local API without logging when already initialized', () => {
    const document = createDocument();
    const existing = { saveFile: () => {} };
    const errorSpy = vi.spyOn(globalThis.console, 'error').mockImplementation(() => {});

    expect(initializeLocalProjectsController({ ChatlogLocal: existing }, document)).toBe(existing);

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

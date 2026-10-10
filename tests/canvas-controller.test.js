import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProject } from '../public/js/project-model.ts';
import { createProjectHistory } from '../public/js/project-history.ts';
import { createCanvasController, initializeCanvasController } from '../public/js/canvas-controller.ts';

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  toggle(value, force) {
    if (force === true) this.values.add(value);
    else if (force === false) this.values.delete(value);
    else if (this.values.has(value)) this.values.delete(value);
    else this.values.add(value);
  }

  contains(value) {
    return this.values.has(value);
  }
}

class FakeElement {
  constructor(id = '') {
    this.id = id;
    this.hidden = false;
    this.disabled = false;
    this.value = '';
    this.files = [];
    this.dataset = {};
    this.classList = new FakeClassList();
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.textContent = '';
    this.parentElement = null;
    this.style = {};
    this.scrollLeft = 0;
    this.scrollTop = 0;
    this.clientWidth = 960;
    this.clientHeight = 540;
    this.capturedPointers = [];
    this.releasedPointers = [];
    this.rect = { left: 0, top: 0, width: 960, height: 540 };
    this.computedStyle = {
      paddingLeft: '0px',
      paddingRight: '0px',
      paddingTop: '0px',
      paddingBottom: '0px',
    };
    this.tagName = 'DIV';
    this.open = false;
    this.ownerDocument = null;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      listeners.filter((candidate) => candidate !== listener)
    );
  }

  dispatch(type, event = { target: this, preventDefault() {} }) {
    event.type = type;
    event.currentTarget = this;
    for (const listener of this.listeners.get(type) ?? []) listener(event);
    this.parentElement?.dispatch(type, event);
  }

  click() {
    this.dispatch('click');
  }

  focus() {
    if (this.ownerDocument) this.ownerDocument.activeElement = this;
  }

  showModal() {
    this.open = true;
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.dispatch('close');
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  append(...children) {
    for (const child of children) child.parentElement = this;
    this.children.push(...children);
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  replaceChildren(...children) {
    for (const child of this.children) child.parentElement = null;
    for (const child of children) child.parentElement = this;
    this.children = children;
  }

  closest(selector) {
    if (selector === '[data-canvas-action]' && this.dataset.canvasAction) return this;
    if (selector === '.canvas-selection__handle' && this.className === 'canvas-selection__handle') {
      return this;
    }
    return this.parentElement?.closest(selector) ?? null;
  }

  getBoundingClientRect() {
    return typeof this.rect === 'function' ? this.rect() : this.rect;
  }

  setPointerCapture(pointerId) {
    this.capturedPointers.push(pointerId);
  }

  releasePointerCapture(pointerId) {
    this.releasedPointers.push(pointerId);
  }
}

function createDocument() {
  const ids = [
    'modeChat',
    'modeCanvas',
    'output',
    'canvasWorkspace',
    'canvasViewport',
    'canvasStage',
    'canvasPreview',
    'canvasSelection',
    'canvasGuides',
    'canvasLayerList',
    'canvasBackgroundInput',
    'canvasImageInput',
    'canvasBackgroundUpload',
    'canvasImageUpload',
    'canvasAddChat',
    'canvasUndo',
    'canvasRedo',
    'canvasClear',
    'canvasBackgroundColor',
    'canvasBackgroundOpacity',
    'canvasBackgroundBlur',
    'canvasBackgroundGrain',
    'canvasAddRedactionBox',
    'canvasDetectFaces',
    'canvasComposition',
    'canvasPaddingX',
    'canvasPaddingY',
    'canvasFitMode',
    'canvasWidth',
    'canvasHeight',
    'canvasExportFormat',
    'canvasJpegQualityField',
    'canvasJpegQuality',
    'canvasCopy',
    'canvasDownload',
    'canvasStatus',
    'canvasStatusMeta',
    'canvasChatDialog',
    'canvasChatForm',
    'canvasChatName',
    'canvasChatInput',
    'canvasChatError',
    'canvasChatCancel',
    'canvasChatSubmit',
    'chatlogInput',
    'font-label',
    'lineSpacingInput',
    'lineLengthInput',
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement(id)]));
  elements.canvasWorkspace.hidden = true;
  elements.canvasPreview.getContext = () => ({});
  elements.canvasStage.rect = { left: 100, top: 50, width: 1920, height: 1080 };
  const resizeHandle = new FakeElement();
  resizeHandle.className = 'canvas-selection__handle';
  elements.canvasSelection.append(resizeHandle);
  elements.canvasStage.append(
    elements.canvasPreview,
    elements.canvasSelection,
    elements.canvasGuides
  );
  elements.canvasViewport.append(elements.canvasStage);
  elements.canvasWorkspace.append(elements.canvasViewport);
  const animationFrames = [];
  const documentListeners = new Map();
  const clipboardWrite = vi.fn(async () => {});
  const clipboardItems = [];
  class FakeClipboardItem {
    constructor(contents) {
      this.contents = contents;
      clipboardItems.push(this);
    }
  }
  const saveAs = vi.fn();
  const documentLike = {
    activeElement: null,
    body: { dataset: { canvasReady: 'true' } },
    defaultView: {
      requestAnimationFrame(callback) {
        animationFrames.push(callback);
        return animationFrames.length;
      },
      cancelAnimationFrame: vi.fn(),
      getComputedStyle(element) {
        return element.computedStyle;
      },
      navigator: { clipboard: { write: clipboardWrite } },
      ClipboardItem: FakeClipboardItem,
      saveAs,
    },
    createElement: () => new FakeElement(),
    getElementById: (id) => elements[id] ?? null,
    addEventListener(type, listener) {
      documentListeners.set(type, [...(documentListeners.get(type) ?? []), listener]);
    },
    removeEventListener(type, listener) {
      documentListeners.set(
        type,
        (documentListeners.get(type) ?? []).filter((candidate) => candidate !== listener)
      );
    },
    dispatch(type, event) {
      event.type = type;
      event.currentTarget = documentLike;
      for (const listener of documentListeners.get(type) ?? []) listener(event);
    },
    elements,
    flushAnimationFrames() {
      animationFrames.splice(0).forEach((callback) => callback());
    },
    clipboardWrite,
    clipboardItems,
    saveAs,
  };
  for (const element of Object.values(elements)) element.ownerDocument = documentLike;
  return documentLike;
}

function createProjectApi(input = 'Selam', overrides = {}) {
  const history = createProjectHistory(createProject({ ...overrides, chat: { input } }));
  const commit = vi.fn((mutator) => history.commit(mutator));
  return {
    getSnapshot: () => history.current(),
    captureCurrentChat: vi.fn(() => history.current()),
    commit,
    undo: () => history.undo(),
    redo: () => history.redo(),
    canUndo: () => history.canUndo(),
    canRedo: () => history.canRedo(),
  };
}

function setup(input, overrides, options = {}) {
  const document = createDocument();
  Object.assign(document.defaultView, options.defaultView ?? {});
  const project = createProjectApi(input, overrides);
  const assetRegistry = {
    add: vi.fn(async (file) => ({
      id: file.name === 'background.png' ? 'background-asset' : 'layer-asset',
      name: file.name,
      width: 640,
      height: 360,
    })),
    clear: vi.fn(),
    remove: vi.fn(),
  };
  const renderer = {
    render: vi.fn(async () => {}),
    toBlob: vi.fn(async (snapshot) => {
      const type = snapshot.export.format === 'jpeg' ? 'image/jpeg' : 'image/png';
      return new globalThis.Blob(['canvas'], { type });
    }),
  };
  const captureFormattedChat =
    options.captureFormattedChat ??
    vi.fn(() => [
      [{ text: input || '', color: '#f1f1f1', italic: false, censored: false, remove: false }],
    ]);
  const formatChatInput =
    options.formatChatInput ??
    vi.fn((value) => [
      [{ text: value, color: '#f1f1f1', italic: false, censored: false, remove: false }],
    ]);
  const controller = createCanvasController({
    document,
    project,
    assetRegistry,
    renderer,
    captureFormattedChat,
    formatChatInput,
  });
  return {
    controller,
    document,
    project,
    assetRegistry,
    renderer,
    captureFormattedChat,
    formatChatInput,
  };
}

function sceneRow(document, index = 1) {
  return document.elements.canvasLayerList.children[index];
}

function addChatBlock(document, name = 'Yan sohbet', input = 'Ayrı satır') {
  document.elements.canvasAddChat.click();
  document.elements.canvasChatName.value = name;
  document.elements.canvasChatInput.value = input;
  document.elements.canvasChatForm.dispatch('submit', { preventDefault: vi.fn() });
}

function pointer(target, type, options = {}) {
  target.dispatch(type, {
    target: options.target ?? target,
    pointerId: options.pointerId ?? 7,
    pointerType: 'mouse',
    button: options.button ?? 0,
    buttons: options.buttons ?? 1,
    clientX: options.clientX ?? 0,
    clientY: options.clientY ?? 0,
    preventDefault: vi.fn(),
  });
}

describe('canvas controller', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.useRealTimers());

  it('commits every canvas control into normalized project state', async () => {
    const { controller, document, project } = setup();
    await controller.enter();
    project.commit.mockClear();
    const changes = [
      ['canvasBackgroundColor', '#123456'],
      ['canvasBackgroundOpacity', '0.35'],
      ['canvasComposition', 'below'],
      ['canvasPaddingX', '18.5'],
      ['canvasPaddingY', '24'],
      ['canvasFitMode', 'stretch'],
      ['canvasWidth', '640.8'],
      ['canvasHeight', '360.2'],
      ['canvasExportFormat', 'jpeg'],
      ['canvasJpegQuality', '0.65'],
    ];

    for (const [id, value] of changes) {
      document.elements[id].value = value;
      document.elements[id].dispatch('change');
    }

    expect(project.commit).toHaveBeenCalledTimes(changes.length);
    expect(controller.getProject()).toMatchObject({
      canvas: {
        width: 641,
        height: 360,
        background: { type: 'solid', color: '#123456', opacity: 0.35 },
        composition: 'below',
        padding: { x: 18.5, y: 24 },
        fitMode: 'stretch',
      },
      export: { format: 'jpeg', jpegQuality: 0.65 },
    });
  });

  it('shows JPEG quality only when JPEG is selected', async () => {
    const { controller, document } = setup();
    await controller.enter();

    expect(document.elements.canvasJpegQualityField.hidden).toBe(true);
    document.elements.canvasExportFormat.value = 'jpeg';
    document.elements.canvasExportFormat.dispatch('change');
    expect(document.elements.canvasJpegQualityField.hidden).toBe(false);
    document.elements.canvasExportFormat.value = 'png';
    document.elements.canvasExportFormat.dispatch('change');
    expect(document.elements.canvasJpegQualityField.hidden).toBe(true);
  });

  it('copies renderer.toBlob output through ClipboardItem and disables export actions while busy', async () => {
    const { controller, document, renderer } = setup();
    await controller.enter();
    let resolveBlob;
    renderer.toBlob.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveBlob = resolve;
        })
    );

    document.elements.canvasCopy.click();

    expect(document.elements.canvasCopy.disabled).toBe(true);
    expect(document.elements.canvasDownload.disabled).toBe(true);
    expect(renderer.toBlob).toHaveBeenCalledWith(controller.getProject());
    const blob = new globalThis.Blob(['canvas'], { type: 'image/png' });
    resolveBlob(blob);
    await vi.waitFor(() => expect(document.clipboardWrite).toHaveBeenCalledOnce());

    expect(document.clipboardItems[0].contents).toEqual({ 'image/png': blob });
    expect(document.clipboardWrite).toHaveBeenCalledWith([document.clipboardItems[0]]);
    expect(document.elements.canvasCopy.disabled).toBe(false);
    expect(document.elements.canvasDownload.disabled).toBe(false);
  });

  it('exposes renderer toBlob for shared image-stack exports', async () => {
    const { controller, renderer } = setup();
    const project = createProject({ export: { format: 'jpeg' } });
    const blob = new globalThis.Blob(['shared'], { type: 'image/jpeg' });
    renderer.toBlob.mockResolvedValueOnce(blob);

    await expect(controller.toBlob(project)).resolves.toBe(blob);
    expect(renderer.toBlob).toHaveBeenCalledWith(project);
  });

  it('awaits refresh rendering and propagates renderer failures', async () => {
    const failure = new Error('render failed');
    const { controller, renderer } = setup();
    renderer.render.mockRejectedValueOnce(failure);

    await expect(controller.refresh()).rejects.toBe(failure);
  });

  it('exposes narrow asset persistence operations without publishing the registry', async () => {
    const { controller, assetRegistry, renderer } = setup();
    const prepared = { metadata: { id: 'persisted' }, activate: vi.fn() };
    assetRegistry.prepareWithId = vi.fn(async () => prepared);
    assetRegistry.has = vi.fn(() => true);
    assetRegistry.get = vi.fn(() => ({ id: 'persisted', blob: new globalThis.Blob(['image']) }));
    assetRegistry.metadata = vi.fn(() => ({ id: 'persisted' }));
    assetRegistry.listMetadata = vi.fn(() => [{ id: 'persisted' }]);

    await expect(
      controller.prepareAsset(new globalThis.Blob(['image']), { id: 'persisted' })
    ).resolves.toBe(prepared);
    expect(controller.hasAsset('persisted')).toBe(true);
    expect(controller.getAsset('persisted')).toMatchObject({ id: 'persisted' });
    expect(controller.listAssets()).toEqual([expect.objectContaining({ id: 'persisted' })]);
    await controller.refresh();
    expect(renderer.render).toHaveBeenCalled();
    expect(controller).not.toHaveProperty('assetRegistry');
  });

  it.each([
    ['png', 'image/png', 'png'],
    ['jpeg', 'image/jpeg', 'jpg'],
  ])(
    'downloads %s output with matching MIME and timestamp extension',
    async (format, mime, extension) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-07-11T09:08:00'));
      const { controller, document, renderer } = setup('', { export: { format } });
      await controller.enter();
      const blob = new globalThis.Blob(['canvas'], { type: mime });
      renderer.toBlob.mockResolvedValueOnce(blob);

      document.elements.canvasDownload.click();
      await vi.waitFor(() => expect(document.saveAs).toHaveBeenCalledOnce());

      expect(renderer.toBlob).toHaveBeenCalledWith(controller.getProject());
      expect(document.saveAs).toHaveBeenCalledWith(
        blob,
        `chatlog-canvas-2026-07-11-09-08.${extension}`
      );
    }
  );

  it('resizes the stage during a Below gesture and restores it when cancelled', async () => {
    const { controller, document, renderer } = setup('Selam', {
      canvas: { width: 320, height: 180, composition: 'below', padding: { x: 10, y: 22 } },
      blocks: [
        {
          kind: 'chat',
          id: 'chat',
          input: 'Selam',
          transform: { x: 48, y: 48, width: 160, height: 40 },
        },
      ],
    });
    await controller.enter();
    controller.select('chat');
    expect(controller.beginMove('chat', { clientX: 158, clientY: 300, pointerId: 7 })).toBe(true);

    controller.move({ clientX: 158, clientY: 340, pointerId: 7 });
    document.flushAnimationFrames();
    expect(document.elements.canvasStage.style.height).toBe('332px');

    pointer(document.elements.canvasStage, 'pointercancel', { pointerId: 7 });
    expect(document.elements.canvasStage.style.height).toBe('290px');
    await vi.waitFor(() =>
      expect(renderer.render).toHaveBeenLastCalledWith(
        controller.getProject(),
        document.elements.canvasPreview
      )
    );
  });

  it.each([
    ['canvasCopy', 'Kopyalama başarısız. Pano iznini kontrol edip tekrar deneyin.'],
    [
      'canvasDownload',
      'İndirme başarısız. Tarayıcı indirme izinlerini kontrol edip tekrar deneyin.',
    ],
  ])(
    'preserves project state and shows an actionable Turkish error when %s fails',
    async (id, message) => {
      const { controller, document, renderer } = setup();
      await controller.enter();
      const snapshot = controller.getProject();
      renderer.toBlob.mockRejectedValueOnce(new Error('render failed'));

      document.elements[id].click();
      await vi.waitFor(() => expect(document.elements.canvasStatus.textContent).toBe(message));

      expect(controller.getProject()).toEqual(snapshot);
      expect(document.elements.canvasCopy.disabled).toBe(false);
      expect(document.elements.canvasDownload.disabled).toBe(false);
    }
  );

  it('never reads legacy ImageOverlayState during export', async () => {
    const { controller, document } = setup();
    Object.defineProperty(document.defaultView, 'ImageOverlayState', {
      get() {
        throw new Error('legacy state accessed');
      },
    });
    await controller.enter();

    document.elements.canvasCopy.click();
    await vi.waitFor(() => expect(document.clipboardWrite).toHaveBeenCalledOnce());
    document.elements.canvasDownload.click();
    await vi.waitFor(() => expect(document.saveAs).toHaveBeenCalledOnce());

    expect(document.elements.canvasStatus.textContent).not.toContain('legacy');
  });

  it('switches Chat to Canvas and creates one main chat block from current chat', async () => {
    const { controller, document, project, renderer, captureFormattedChat } =
      setup('Merhaba dünya');

    await controller.enter();

    expect(project.captureCurrentChat).toHaveBeenCalledOnce();
    expect(controller.getProject().blocks).toHaveLength(1);
    expect(controller.getProject().blocks[0]).toMatchObject({
      kind: 'chat',
      name: 'Ana Sohbet',
      input: 'Merhaba dünya',
      source: 'main-chat',
      formattedLines: [
        [
          {
            text: 'Merhaba dünya',
            color: '#f1f1f1',
            italic: false,
            censored: false,
            remove: false,
          },
        ],
      ],
      transform: { x: 24, y: 24, width: 552, height: 552, rotation: 0 },
    });
    expect(captureFormattedChat).toHaveBeenCalledOnce();
    expect(renderer.render).toHaveBeenCalledOnce();
    expect(document.elements.output.hidden).toBe(true);
    expect(document.elements.canvasWorkspace.hidden).toBe(false);
    expect(document.elements.modeCanvas.classList.contains('is-active')).toBe(true);
    expect(document.body.dataset.canvasActive).toBe('true');

    controller.exit();
    expect(document.elements.output.hidden).toBe(false);
    expect(document.elements.canvasWorkspace.hidden).toBe(true);
    expect(document.elements.modeChat.classList.contains('is-active')).toBe(true);
    expect(document.body.dataset.canvasActive).toBe('false');
  });

  it('refreshes linked main content on re-entry without resetting its presentation', async () => {
    const captureFormattedChat = vi
      .fn()
      .mockReturnValueOnce([
        [{ text: 'İlk', color: '#f1f1f1', italic: false, censored: false, remove: false }],
      ])
      .mockReturnValueOnce([
        [{ text: '* Son', color: '#c2a3da', italic: true, censored: false, remove: false }],
      ]);
    const { controller, project } = setup('İlk', undefined, { captureFormattedChat });
    await controller.enter();
    const id = controller.getProject().blocks[0].id;
    project.commit((draft) => {
      draft.chat.input = '* Son';
      Object.assign(draft.blocks[0], {
        opacity: 0.45,
        visible: false,
        locked: true,
        anchor: 'right',
        scale: 1.5,
        zIndex: 7,
        style: { font: 'Arial' },
        transform: { x: 88, y: 96, width: 320, height: 240, rotation: 3 },
      });
    });

    controller.exit();
    await controller.enter();

    expect(controller.getProject().blocks).toHaveLength(1);
    expect(controller.getProject().blocks[0]).toMatchObject({
      id,
      input: '* Son',
      source: 'main-chat',
      formattedLines: [
        [{ text: '* Son', color: '#c2a3da', italic: true, censored: false, remove: false }],
      ],
      opacity: 0.45,
      visible: false,
      locked: true,
      anchor: 'right',
      scale: 1.5,
      zIndex: 7,
      style: { font: 'Arial' },
      transform: { x: 88, y: 96, width: 320, height: 240, rotation: 3 },
    });
  });

  it('routes background and layer file commands through the asset registry', async () => {
    const { controller, document, assetRegistry } = setup();
    await controller.enter();
    document.elements.canvasBackgroundInput.files = [
      { name: 'background.png', type: 'image/png', size: 12 },
    ];
    document.elements.canvasImageInput.files = [{ name: 'layer.png', type: 'image/png', size: 12 }];

    document.elements.canvasBackgroundInput.dispatch('change');
    await vi.waitFor(() =>
      expect(controller.getProject().canvas.background.assetId).toBe('background-asset')
    );
    document.elements.canvasImageInput.dispatch('change');
    await vi.waitFor(() => expect(controller.getProject().layers).toHaveLength(1));

    expect(assetRegistry.add).toHaveBeenCalledTimes(2);
    expect(controller.getProject().canvas.background).toMatchObject({
      type: 'image',
      assetId: 'background-asset',
    });
    expect(controller.getProject().layers[0]).toMatchObject({
      kind: 'image',
      name: 'layer.png',
      assetId: 'layer-asset',
    });
    expect(document.elements.canvasBackgroundInput.value).toBe('');
    expect(document.elements.canvasImageInput.value).toBe('');
  });

  it('opens both native file pickers from keyboard-accessible upload buttons', () => {
    const { document } = setup();
    document.elements.canvasBackgroundInput.click = vi.fn();
    document.elements.canvasImageInput.click = vi.fn();

    document.elements.canvasBackgroundUpload.click();
    document.elements.canvasImageUpload.click();

    expect(document.elements.canvasBackgroundInput.click).toHaveBeenCalledOnce();
    expect(document.elements.canvasImageInput.click).toHaveBeenCalledOnce();
  });

  it('preserves an image background when its opacity changes', async () => {
    const { controller, document, renderer } = setup();
    await controller.enter();
    document.elements.canvasBackgroundInput.files = [
      { name: 'background.png', type: 'image/png', size: 12 },
    ];
    document.elements.canvasBackgroundInput.dispatch('change');
    await vi.waitFor(() =>
      expect(controller.getProject().canvas.background).toMatchObject({
        type: 'image',
        assetId: 'background-asset',
      })
    );
    renderer.render.mockClear();

    document.elements.canvasBackgroundOpacity.value = '0.35';
    document.elements.canvasBackgroundOpacity.dispatch('change');

    expect(controller.getProject().canvas.background).toMatchObject({
      type: 'image',
      assetId: 'background-asset',
      color: '#000000',
      opacity: 0.35,
    });
    await vi.waitFor(() =>
      expect(renderer.render).toHaveBeenCalledWith(
        expect.objectContaining({
          canvas: expect.objectContaining({
            background: expect.objectContaining({
              type: 'image',
              assetId: 'background-asset',
              opacity: 0.35,
            }),
          }),
        }),
        document.elements.canvasPreview
      )
    );
  });

  it('opens an accessible dialog and validates additional chat fields', async () => {
    const { controller, document } = setup();
    await controller.enter();

    document.elements.canvasAddChat.click();
    expect(document.elements.canvasChatDialog.open).toBe(true);
    expect(document.activeElement).toBe(document.elements.canvasChatName);

    document.elements.canvasChatForm.dispatch('submit', { preventDefault: vi.fn() });
    expect(document.elements.canvasChatError.textContent).toBe('Ad girin.');
    expect(document.elements.canvasChatName.attributes.get('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(document.elements.canvasChatName);

    document.elements.canvasChatName.value = 'Yan sohbet';
    document.elements.canvasChatForm.dispatch('submit', { preventDefault: vi.fn() });
    expect(document.elements.canvasChatError.textContent).toBe('Sohbet metni girin.');
    expect(document.elements.canvasChatInput.attributes.get('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(document.elements.canvasChatInput);
    expect(controller.getProject().blocks).toHaveLength(1);
  });

  it('creates an independent formatted chat block and supports cancel focus restoration', async () => {
    const { controller, document, formatChatInput } = setup();
    await controller.enter();

    document.elements.canvasAddChat.focus();
    document.elements.canvasAddChat.click();
    document.elements.canvasChatCancel.click();
    expect(controller.getProject().blocks).toHaveLength(1);
    expect(document.activeElement).toBe(document.elements.canvasAddChat);

    document.elements.canvasAddChat.click();
    document.elements.canvasChatName.value = 'Yan sohbet';
    document.elements.canvasChatInput.value = '[12:00:00] * ayrı blok';
    document.elements.canvasChatForm.dispatch('submit', { preventDefault: vi.fn() });

    expect(controller.getProject().blocks).toHaveLength(2);
    expect(formatChatInput).toHaveBeenCalledWith('[12:00:00] * ayrı blok');

    const added = controller.getProject().blocks[1];
    expect(added).toMatchObject({
      name: 'Yan sohbet',
      input: '[12:00:00] * ayrı blok',
      source: 'custom',
      transform: { x: 40, y: 40, width: 536, height: 536, rotation: 0 },
    });
    expect(document.elements.canvasChatDialog.open).toBe(false);
    expect(document.activeElement).toBe(document.elements.canvasAddChat);

    controller.select(added.id);
    controller.toggleLock(added.id);
    controller.toggleVisibility(added.id);
    expect(controller.getProject().blocks[1]).toMatchObject({ locked: true, visible: false });

    controller.remove(added.id);
    expect(controller.getProject().blocks).toHaveLength(1);
  });

  it('routes select, visibility, lock, and delete icon actions through the layer list', async () => {
    const { controller, document } = setup();
    await controller.enter();

    let row = sceneRow(document);
    expect(row.children[0].textContent).toBe('Ana Sohbet');
    expect(row.children[1].children).toHaveLength(7);
    const [selectButton] = row.children[1].children;
    expect(selectButton.attributes.get('aria-label')).toBe('Katmanı seç');
    expect(selectButton.attributes.get('aria-pressed')).toBe('false');
    expect(selectButton.children[0].className).toContain('fa-arrow-pointer');

    selectButton.children[0].click();
    row = sceneRow(document);
    expect(row.classList.contains('is-selected')).toBe(true);
    expect(row.children[1].children[0].attributes.get('aria-pressed')).toBe('true');

    const backgroundSelect = document.elements.canvasLayerList.children[0].children[1].children[0];
    expect(backgroundSelect.attributes.get('aria-pressed')).toBe('false');
    backgroundSelect.click();
    expect(
      document.elements.canvasLayerList.children[0].children[1].children[0].attributes.get(
        'aria-pressed'
      )
    ).toBe('true');
    row = sceneRow(document);
    expect(row.children[1].children[0].attributes.get('aria-pressed')).toBe('false');

    row.children[1].children[1].click();
    expect(controller.getProject().blocks[0].visible).toBe(false);
    row = sceneRow(document);
    row.children[1].children[2].click();
    expect(controller.getProject().blocks[0].locked).toBe(true);
    row = sceneRow(document);
    row.children[1].children.find((child) => child.title === 'Sil').click();
    expect(controller.getProject().blocks).toHaveLength(0);
  });

  it('reorders scene items and updates per-item opacity from layer controls', async () => {
    const { controller, document } = setup();
    await controller.enter();
    addChatBlock(document);
    const firstId = controller.getProject().blocks[0].id;
    let firstRow = sceneRow(document, 1);
    const forward = firstRow.children[1].children.find((child) => child.title === 'Öne al');

    forward.click();

    expect(controller.getProject().blocks.at(-1).id).toBe(firstId);
    firstRow = sceneRow(document, 2);
    const opacity = firstRow.children[1].children.find(
      (child) => child.dataset.canvasAction === 'opacity'
    );
    opacity.value = '0.35';
    opacity.dispatch('change');
    expect(controller.getProject().blocks.find(({ id }) => id === firstId).opacity).toBe(0.35);
  });

  it('disables reorder and opacity controls for locked scene items', async () => {
    const { controller, document } = setup();
    await controller.enter();
    const id = controller.getProject().blocks[0].id;
    controller.toggleLock(id);
    const row = sceneRow(document);
    const backward = row.children[1].children.find((child) => child.title === 'Arkaya al');
    const forward = row.children[1].children.find((child) => child.title === 'Öne al');
    const opacity = row.children[1].children.find(
      (child) => child.dataset.canvasAction === 'opacity'
    );

    expect(backward.disabled).toBe(true);
    expect(forward.disabled).toBe(true);
    expect(opacity.disabled).toBe(true);
  });

  it('prevents background replacement and settings mutations while it is locked', async () => {
    const { controller, document, assetRegistry } = setup('', {
      canvas: { background: { type: 'solid', color: '#123456', locked: true } },
    });
    await controller.enter();
    document.elements.canvasBackgroundColor.value = '#abcdef';
    document.elements.canvasBackgroundColor.dispatch('change');
    document.elements.canvasBackgroundInput.files = [
      { name: 'background.png', type: 'image/png', size: 12 },
    ];
    document.elements.canvasBackgroundInput.dispatch('change');

    expect(controller.getProject().canvas.background).toMatchObject({
      type: 'solid',
      color: '#123456',
      locked: true,
    });
    expect(assetRegistry.add).not.toHaveBeenCalled();
    expect(document.elements.canvasStatus.textContent).toMatch(/kilidini/i);
  });

  it('clears scene items without deleting a locked background', async () => {
    const { controller, document } = setup('Selam', {
      canvas: { background: { type: 'solid', color: '#123456', locked: true } },
    });
    await controller.enter();

    document.elements.canvasClear.click();

    expect(controller.getProject().blocks).toEqual([]);
    expect(controller.getProject().canvas.background).toMatchObject({
      type: 'solid',
      color: '#123456',
      locked: true,
    });
  });

  it('removes dynamic layer select and mutation behavior on destroy', async () => {
    const { controller, document } = setup();
    await controller.enter();
    const row = sceneRow(document);
    const selectButton = row.children[1].children[0];
    const lockButton = row.children[1].children[2];
    const snapshot = controller.getProject();

    controller.destroy();
    selectButton.click();
    lockButton.click();

    expect(document.elements.canvasLayerList.children[1]).toBe(row);
    expect(controller.getProject()).toEqual(snapshot);
  });

  it('releases concurrent uploads that settle after destroy without mutating project or DOM', async () => {
    const { controller, document, assetRegistry } = setup();
    await controller.enter();
    const pending = [];
    assetRegistry.add.mockImplementation(
      (file) =>
        new Promise((resolve, reject) => {
          pending.push({ file, resolve, reject });
        })
    );
    document.elements.canvasBackgroundInput.files = [
      { name: 'background.png', type: 'image/png', size: 12 },
    ];
    document.elements.canvasImageInput.files = [{ name: 'layer.png', type: 'image/png', size: 12 }];
    document.elements.canvasBackgroundInput.dispatch('change');
    document.elements.canvasImageInput.dispatch('change');
    document.elements.canvasImageInput.dispatch('change');
    const snapshot = controller.getProject();
    const status = document.elements.canvasStatus.textContent;
    const rows = [...document.elements.canvasLayerList.children];

    controller.destroy();
    pending[0].resolve({ id: 'late-background', name: 'background.png', width: 640, height: 360 });
    pending[1].resolve({ id: 'late-layer', name: 'layer.png', width: 640, height: 360 });
    pending[2].reject(new Error('late decode failure'));

    await vi.waitFor(() => expect(assetRegistry.remove).toHaveBeenCalledTimes(2));
    expect(assetRegistry.remove.mock.calls).toEqual([['late-background'], ['late-layer']]);
    expect(controller.getProject()).toEqual(snapshot);
    expect(document.elements.canvasStatus.textContent).toBe(status);
    expect(document.elements.canvasLayerList.children).toEqual(rows);
  });

  it('undoes, redoes, clears, renders, and releases resources on destroy', async () => {
    const { controller, document, assetRegistry, renderer } = setup();
    await controller.enter();
    addChatBlock(document);

    document.elements.canvasUndo.click();
    expect(controller.getProject().blocks).toHaveLength(1);
    document.elements.canvasRedo.click();
    expect(controller.getProject().blocks).toHaveLength(2);
    document.elements.canvasClear.click();
    expect(controller.getProject().blocks).toHaveLength(0);

    await controller.render();
    expect(renderer.render).toHaveBeenLastCalledWith(
      controller.getProject(),
      document.elements.canvasPreview
    );
    controller.destroy();
    expect(assetRegistry.clear).toHaveBeenCalledOnce();
    expect(document.body.dataset.canvasActive).toBe('false');
  });

  it('does not enter while the production readiness gate is closed', async () => {
    const { controller, document } = setup();
    document.body.dataset.canvasReady = 'false';

    await controller.enter();

    expect(document.elements.output.hidden).toBe(false);
    expect(document.elements.canvasWorkspace.hidden).toBe(true);
    expect(controller.getProject().blocks).toHaveLength(0);
  });

  it('selects the topmost visible unlocked item under the pointer', async () => {
    const { controller, document } = setup('Selam', {
      layers: [
        {
          id: 'image-front',
          kind: 'image',
          name: 'Locked image',
          assetId: 'asset-front',
          visible: true,
          locked: true,
          zIndex: 50,
          transform: { x: 0, y: 0, width: 200, height: 200 },
        },
      ],
      blocks: [
        {
          id: 'chat-front',
          kind: 'chat',
          name: 'Locked chat',
          input: 'Ön',
          visible: true,
          locked: true,
          zIndex: 50,
          transform: { x: 0, y: 0, width: 200, height: 200 },
        },
        {
          id: 'chat-back',
          kind: 'chat',
          name: 'Selectable chat',
          input: 'Selam',
          visible: true,
          locked: false,
          zIndex: 1,
          transform: { x: 0, y: 0, width: 200, height: 200 },
        },
      ],
    });
    await controller.enter();

    pointer(document.elements.canvasStage, 'pointerdown', { clientX: 150, clientY: 100 });
    pointer(document.elements.canvasStage, 'pointerup', { clientX: 150, clientY: 100 });

    expect(controller.getSelection()).toBe('chat-back');
    expect(document.elements.canvasSelection.hidden).toBe(false);
  });

  it('maps viewport dragging through zoom, snaps within five project pixels, and commits once', async () => {
    const { controller, document, project, renderer } = setup();
    await controller.enter();
    const block = controller.getProject().blocks[0];
    project.commit.mockClear();
    controller.setZoom(2);
    document.elements.canvasStage.rect = { left: 100, top: 50, width: 3840, height: 2160 };

    pointer(document.elements.canvasStage, 'pointerdown', { clientX: 200, clientY: 170 });
    pointer(document.elements.canvasStage, 'pointermove', { clientX: 152, clientY: 122 });

    expect(controller.getProject().blocks[0].transform).toEqual(block.transform);
    expect(document.elements.canvasGuides.children.map((guide) => guide.style)).toEqual([
      expect.objectContaining({ left: '0px' }),
      expect.objectContaining({ top: '0px' }),
    ]);
    expect(renderer.render).not.toHaveBeenLastCalledWith(
      expect.objectContaining({ blocks: [expect.objectContaining({ transform: { x: 0, y: 0 } })] }),
      document.elements.canvasPreview
    );
    document.flushAnimationFrames();
    expect(renderer.render).toHaveBeenLastCalledWith(
      expect.objectContaining({
        blocks: [expect.objectContaining({ transform: expect.objectContaining({ x: 0, y: 0 }) })],
      }),
      document.elements.canvasPreview
    );

    pointer(document.elements.canvasStage, 'pointerup', { clientX: 152, clientY: 122 });
    expect(controller.getProject().blocks[0].transform).toMatchObject({ x: 0, y: 0 });
    expect(project.commit).toHaveBeenCalledOnce();
    expect(document.elements.canvasStage.capturedPointers).toEqual([7]);
    expect(document.elements.canvasStage.releasedPointers).toEqual([7]);
  });

  it('draws move guides at matched right, bottom, and center alignment targets', async () => {
    const { controller, document } = setup('Selam', {
      canvas: { width: 1920, height: 1080 },
      layers: [
        {
          id: 'peer',
          kind: 'image',
          name: 'Peer',
          assetId: 'asset-peer',
          visible: true,
          locked: false,
          zIndex: 0,
          transform: { x: 900, y: 600, width: 100, height: 100 },
        },
      ],
      blocks: [
        {
          id: 'main',
          kind: 'chat',
          name: 'Ana Sohbet',
          input: 'Selam',
          transform: { x: 48, y: 48, width: 800, height: 420 },
        },
      ],
    });
    await controller.enter();

    pointer(document.elements.canvasStage, 'pointerdown', { clientX: 160, clientY: 110 });
    pointer(document.elements.canvasStage, 'pointermove', { clientX: 215, clientY: 244 });

    expect(document.elements.canvasGuides.children.map((guide) => guide.style)).toEqual([
      expect.objectContaining({ left: '900px' }),
      expect.objectContaining({ top: '600px' }),
    ]);
    pointer(document.elements.canvasStage, 'pointerup', { clientX: 215, clientY: 244 });
    expect(controller.getProject().blocks[0].transform).toMatchObject({ x: 100, y: 180 });

    pointer(document.elements.canvasStage, 'pointerdown', { clientX: 210, clientY: 240 });
    pointer(document.elements.canvasStage, 'pointermove', { clientX: 662, clientY: 240 });
    expect(document.elements.canvasGuides.children[0].style.left).toBe('950px');
    pointer(document.elements.canvasStage, 'pointercancel', { clientX: 662, clientY: 240 });
  });

  it('resizes from the corner with a 24 by 24 minimum and rejects locked items', async () => {
    const { controller, document, project } = setup();
    await controller.enter();
    const id = controller.getProject().blocks[0].id;
    controller.select(id);
    project.commit.mockClear();
    const handle = document.elements.canvasSelection.children[0];

    pointer(document.elements.canvasStage, 'pointerdown', {
      target: handle,
      clientX: 676,
      clientY: 626,
    });
    pointer(document.elements.canvasStage, 'pointermove', { clientX: 70, clientY: 70 });
    document.flushAnimationFrames();
    pointer(document.elements.canvasStage, 'pointerup', { clientX: 70, clientY: 70 });

    expect(controller.getProject().blocks[0].transform).toMatchObject({ width: 24, height: 24 });
    expect(project.commit).toHaveBeenCalledOnce();

    controller.toggleLock(id);
    project.commit.mockClear();
    expect(controller.beginMove(id, { clientX: 100, clientY: 100, pointerId: 8 })).toBe(false);
    expect(controller.nudge('ArrowRight')).toBe(false);
    expect(project.commit).not.toHaveBeenCalled();
  });

  it('nudges the selected item by one pixel or ten with Shift', async () => {
    const { controller, document } = setup();
    await controller.enter();
    const id = controller.getProject().blocks[0].id;
    controller.select(id);

    document.dispatch('keydown', {
      target: document.elements.canvasStage,
      key: 'ArrowRight',
      shiftKey: false,
      preventDefault: vi.fn(),
    });
    document.dispatch('keydown', {
      target: document.elements.canvasStage,
      key: 'ArrowDown',
      shiftKey: true,
      preventDefault: vi.fn(),
    });

    expect(controller.getProject().blocks[0].transform).toMatchObject({ x: 25, y: 34 });
  });

  it.each(['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'])(
    'does not apply canvas shortcuts while focus is on a %s control',
    async (tagName) => {
      const { controller, document, project } = setup();
      await controller.enter();
      controller.select(controller.getProject().blocks[0].id);
      project.commit.mockClear();
      const target = new FakeElement();
      target.tagName = tagName;
      const preventDefault = vi.fn();

      document.dispatch('keydown', { target, key: 'ArrowRight', preventDefault });
      document.dispatch('keydown', { target, key: ' ', preventDefault });

      expect(project.commit).not.toHaveBeenCalled();
      expect(preventDefault).not.toHaveBeenCalled();
    }
  );

  it('always clears Space pan state on keyup even when focus moved to a form control', async () => {
    const { controller, document } = setup();
    await controller.enter();
    const input = new FakeElement();
    input.tagName = 'INPUT';

    document.dispatch('keydown', {
      target: document.elements.canvasStage,
      key: ' ',
      preventDefault: vi.fn(),
    });
    document.dispatch('keyup', { target: input, key: ' ', preventDefault: vi.fn() });
    pointer(document.elements.canvasStage, 'pointerdown', { clientX: 1800, clientY: 1000 });

    expect(document.elements.canvasViewport.capturedPointers).toEqual([]);
  });

  it('snaps Below peers in output coordinates and draws the guide at the rendered edge', async () => {
    const { controller, document } = setup('Selam', {
      canvas: { width: 320, height: 180, composition: 'below', padding: { x: 10, y: 22 } },
      layers: [
        {
          id: 'image-peer',
          kind: 'image',
          name: 'Peer',
          assetId: 'asset-peer',
          visible: true,
          locked: false,
          zIndex: 0,
          transform: { x: 100, y: 30, width: 50, height: 50 },
        },
      ],
      blocks: [
        {
          id: 'chat',
          kind: 'chat',
          name: 'Chat',
          input: 'Selam',
          visible: true,
          locked: false,
          zIndex: 0,
          transform: { x: 48, y: 48, width: 160, height: 40 },
        },
      ],
    });
    await controller.enter();

    pointer(document.elements.canvasStage, 'pointerdown', { clientX: 160, clientY: 302 });
    pointer(document.elements.canvasStage, 'pointermove', { clientX: 257, clientY: 302 });

    expect(document.elements.canvasGuides.children[0].style.left).toBe('150px');
    pointer(document.elements.canvasStage, 'pointerup', { clientX: 257, clientY: 302 });
    expect(controller.getProject().blocks[0].transform.x).toBe(140);
  });

  it.each([
    ['overlay', 320, 180, 58, 70],
    ['below', 320, 290, 58, 250],
    ['inset', 340, 224, 58, 70],
  ])(
    'keeps %s stage and selection geometry aligned with rendered composition',
    async (composition, width, height, selectionLeft, selectionTop) => {
      const { controller, document } = setup('Selam', {
        canvas: { width: 320, height: 180, composition, padding: { x: 10, y: 22 } },
        blocks: [
          {
            kind: 'chat',
            id: 'chat',
            input: 'Selam',
            transform: { x: 48, y: 48, width: 160, height: 40 },
          },
        ],
      });
      await controller.enter();
      controller.select('chat');

      expect(document.elements.canvasStage.style.width).toBe(`${width}px`);
      expect(document.elements.canvasStage.style.height).toBe(`${height}px`);
      expect(document.elements.canvasSelection.style.left).toBe(`${selectionLeft}px`);
      expect(document.elements.canvasSelection.style.top).toBe(`${selectionTop}px`);
    }
  );

  it('updates status format and zoom metadata from project state', async () => {
    const { controller, document } = setup('', { export: { format: 'jpeg' } });
    await controller.enter();
    controller.setZoom(0.5);

    expect(document.elements.canvasStatusMeta.textContent).toBe('JPG · %50');
  });

  it('clamps zoom, fits the viewport, zooms around the wheel pointer, and pans', async () => {
    const { controller, document } = setup();
    await controller.enter();
    const viewport = document.elements.canvasViewport;
    viewport.clientWidth = 960;
    viewport.clientHeight = 540;

    expect(controller.setZoom(0.01)).toBe(0.1);
    expect(controller.setZoom(50)).toBe(5);
    expect(controller.fitViewport()).toBe(0.9);

    viewport.dispatch('wheel', {
      target: viewport,
      clientX: 480,
      clientY: 270,
      deltaY: -100,
      ctrlKey: true,
      metaKey: false,
      preventDefault: vi.fn(),
    });
    expect(controller.getZoom()).toBeGreaterThan(0.9);
    expect(viewport.scrollLeft).toBeGreaterThan(0);

    pointer(viewport, 'pointerdown', { button: 1, clientX: 200, clientY: 200 });
    pointer(viewport, 'pointermove', { button: 1, clientX: 150, clientY: 160 });
    pointer(viewport, 'pointerup', { button: 1, clientX: 150, clientY: 160 });
    expect(viewport.scrollLeft).toBeGreaterThan(50);
    expect(viewport.scrollTop).toBeGreaterThan(0);

    const scrollLeft = viewport.scrollLeft;
    document.dispatch('keydown', {
      target: document.elements.canvasStage,
      key: ' ',
      preventDefault: vi.fn(),
    });
    pointer(viewport, 'pointerdown', { clientX: 150, clientY: 160 });
    pointer(viewport, 'pointermove', { clientX: 120, clientY: 160 });
    pointer(viewport, 'pointerup', { clientX: 120, clientY: 160 });
    document.dispatch('keyup', {
      target: document.elements.canvasStage,
      key: ' ',
      preventDefault: vi.fn(),
    });
    expect(viewport.scrollLeft).toBe(scrollLeft + 30);
  });

  it('uses stage origin for pointer zoom and excludes viewport padding when fitting', async () => {
    const { controller, document } = setup();
    await controller.enter();
    const viewport = document.elements.canvasViewport;
    const stage = document.elements.canvasStage;
    viewport.clientWidth = 1000;
    viewport.clientHeight = 580;
    viewport.computedStyle = {
      paddingLeft: '20px',
      paddingRight: '20px',
      paddingTop: '20px',
      paddingBottom: '20px',
    };

    expect(controller.fitViewport()).toBe(0.9);
    viewport.rect = { left: 20, top: 30, width: 1000, height: 580 };
    stage.rect = { left: 140, top: 90, width: 960, height: 540 };
    viewport.scrollLeft = 50;
    viewport.scrollTop = 30;
    viewport.dispatch('wheel', {
      target: viewport,
      clientX: 340,
      clientY: 290,
      deltaY: -100,
      ctrlKey: true,
      metaKey: false,
      preventDefault: vi.fn(),
    });

    expect(controller.getZoom()).toBeCloseTo(0.99);
    expect(viewport.scrollLeft).toBeCloseTo(70);
    expect(viewport.scrollTop).toBeCloseTo(50);
  });

  it('lets Space plus primary drag pan without moving items or leaving a stale gesture', async () => {
    const { controller, document, project } = setup();
    await controller.enter();
    const stage = document.elements.canvasStage;
    const viewport = document.elements.canvasViewport;
    const block = controller.getProject().blocks[0];
    controller.select(block.id);
    expect(controller.beginMove(block.id, { clientX: 160, clientY: 110, pointerId: 8 })).toBe(true);
    project.commit.mockClear();
    document.dispatch('keydown', {
      target: stage,
      key: ' ',
      preventDefault: vi.fn(),
    });

    pointer(stage, 'pointerdown', { clientX: 160, clientY: 110, pointerId: 9 });
    pointer(stage, 'pointermove', { clientX: 120, clientY: 80, pointerId: 9 });
    pointer(stage, 'pointerup', { clientX: 120, clientY: 80, pointerId: 9 });

    expect(controller.getProject().blocks[0].transform).toEqual(block.transform);
    expect(project.commit).not.toHaveBeenCalled();
    expect(stage.releasedPointers).toContain(8);
    expect(viewport.capturedPointers).toContain(9);
    expect(viewport.scrollLeft).toBe(40);
    expect(viewport.scrollTop).toBe(30);

    document.dispatch('keyup', {
      target: stage,
      key: ' ',
      preventDefault: vi.fn(),
    });
    pointer(stage, 'pointerdown', { clientX: 160, clientY: 110, pointerId: 10 });
    pointer(stage, 'pointermove', { clientX: 180, clientY: 130, pointerId: 10 });
    pointer(stage, 'pointerup', { clientX: 180, clientY: 130, pointerId: 10 });
    expect(controller.getProject().blocks[0].transform).toMatchObject({ x: 48, y: 48 });
    expect(project.commit).toHaveBeenCalledOnce();
  });

  it('publishes only the exact ChatlogCanvas API', () => {
    const document = createDocument();
    const window = { ChatlogProject: createProjectApi(), ChatlogParser: {} };

    const api = initializeCanvasController(window, document);

    expect(Object.keys(api).sort()).toEqual([
      'clearAssets',
      'destroy',
      'enter',
      'exit',
      'getAsset',
      'getProject',
      'hasAsset',
      'listAssets',
      'prepareAsset',
      'prepareReplacementAsset',
      'refresh',
      'removeAsset',
      'render',
      'toBlob',
    ]);
    expect(window.ChatlogCanvas).toBe(api);
  });

  it('syncs main chat block in real-time when chatlog input changes', async () => {
    vi.useFakeTimers();
    const { controller, document, project } = setup('İlk metin');
    await controller.enter();

    const chatlogInput = document.getElementById('chatlogInput');
    chatlogInput.value = 'Güncel metin';
    chatlogInput.dispatch('input');

    vi.advanceTimersByTime(150);
    expect(controller.getProject().blocks[0].input).toBe('Güncel metin');
    vi.useRealTimers();
  });

  it('preserves aspect ratio when resizing with Shift key', async () => {
    const { controller, document } = setup('Selam', {
      layers: [
        {
          id: 'img-1',
          kind: 'image',
          name: 'Görsel',
          assetId: 'asset-1',
          visible: true,
          locked: false,
          zIndex: 0,
          transform: { x: 10, y: 10, width: 100, height: 50 },
        },
      ],
    });
    await controller.enter();
    controller.select('img-1');
    controller.beginResize('img-1', { clientX: 110, clientY: 60 });
    controller.resize({ clientX: 160, clientY: 70, shiftKey: true });
    controller.endResize();

    expect(controller.getProject().layers[0].transform).toMatchObject({
      width: 150,
      height: 75,
    });
  });

  it('scales and rotates selection and hit-testing accurately', async () => {
    const { controller, document } = setup('Selam', {
      blocks: [
        {
          id: 'chat-scale',
          kind: 'chat',
          input: 'Scaled',
          scale: 2,
          transform: { x: 10, y: 10, width: 100, height: 30, rotation: 0 },
        },
      ],
      layers: [
        {
          id: 'img-rot',
          kind: 'image',
          assetId: 'asset-rot',
          transform: { x: 200, y: 200, width: 100, height: 100, rotation: 45 },
        },
      ],
    });
    await controller.enter();
    controller.select('chat-scale');

    expect(document.elements.canvasSelection.style.width).toBe('200px');
    expect(document.elements.canvasSelection.style.height).toBe('60px');

    controller.select('img-rot');
    expect(document.elements.canvasSelection.style.transform).toBe('rotate(45deg)');
  });

  it('updates background blur and film grain through controller inputs', async () => {
    const { controller, document } = setup('Selam', {
      canvas: { background: { type: 'solid', color: '#000000', blur: 0, grain: 0 } },
    });
    await controller.enter();

    document.elements.canvasBackgroundBlur.value = '10';
    document.elements.canvasBackgroundBlur.dispatch('input');

    expect(controller.getProject().canvas.background.blur).toBe(10);

    document.elements.canvasBackgroundGrain.value = '45';
    document.elements.canvasBackgroundGrain.dispatch('input');

    expect(controller.getProject().canvas.background.grain).toBe(45);
  });

  it('adds a redaction box on button click and allows selecting and deleting it', async () => {
    const { controller, document } = setup('Selam');
    await controller.enter();

    document.elements.canvasAddRedactionBox.dispatch('click');

    const project = controller.getProject();
    expect(project.redactionBoxes).toHaveLength(1);
    const boxId = project.redactionBoxes[0].id;
    expect(project.redactionBoxes[0].visible).toBe(true);

    controller.select(boxId);
    expect(controller.getSelection()).toBe(boxId);

    const deleteButton = document.elements.canvasLayerList.children
      .find((child) => child.className.includes('canvas-layer-row--redaction'))
      ?.children?.find((c) => c.className === 'canvas-layer-actions')
      ?.children?.find((btn) => btn.dataset?.canvasAction === 'delete');

    expect(deleteButton).toBeDefined();
    deleteButton.dispatch('click');

    expect(controller.getProject().redactionBoxes).toHaveLength(0);
  });

  it('detects faces or falls back to default redaction box with canvasDetectFaces', async () => {
    const { controller, document, assetRegistry } = setup('Selam', {
      canvas: {
        background: { type: 'image', assetId: 'bg-asset' },
      },
    });
    assetRegistry.get = vi.fn((id) => ({
      source: { width: 800, height: 600 },
      width: 800,
      height: 600,
    }));
    await controller.enter();

    document.elements.canvasDetectFaces.dispatch('click');

    const project = controller.getProject();
    expect(project.redactionBoxes.length).toBeGreaterThan(0);
  });

  it('syncs opsec-only segment changes into the main chat block', async () => {
    const lines = [
      [
        {
          text: 'Selam',
          color: '#f1f1f1',
          italic: false,
          censored: false,
          remove: false,
          opsec: false,
        },
      ],
    ];
    const { controller, document, project } = setup(
      'Selam',
      {},
      {
        captureFormattedChat: vi.fn(() => lines),
      }
    );
    await controller.enter();
    document.elements.chatlogInput.value = 'Selam';
    project.commit.mockClear();

    lines[0][0] = { ...lines[0][0], opsec: true };
    controller.syncMainChat();

    expect(project.commit).toHaveBeenCalledOnce();
    expect(
      controller.getProject().blocks.find((block) => block.source === 'main-chat')
        .formattedLines[0][0].opsec
    ).toBe(true);
  });

  it('does not reschedule sync from its own output rewrite', async () => {
    vi.useFakeTimers();
    FakeChatObserver.instances.length = 0;
    const lines = [
      [
        {
          text: 'Selam',
          color: '#f1f1f1',
          italic: false,
          censored: false,
          remove: false,
          opsec: false,
        },
      ],
    ];
    const captureFormattedChat = vi.fn(() => {
      FakeChatObserver.instances[0]?.queue();
      return lines;
    });
    const { controller, document } = setup(
      'Selam',
      {},
      {
        defaultView: { MutationObserver: FakeChatObserver },
        captureFormattedChat,
      }
    );
    document.elements.chatlogInput.value = 'Selam';
    await controller.enter();
    await Promise.resolve();
    expect(captureFormattedChat).toHaveBeenCalledTimes(1);

    FakeChatObserver.instances[0].queue();
    await Promise.resolve();
    vi.advanceTimersByTime(150);
    await Promise.resolve();
    expect(captureFormattedChat).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(1000);
    await Promise.resolve();
    expect(captureFormattedChat).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('previews layer opacity on input and commits once on change', async () => {
    const { controller, document, project, renderer } = setup();
    await controller.enter();
    const id = controller.getProject().blocks[0].id;
    const opacity = sceneRow(document).children[1].children.find(
      (child) => child.dataset.canvasAction === 'opacity'
    );
    project.commit.mockClear();
    renderer.render.mockClear();

    opacity.value = '0.35';
    opacity.dispatch('input');
    document.flushAnimationFrames();

    expect(project.commit).not.toHaveBeenCalled();
    expect(controller.getProject().blocks[0].opacity).not.toBe(0.35);
    expect(renderer.render).toHaveBeenCalled();
    expect(renderer.render.mock.calls[0][0].blocks.find((block) => block.id === id).opacity).toBe(
      0.35
    );

    opacity.dispatch('change');
    expect(project.commit).toHaveBeenCalledOnce();
    expect(controller.getProject().blocks.find((block) => block.id === id).opacity).toBe(0.35);
  });

  it('reports canvas entry failures on the status line instead of swallowing them', async () => {
    const { document, project } = setup();
    project.commit.mockImplementationOnce(() => {
      throw new Error('Kayıt patladı');
    });
    const errorSpy = vi.spyOn(globalThis.console, 'error').mockImplementation(() => {});

    document.elements.modeCanvas.dispatch('click');
    await vi.waitFor(() => {
      expect(document.elements.canvasStatus.textContent).toBe('Kayıt patladı');
    });

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('disables canvas mode with an error when ChatlogProject is missing', () => {
    const document = createDocument();
    const errorSpy = vi.spyOn(globalThis.console, 'error').mockImplementation(() => {});

    const api = initializeCanvasController({}, document);

    expect(api).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('ChatlogProject'));
    expect(document.elements.modeCanvas.disabled).toBe(true);
    errorSpy.mockRestore();
  });

  it('returns the existing canvas API without logging when already initialized', () => {
    const document = createDocument();
    const existing = { enter: () => {} };
    const errorSpy = vi.spyOn(globalThis.console, 'error').mockImplementation(() => {});

    expect(initializeCanvasController({ ChatlogCanvas: existing }, document)).toBe(existing);

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

class FakeChatObserver {
  static instances = [];

  constructor(callback) {
    this.callback = callback;
    this.records = [];
    this.callbackCount = 0;
    FakeChatObserver.instances.push(this);
  }

  observe() {}

  takeRecords() {
    const pending = this.records;
    this.records = [];
    return pending;
  }

  disconnect() {}

  queue(record = {}) {
    this.records.push(record);
    void Promise.resolve().then(() => {
      if (this.records.length === 0) return;
      const pending = this.records;
      this.records = [];
      this.callbackCount += 1;
      this.callback(pending, this);
    });
  }
}

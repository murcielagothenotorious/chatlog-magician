import { describe, expect, it, vi } from 'vitest';

import { createCommunityController } from '../public/js/community-controller.ts';
import { createChatBlock, createImageLayer } from '../public/js/canvas-scene.ts';
import { extractCommunityPreset } from '../public/js/community-preset-contract.ts';
import { createProjectHistory } from '../public/js/project-history.ts';
import { createProject } from '../public/js/project-model.ts';

class FakeElement {
  constructor(tagName = 'div', id = '') {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.hidden = false;
    this.disabled = false;
    this.value = '';
    this.textContent = '';
    this.children = [];
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.className = '';
    this.inert = false;
    this.parentElement = null;
    this.focusables = [];
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type, details = {}) {
    const event = {
      currentTarget: this,
      target: this,
      preventDefault: vi.fn(),
      key: details.key,
      ...details,
    };
    for (const listener of this.listeners.get(type) ?? []) listener(event);
    return event;
  }

  append(...children) {
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this.children = [...children];
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  querySelectorAll() {
    return this.focusables;
  }
}

function createDocument() {
  const ids = [
    'communityOpen',
    'communityModal',
    'communityBackdrop',
    'communityClose',
    'communitySearchForm',
    'communitySearchInput',
    'communityStatus',
    'communityGrid',
    'communityLoadMore',
    'communityPreview',
    'communityPreviewImage',
    'communityPreviewFallback',
    'communityPreviewTitle',
    'communityPreviewDescription',
    'communityPreviewApply',
    'communitySubmitForm',
    'communityPresetTitle',
    'communityPresetDescription',
    'communitySubmit',
  ];
  const nodes = new Map(ids.map((id) => [id, new FakeElement('div', id)]));
  nodes.get('communityModal').hidden = true;
  nodes.get('communityLoadMore').hidden = true;
  nodes.get('communityPreview').hidden = true;
  const documentListeners = new Map();
  const main = new FakeElement('main', 'main');
  // Mirror the real DOM: the modal is nested inside a wrapper div, not a
  // direct child of <body> (see the open() ancestor-walk).
  const wrapper = new FakeElement('div', 'legacyRoot');
  const document = {
    activeElement: nodes.get('communityOpen'),
    defaultView: { HTMLElement: FakeElement },
    getElementById: (id) => nodes.get(id) ?? null,
    createElement: (tag) => {
      const element = new FakeElement(tag);
      element.ownerDocument = document;
      return element;
    },
    body: { children: [wrapper] },
    addEventListener: vi.fn((type, listener) => {
      const listeners = documentListeners.get(type) ?? new Set();
      listeners.add(listener);
      documentListeners.set(type, listeners);
    }),
    removeEventListener: vi.fn((type, listener) => documentListeners.get(type)?.delete(listener)),
    dispatch(type, details = {}) {
      const event = {
        key: details.key,
        shiftKey: Boolean(details.shiftKey),
        preventDefault: vi.fn(),
      };
      for (const listener of documentListeners.get(type) ?? []) listener(event);
      return event;
    },
  };
  for (const node of nodes.values()) node.ownerDocument = document;
  main.ownerDocument = document;
  nodes.get('communityModal').focusables = [
    nodes.get('communityClose'),
    nodes.get('communitySearchInput'),
    nodes.get('communityPreviewApply'),
  ];
  const modal = nodes.get('communityModal');
  wrapper.append(main, modal);
  main.parentElement = wrapper;
  modal.parentElement = wrapper;
  wrapper.parentElement = document.body;
  return { document, main, nodes, wrapper };
}

function sourceProject() {
  return createProject({
    chat: {
      input: 'Gizli sohbet',
      font: 'Arial',
      colorAnchors: [{ wordId: 'secret', color: '#123456' }],
    },
    canvas: { background: { type: 'image', color: '#111111', assetId: 'background-secret' } },
    layers: [
      createImageLayer({
        id: 'locked-layer',
        assetId: 'asset-secret',
        locked: true,
      }),
    ],
    blocks: [createChatBlock({ id: 'chat-block', input: 'Blok gizlisi' })],
    fonts: [
      {
        id: 'font-secret',
        family: 'Özel',
        name: 'secret.woff2',
        type: 'font/woff2',
        size: 100,
      },
    ],
  });
}

function galleryPreset(id = 'preset-1') {
  const preset = extractCommunityPreset(
    createProject({
      chat: { font: 'Roboto', fontSize: 20, contrast: 'high' },
      canvas: { width: 1280, height: 720, background: { color: '#334455' } },
      blocks: [
        createChatBlock({
          transform: { x: 10, y: 20, width: 500, height: 240 },
        }),
      ],
    }),
    { title: 'Sinema', description: 'Sahne görünümü' }
  );
  return {
    id,
    title: preset.title,
    description: preset.description,
    appearance: preset.appearance,
    previewUrl: `/api/community/presets/${id}/preview`,
    publishedAt: '2026-07-13T12:00:00.000Z',
  };
}

function setup(overrides = {}) {
  const { document, main, nodes, wrapper } = createDocument();
  const client = {
    list: vi.fn().mockResolvedValue({ presets: [galleryPreset()], nextCursor: 'next-1' }),
    get: vi.fn().mockResolvedValue(galleryPreset()),
    submit: vi.fn().mockResolvedValue({ id: 'submission-1', status: 'pending' }),
  };
  const project = sourceProject();
  const history = createProjectHistory(project);
  const projectController = {
    commit: vi.fn((mutator) => history.commit(mutator)),
    undo: () => history.undo(),
    redo: () => history.redo(),
  };
  const dependencies = {
    client,
    projectController,
    getProject: () => history.current(),
    document,
    confirm: vi.fn(() => true),
    renderProject: vi.fn(),
    ...overrides,
  };
  return {
    client,
    controller: createCommunityController(dependencies),
    dependencies,
    document,
    history,
    main,
    nodes,
    project,
    projectController,
    wrapper,
  };
}

describe('community controller', () => {
  it('opens, searches, renders text-only cards, deduplicates pagination, and restores focus', async () => {
    const { client, controller, document, nodes } = setup();
    controller.init();
    await controller.open();

    expect(nodes.get('communityModal').hidden).toBe(false);
    expect(document.activeElement).toBe(nodes.get('communitySearchInput'));
    expect(nodes.get('communityGrid').children).toHaveLength(1);
    expect(nodes.get('communityGrid').children[0].textContent).not.toContain('<');
    expect(nodes.get('communityLoadMore').hidden).toBe(false);

    client.list.mockResolvedValueOnce({
      presets: [galleryPreset(), galleryPreset('preset-2')],
      nextCursor: null,
    });
    await controller.loadMore();
    expect(nodes.get('communityGrid').children).toHaveLength(2);

    controller.close();
    expect(nodes.get('communityModal').hidden).toBe(true);
    expect(document.activeElement).toBe(nodes.get('communityOpen'));
  });

  it('aborts a superseded search and ignores its stale result', async () => {
    const pending = [];
    const client = {
      list: vi.fn(
        ({ query, signal }) => new Promise((resolve) => pending.push({ query, signal, resolve }))
      ),
      get: vi.fn(),
      submit: vi.fn(),
    };
    const { controller, nodes } = setup({ client });
    controller.init();

    const first = controller.search('eski');
    const second = controller.search('yeni');
    expect(pending[0].signal.aborted).toBe(true);
    pending[1].resolve({ presets: [galleryPreset('new')], nextCursor: null });
    await second;
    pending[0].resolve({ presets: [galleryPreset('old')], nextCursor: null });
    await first;

    expect(nodes.get('communityGrid').children).toHaveLength(1);
    expect(nodes.get('communityGrid').children[0].dataset.presetId).toBe('new');
  });

  it('aborts and ignores stale load-more results when a new search starts', async () => {
    let resolveMore;
    const { client, controller, nodes } = setup();
    await controller.search('old');
    client.list.mockImplementationOnce(
      ({ signal }) =>
        new Promise((resolve) => {
          resolveMore = { resolve, signal };
        })
    );
    const loadingMore = controller.loadMore();
    await vi.waitFor(() => expect(resolveMore).toBeDefined());
    client.list.mockResolvedValueOnce({ presets: [galleryPreset('new')], nextCursor: null });

    await controller.search('new');
    expect(resolveMore.signal.aborted).toBe(true);
    resolveMore.resolve({ presets: [galleryPreset('stale')], nextCursor: null });
    await loadingMore;

    expect(nodes.get('communityGrid').children.map((card) => card.dataset.presetId)).toEqual([
      'new',
    ]);
  });

  it('caps cumulative deduplicated gallery state at 100 presets', async () => {
    const first = Array.from({ length: 99 }, (_, index) => galleryPreset(`preset-${index}`));
    const { client, controller, nodes } = setup();
    client.list.mockResolvedValueOnce({ presets: first, nextCursor: 'more' });
    await controller.search('');
    client.list.mockResolvedValueOnce({
      presets: Array.from({ length: 10 }, (_, index) => galleryPreset(`extra-${index}`)),
      nextCursor: 'still-more',
    });

    await controller.loadMore();

    expect(nodes.get('communityGrid').children).toHaveLength(100);
    expect(nodes.get('communityLoadMore').hidden).toBe(true);
  });

  it('applies a preset in one history commit and preserves private and locked state', async () => {
    const { controller, history, project, projectController, dependencies } = setup();
    controller.init();
    await controller.search('');
    const applied = await controller.apply('preset-1');

    expect(projectController.commit).toHaveBeenCalledTimes(1);
    expect(applied.chat.input).toBe(project.chat.input);
    expect(applied.chat.font).toBe('"Roboto", sans-serif');
    expect(applied.layers).toEqual(project.layers);
    expect(applied.layers[0].locked).toBe(true);
    expect(applied.fonts).toEqual(project.fonts);
    expect(applied.canvas.background.assetId).toBe('background-secret');
    expect(dependencies.renderProject).toHaveBeenCalledWith(applied);

    expect(projectController.undo()).toEqual(project);
    expect(projectController.redo()).toEqual(applied);
    expect(history.canUndo()).toBe(true);
  });

  it('rolls back the one-step apply and reports failure when rendering rejects', async () => {
    const renderProject = vi
      .fn()
      .mockRejectedValueOnce(new Error('render failed'))
      .mockResolvedValueOnce(undefined);
    const { controller, history, project, nodes } = setup({ renderProject });
    await controller.search('');

    await expect(controller.apply('preset-1')).rejects.toThrow('render failed');

    expect(history.current()).toEqual(project);
    expect(renderProject).toHaveBeenNthCalledWith(2, project);
    expect(nodes.get('communityStatus').textContent).toMatch(/uygulanamadı/i);
  });

  it('traps focus in the modal and restores background interactivity on close', async () => {
    const { controller, document, main, nodes, wrapper } = setup();
    controller.init();
    await controller.open();
    expect(main.inert).toBe(true);
    // The modal's own ancestor chain must stay interactive (regression: the
    // whole modal was inerted because it is not a direct child of <body>).
    expect(wrapper.inert).toBe(false);
    expect(nodes.get('communityModal').inert).toBe(false);
    nodes.get('communityPreviewApply').focus();

    const tab = document.dispatch('keydown', { key: 'Tab' });
    expect(tab.preventDefault).toHaveBeenCalled();
    expect(document.activeElement).toBe(nodes.get('communityClose'));

    await controller.open();
    controller.close();
    expect(main.inert).toBe(false);
  });

  it('submits only extracted appearance after explicit disclosure and reports pending state', async () => {
    const { client, controller, dependencies, nodes } = setup();
    controller.init();
    nodes.get('communityPresetTitle').value = 'Gizli olmayan başlık';
    nodes.get('communityPresetDescription').value = 'Yalnız görünüm';

    const submission = await controller.submit();
    expect(submission).toEqual({ id: 'submission-1', status: 'pending' });
    expect(dependencies.confirm).toHaveBeenCalledWith(
      expect.stringMatching(/sohbet metni.*görsel.*özel font/i)
    );
    const sent = client.submit.mock.calls[0][0];
    expect(JSON.stringify(sent)).not.toMatch(/Gizli sohbet|Blok gizlisi|asset-secret|font-secret/);
    expect(nodes.get('communityStatus').textContent).toMatch(/moderasyon/i);

    dependencies.confirm.mockReturnValueOnce(false);
    await expect(controller.submit()).resolves.toEqual({ status: 'cancelled' });
    expect(client.submit).toHaveBeenCalledTimes(1);
  });

  it('shows preview fallback without HTML injection', async () => {
    const { controller, nodes } = setup();
    controller.init();
    await controller.search('');
    await controller.preview('preset-1');
    expect(nodes.get('communityPreview').hidden).toBe(false);
    expect(nodes.get('communityPreviewTitle').textContent).toBe('Sinema');
    nodes.get('communityPreviewImage').dispatch('error');
    expect(nodes.get('communityPreviewImage').hidden).toBe(true);
    expect(nodes.get('communityPreviewFallback').hidden).toBe(false);
  });

  it('keeps cached apply available offline and cleans listeners, requests, and focus on destroy', async () => {
    const unavailable = Object.assign(new Error('offline'), { code: 'community_unavailable' });
    const { client, controller, document, nodes } = setup();
    controller.init();
    await controller.search('');
    client.list.mockRejectedValueOnce(unavailable);
    await controller.search('offline');

    expect(nodes.get('communityStatus').textContent).toMatch(/çevrimdışı|kullanılamıyor/i);
    expect(nodes.get('communitySubmit').disabled).toBe(true);
    await expect(controller.apply('preset-1')).resolves.toMatchObject({ chat: { fontSize: 20 } });

    controller.destroy();
    expect(nodes.get('communityModal').hidden).toBe(true);
    expect(document.removeEventListener).toHaveBeenCalled();
    expect(nodes.get('communityOpen').listeners.get('click')?.size ?? 0).toBe(0);
  });
});

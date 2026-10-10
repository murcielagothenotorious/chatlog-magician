import { describe, expect, it, vi } from 'vitest';

import {
  BUILT_IN_PRESETS,
  createCommunityController,
  createLocalPresetClient,
  generatePreviewSvgUri,
} from '../public/js/community-controller.ts';
import { validateCommunityPreset } from '../public/js/community-preset-contract.ts';
import { createProjectHistory } from '../public/js/project-history.ts';
import { createProject } from '../public/js/project-model.ts';

class MemoryStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.get(key) ?? null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

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

  click() {}
  remove() {}
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
    'communityImportBtn',
    'communityImportFile',
    'communityPasteBtn',
  ];
  const nodes = new Map(ids.map((id) => [id, new FakeElement('div', id)]));
  nodes.get('communityModal').hidden = true;
  nodes.get('communityLoadMore').hidden = true;
  nodes.get('communityPreview').hidden = true;
  const document = {
    activeElement: nodes.get('communityOpen'),
    defaultView: { HTMLElement: FakeElement },
    getElementById: (id) => nodes.get(id) ?? null,
    createElement: (tag) => {
      const element = new FakeElement(tag);
      element.ownerDocument = document;
      return element;
    },
    body: { children: [nodes.get('communityModal')], append: vi.fn() },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  for (const node of nodes.values()) node.ownerDocument = document;
  return { document, nodes };
}

describe('local preset client and built-ins', () => {
  it('validates all built-in presets conform to the community preset contract', () => {
    expect(BUILT_IN_PRESETS).toHaveLength(3);
    for (const preset of BUILT_IN_PRESETS) {
      expect(preset.id).toBeTruthy();
      expect(preset.title).toBeTruthy();
      expect(preset.isCustom).toBe(false);
      expect(preset.previewUrl).toContain('data:image/svg+xml');
      const validated = validateCommunityPreset({
        schemaVersion: 1,
        title: preset.title,
        description: preset.description,
        appearance: preset.appearance,
      });
      expect(validated.title).toBe(preset.title);
    }
  });

  it('generates XML-safe preview SVG data URIs', () => {
    const uri = generatePreviewSvgUri('Test <>&" Preset', {
      chat: { fontId: 'Arial', fontSize: 13 },
      canvas: { backgroundColor: '#112233' },
    });
    expect(uri).toContain('data:image/svg+xml');
    const decoded = decodeURIComponent(uri.replace('data:image/svg+xml;charset=utf-8,', ''));
    expect(decoded).toContain('Test &lt;&gt;&amp;&quot; Preset');
    expect(decoded).toContain('fill="#112233"');
  });

  it('lists, gets, submits, and deletes presets in local storage', async () => {
    const storage = new MemoryStorage();
    const client = createLocalPresetClient({ storage });

    const initial = await client.list();
    expect(initial.presets).toHaveLength(3);
    expect(initial.nextCursor).toBeNull();

    const searchResult = await client.list({ query: 'Sinematik' });
    expect(searchResult.presets).toHaveLength(1);
    expect(searchResult.presets[0].id).toBe('builtin-compact-cinema');

    const sample = BUILT_IN_PRESETS[0];
    const submission = await client.submit({
      title: 'Benim Özel Presetime',
      description: 'Yerel test preseti',
      appearance: sample.appearance,
    });
    expect(submission.status).toBe('saved');
    expect(submission.id).toMatch(/^local-/);

    const updated = await client.list();
    expect(updated.presets).toHaveLength(4);
    expect(updated.presets[0].id).toBe(submission.id);
    expect(updated.presets[0].isCustom).toBe(true);

    const fetched = await client.get(submission.id);
    expect(fetched.title).toBe('Benim Özel Presetime');

    const deletion = await client.delete(submission.id);
    expect(deletion.status).toBe('deleted');

    const afterDelete = await client.list();
    expect(afterDelete.presets).toHaveLength(3);
  });

  it('supports controller share, download, deletePreset, and importPreset flows', async () => {
    const storage = new MemoryStorage();
    const client = createLocalPresetClient({ storage });
    const { document, nodes } = createDocument();
    const project = createProject();
    const history = createProjectHistory(project);
    const projectController = {
      commit: vi.fn((m) => history.commit(m)),
      undo: vi.fn(() => history.undo()),
      redo: vi.fn(() => history.redo()),
    };

    const controller = createCommunityController({
      client,
      projectController,
      getProject: () => history.current(),
      document,
      confirm: vi.fn(() => true),
      renderProject: vi.fn(),
    });

    controller.init();
    await controller.search('');

    expect(nodes.get('communityGrid').children).toHaveLength(3);

    const originalClipboard = globalThis.navigator.clipboard;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    });

    await controller.share('builtin-gtaw-standard');
    expect(writeText).toHaveBeenCalledTimes(1);
    const copiedJson = JSON.parse(writeText.mock.calls[0][0]);
    expect(copiedJson.title).toBe('GTAW Standart');
    expect(copiedJson.schemaVersion).toBe(1);
    expect(nodes.get('communityStatus').textContent).toContain('kopyalandı');

    const newPresetJson = JSON.stringify({
      schemaVersion: 1,
      title: 'Dışarıdan Alınan Preset',
      description: 'Test paylaşım',
      appearance: BUILT_IN_PRESETS[1].appearance,
    });

    const imported = await controller.importPreset(newPresetJson);
    expect(imported).toBeTruthy();
    expect(nodes.get('communityStatus').textContent).toContain('başarıyla içe aktarıldı');
    expect(nodes.get('communityGrid').children).toHaveLength(4);

    const invalidImport = await controller.importPreset('{"invalid": true}');
    expect(invalidImport).toBeNull();
    expect(nodes.get('communityStatus').textContent).toContain('Geçersiz preset formatı');

    const customCardId = nodes.get('communityGrid').children[0].dataset.presetId;
    const deleted = await controller.deletePreset(customCardId);
    expect(deleted).toBe(true);
    expect(nodes.get('communityGrid').children).toHaveLength(3);

    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
      writable: true,
    });
  });

  it('preserves custom fontSize and lineLength when submitting and applying a preset', async () => {
    const storage = new MemoryStorage();
    const { document, nodes } = createDocument();
    const customProject = createProject({
      chat: {
        fontSize: 15,
        lineLength: 85,
        lineSpacing: 1.4,
      },
    });
    let renderedSnapshot = null;
    const history = createProjectHistory(customProject);
    const controller = createCommunityController({
      client: createLocalPresetClient({ storage }),
      projectController: {
        getSnapshot: () => history.current(),
        captureCurrentChat: vi.fn(() => history.current()),
        commit: (m) => history.commit(m),
        undo: () => history.undo(),
      },
      getProject: () => history.current(),
      document,
      confirm: vi.fn(() => true),
      renderProject: vi.fn((snapshot) => {
        renderedSnapshot = snapshot;
      }),
    });

    controller.init();
    nodes.get('communityPresetTitle').value = 'Özel 15-85 Preset';
    const result = await controller.submit();
    expect(result).toBeTruthy();

    const client = createLocalPresetClient({ storage });
    const list = await client.list();
    const saved = list.presets.find((p) => p.title === 'Özel 15-85 Preset');
    expect(saved).toBeDefined();
    expect(saved.appearance.chat.fontSize).toBe(15);
    expect(saved.appearance.chat.lineLength).toBe(85);

    await controller.apply(saved.id);
    expect(renderedSnapshot.chat.fontSize).toBe(15);
    expect(renderedSnapshot.chat.lineLength).toBe(85);
  });
});

import { describe, expect, it } from 'vitest';
import {
  PROJECT_SCHEMA_VERSION,
  createProject,
  deserializeProject,
  normalizeProject,
  serializeProject,
} from '../public/js/project-model.ts';

describe('project model', () => {
  it('creates an independent default project', () => {
    const first = createProject();
    const second = createProject();
    first.chat.characterNames.push('Ada Lovelace');
    expect(second.chat.characterNames).toEqual([]);
    expect(first.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
    expect(first.canvas).toMatchObject({ width: 600, height: 600 });
  });

  it('preserves explicit saved canvas dimensions', () => {
    expect(createProject({ canvas: { width: 1280, height: 720 } }).canvas).toMatchObject({
      width: 1280,
      height: 720,
    });
  });

  it('merges nested overrides and generates missing metadata', () => {
    const project = createProject({
      metadata: { title: 'Gece Vardiyasi' },
      chat: { background: { enabled: true } },
      canvas: { padding: { x: 24 } },
    });

    expect(project.metadata).toMatchObject({
      title: 'Gece Vardiyasi',
      id: expect.any(String),
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(project.metadata.id).not.toBe('');
    expect(project.chat.background).toEqual({ enabled: true, color: '#000000', opacity: 1 });
    expect(project.canvas.padding).toEqual({ x: 24, y: 0 });
  });

  it('normalizes numeric limits and canonical option values', () => {
    const project = normalizeProject({
      chat: {
        fontSize: -1,
        lineLength: 1001.9,
        lineSpacing: Number.POSITIVE_INFINITY,
        background: { opacity: -0.5 },
      },
      canvas: {
        width: 99.9,
        height: 5000,
        fitMode: 'invalid',
        composition: 'below',
        padding: { x: 9000, y: -1 },
      },
      export: { format: 'jpg', jpegQuality: 0, ppi: 601.8 },
    });

    expect(project.chat).toMatchObject({
      fontSize: 8,
      lineLength: 1000,
      lineSpacing: 1.3,
      background: { opacity: 0 },
    });
    expect(project.canvas).toMatchObject({
      width: 100,
      height: 4320,
      fitMode: 'fit',
      composition: 'below',
      padding: { x: 7680, y: 0 },
    });
    expect(project.export).toEqual({ format: 'jpeg', jpegQuality: 0.1, ppi: 600 });
  });

  it('round-trips only serializable data', () => {
    const project = createProject({
      chat: { input: 'John Doe says: Selam', lineSpacing: 1.45 },
    });
    expect(deserializeProject(serializeProject(project))).toEqual(project);
  });

  it('keeps only normalized persistent custom font metadata', () => {
    const project = createProject({
      fonts: [
        {
          id: 'font-1',
          family: 'Rol Fontu',
          name: 'rol.woff2',
          type: 'font/woff2',
          size: 2048,
          objectUrl: 'discarded',
        },
        { id: 'blob:unsafe', family: 'Unsafe', name: 'unsafe.ttf', type: 'font/ttf', size: 10 },
        {
          id: 'font-large',
          family: 'Large',
          name: 'large.otf',
          type: 'font/otf',
          size: 6 * 1024 * 1024,
        },
      ],
    });

    expect(project.fonts).toEqual([
      {
        id: 'font-1',
        family: 'Rol Fontu',
        name: 'rol.woff2',
        type: 'font/woff2',
        size: 2048,
      },
    ]);
  });

  it('rejects functions and DOM-like objects during serialization', () => {
    const withFunction = createProject();
    withFunction.layers.push({ render() {} });
    expect(() => serializeProject(withFunction)).toThrow(/serializable data/i);

    const withDomNode = createProject();
    withDomNode.blocks.push({ nodeType: 1, nodeName: 'DIV' });
    expect(() => serializeProject(withDomNode)).toThrow(/DOM-like object/i);
  });

  it('rejects blob URLs outside chat input without interpreting chat markup', () => {
    const freeFormChat = createProject({
      chat: { input: 'blob:https://example.test/chat\n<div>literal roleplay text</div>' },
    });
    expect(() => serializeProject(freeFormChat)).not.toThrow();

    const project = createProject({
      layers: [{ source: 'blob:https://example.test/transient-image' }],
    });
    expect(() => serializeProject(project)).toThrow(/blob URL/i);
  });

  it.each([
    ['layers', 'generatedHtml'],
    ['layers', 'generatedHTML'],
    ['blocks', 'html'],
    ['blocks', 'node'],
    ['layers', 'renderedHtml'],
    ['blocks', 'customMarkup'],
  ])('rejects transient scene key %s.%s', (collection, transientKey) => {
    const project = createProject({
      [collection]: [{ nested: { [transientKey]: '<div>generated</div>' } }],
    });
    expect(() => serializeProject(project)).toThrow(/transient scene data/i);
  });

  it.each(['element', 'domNode'])('rejects transient font key fonts.%s', (transientKey) => {
    const project = createProject();
    project.fonts.push({ nested: { [transientKey]: '<div>generated</div>' } });
    expect(() => serializeProject(project)).toThrow(/transient scene data/i);
  });

  it.each([
    ['chat.generatedHtml', { chat: { generatedHtml: '<div>generated</div>' } }],
    ['canvas.previewMarkup', { canvas: { previewMarkup: '<canvas>preview</canvas>' } }],
    ['metadata.domNode', { metadata: { domNode: { nodeName: 'DIV' } } }],
  ])('rejects global transient key %s during serialization and deserialization', (_, payload) => {
    expect(() => serializeProject(createProject(payload))).toThrow(/transient scene data/i);
    expect(() => deserializeProject(JSON.stringify(payload))).toThrow(/transient scene data/i);
  });

  it('rejects whitespace and case-obscured blob URLs in scene payloads', () => {
    const project = createProject({
      blocks: [{ nested: { source: ' \tBlOb:https://example.test/transient-image' } }],
    });
    expect(() => serializeProject(project)).toThrow(/blob URL/i);
  });

  it('rejects whitespace and case-obscured blob URLs in canvas background fields', () => {
    const project = createProject({
      canvas: {
        background: { type: 'image', assetId: ' \n\tBlOb:https://example.test/background' },
      },
    });

    expect(() => serializeProject(project)).toThrow(/blob URL/i);
  });

  it('rejects transient and blob payloads during deserialization', () => {
    expect(() =>
      deserializeProject(
        JSON.stringify({
          layers: [{ generatedHtml: '<div>transient</div>' }],
        })
      )
    ).toThrow(/transient scene data/i);

    expect(() =>
      deserializeProject(
        JSON.stringify({
          canvas: {
            background: { type: 'image', assetId: ' \tBLOB:https://example.test/background' },
          },
        })
      )
    ).toThrow(/blob URL/i);
  });

  it('preserves free-form chat input containing blob text and markup during deserialization', () => {
    const input = '  BLOB:https://example.test/as-text\n<div>literal roleplay text</div>';

    expect(deserializeProject(JSON.stringify({ chat: { input } })).chat.input).toBe(input);
  });

  it('preserves literal markup in legitimate block input and text fields', () => {
    const project = createProject({
      blocks: [
        {
          input: '<div>roleplay text</div>',
          text: 'A character says: <span>not generated markup</span>',
        },
      ],
    });
    expect(deserializeProject(serializeProject(project)).blocks).toEqual(project.blocks);
  });

  it.each(['null', '[]', '"project"', '42', 'true', 'false'])(
    'rejects non-object JSON root %s',
    (json) => {
      expect(() => deserializeProject(json)).toThrow(/plain object/i);
    }
  );

  it.each([Number.POSITIVE_INFINITY, '1', 1.5, 0, -1, null])(
    'rejects malformed schema version %s',
    (schemaVersion) => {
      expect(() => normalizeProject({ schemaVersion })).toThrow(/invalid project version/i);
    }
  );

  it('rejects an overflowing JSON schema version', () => {
    expect(() => deserializeProject('{"schemaVersion":1e400}')).toThrow(/invalid project version/i);
  });

  it('rejects unsupported future versions', () => {
    expect(() => deserializeProject(JSON.stringify({ schemaVersion: 999 }))).toThrow(
      /unsupported project version/i
    );
  });
});

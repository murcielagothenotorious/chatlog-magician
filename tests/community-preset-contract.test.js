import { describe, expect, it } from 'vitest';
import { createChatBlock, createImageLayer } from '../public/js/canvas-scene.ts';
import {
  BUILT_IN_COMMUNITY_FONT_IDS,
  COMMUNITY_PRESET_SCHEMA_VERSION,
  createPresetProjectPatch,
  extractCommunityPreset,
  migrateCommunityPreset,
  validateCommunityPreset,
} from '../public/js/community-preset-contract.ts';
import { createProject, serializeProject } from '../public/js/project-model.ts';

function createSourceProject() {
  return createProject({
    metadata: { id: 'project-secret', title: 'Gizli Proje' },
    chat: {
      input: 'John Doe says: gizli sohbet',
      font: 'Arial',
      fontSize: 16,
      lineSpacing: 1.5,
      contrast: 'high',
      censorStyle: 'blur',
      hideSystemMessages: false,
      characterNames: ['John Doe'],
      colorAnchors: [{ wordId: 'secret-anchor', color: '#123456' }],
    },
    canvas: {
      width: 1280,
      height: 720,
      background: { type: 'image', color: '#112233', assetId: 'background-secret' },
      composition: 'inset',
      padding: { x: 24, y: 32 },
    },
    layers: [createImageLayer({ id: 'layer-secret', assetId: 'asset-secret' })],
    blocks: [
      createChatBlock({
        id: 'block-secret',
        input: 'blok sohbeti',
        opacity: 0.75,
        transform: { x: 40, y: 50, width: 600, height: 300 },
        style: { font: 'custom-secret', color: '#ffffff' },
      }),
    ],
    fonts: [
      {
        id: 'font-secret',
        family: 'Özel Font',
        name: 'secret.woff2',
        type: 'font/woff2',
        size: 1024,
      },
    ],
    export: { format: 'jpeg', jpegQuality: 0.6, ppi: 144 },
  });
}

function createValidPreset(overrides = {}) {
  const source = createSourceProject();
  const preset = extractCommunityPreset(source, {
    title: 'Sinema',
    description: 'Yüksek kontrastlı görünüm',
  });
  return { ...globalThis.structuredClone(preset), ...overrides };
}

function expectPresetError(callback, code) {
  try {
    callback();
  } catch (error) {
    expect(error).toMatchObject({ code });
    return;
  }
  throw new Error(`Expected community preset error ${code}`);
}

describe('community preset contract', () => {
  it.each(['ftp://files.example/x', 'file:///etc/passwd', 'mailto:user@example.com', 'tel:+90123'])(
    'rejects every URL-like scheme in preset strings: %s',
    (title) => {
      expect(() =>
        extractCommunityPreset(createProject(), { title, description: '' })
      ).toThrowError(expect.objectContaining({ code: 'preset_unsafe_string' }));
    }
  );

  it('rejects enumerable non-index properties on block layout arrays', () => {
    const preset = JSON.parse(JSON.stringify(createValidPreset()));
    Object.defineProperty(preset.appearance.blockLayout, 'trackingUrl', {
      value: 'safe-looking-value',
      enumerable: true,
    });

    expect(() => validateCommunityPreset(preset)).toThrowError(
      expect.objectContaining({ code: 'preset_unknown_field' })
    );
  });
  it('extracts only the versioned appearance and layout allowlist', () => {
    const source = createSourceProject();
    const preset = extractCommunityPreset(source, {
      title: ' Sinema ',
      description: ' Yüksek kontrastlı görünüm ',
    });

    expect(preset).toEqual({
      schemaVersion: COMMUNITY_PRESET_SCHEMA_VERSION,
      title: 'Sinema',
      description: 'Yüksek kontrastlı görünüm',
      appearance: {
        chat: {
          fontId: 'Arial',
          fontSize: 16,
          lineHeight: 1.5,
          contrast: 'high',
          censorMode: 'blur',
          showSystemMessages: true,
          lineLength: 77,
        },
        canvas: { width: 1280, height: 720, backgroundColor: '#112233' },
        blockLayout: [
          {
            x: 40,
            y: 50,
            width: 600,
            height: 300,
            opacity: 0.75,
            composition: 'inset',
            paddingX: 24,
            paddingY: 32,
          },
        ],
      },
    });
    expect(JSON.stringify(preset)).not.toMatch(
      /gizli sohbet|blok sohbeti|asset-secret|font-secret|project-secret|custom-secret/i
    );
    expect(Object.isFrozen(preset.appearance.blockLayout[0])).toBe(true);
  });

  it('validates and clones version 1 without mutating the caller', () => {
    const source = createValidPreset();
    const migrated = migrateCommunityPreset(source);
    const validated = validateCommunityPreset(source);

    expect(migrated).toEqual(source);
    expect(migrated).not.toBe(source);
    expect(validated).toEqual(source);
    expect(Object.isFrozen(validated)).toBe(true);
    expect(source).not.toBe(validated);
  });

  it.each([
    ['appearance', (preset) => (preset.appearance = null)],
    ['chat', (preset) => (preset.appearance.chat = [])],
    ['canvas', (preset) => (preset.appearance.canvas = 'invalid')],
    ['block layout', (preset) => (preset.appearance.blockLayout = {})],
  ])('returns a stable field error for malformed %s containers', (_, mutate) => {
    const preset = createValidPreset();
    mutate(preset);
    expectPresetError(() => validateCommunityPreset(preset), 'preset_invalid_field');
  });

  it.each([0, 2, 99, 1.5, '1', undefined])(
    'rejects unsupported or malformed schema version %s',
    (schemaVersion) => {
      const preset = createValidPreset();
      if (schemaVersion === undefined) delete preset.schemaVersion;
      else preset.schemaVersion = schemaVersion;

      expectPresetError(
        () => migrateCommunityPreset(preset),
        Number.isInteger(schemaVersion) && schemaVersion > COMMUNITY_PRESET_SCHEMA_VERSION
          ? 'preset_unsupported_version'
          : 'preset_invalid_version'
      );
    }
  );

  it.each([
    ['root field', (preset) => Object.assign(preset, { layers: [] })],
    ['nested chat field', (preset) => Object.assign(preset.appearance.chat, { input: 'secret' })],
    [
      'nested canvas field',
      (preset) => Object.assign(preset.appearance.canvas, { assetId: 'asset' }),
    ],
    [
      'nested block field',
      (preset) => Object.assign(preset.appearance.blockLayout[0], { text: 'secret' }),
    ],
    ['custom fonts', (preset) => Object.assign(preset, { fonts: [] })],
  ])('rejects unknown or forbidden %s', (_, mutate) => {
    const preset = createValidPreset();
    mutate(preset);
    expectPresetError(() => validateCommunityPreset(preset), 'preset_unknown_field');
  });

  it.each(['__proto__', 'constructor', 'prototype'])(
    'rejects recursively unsafe own key %s without prototype pollution',
    (key) => {
      const preset = createValidPreset();
      preset.appearance.chat = JSON.parse(
        `{"fontId":"Arial","fontSize":12,"lineHeight":1.3,"contrast":"off","censorMode":"remove","showSystemMessages":false,"${key}":{"polluted":true}}`
      );

      expectPresetError(() => validateCommunityPreset(preset), 'preset_unsafe_value');
      expect({}.polluted).toBeUndefined();
    }
  );

  it('rejects accessors, symbols, non-plain objects, and cycles before reading values', () => {
    const withGetter = createValidPreset();
    let getterCalled = false;
    Object.defineProperty(withGetter.appearance.chat, 'fontId', {
      enumerable: true,
      get() {
        getterCalled = true;
        return 'Arial';
      },
    });
    expectPresetError(() => validateCommunityPreset(withGetter), 'preset_unsafe_value');
    expect(getterCalled).toBe(false);

    const withSymbol = createValidPreset();
    withSymbol[Symbol('secret')] = true;
    expectPresetError(() => validateCommunityPreset(withSymbol), 'preset_unsafe_value');

    const nonPlain = createValidPreset();
    nonPlain.appearance.canvas = new (class CanvasAppearance {})();
    expectPresetError(() => validateCommunityPreset(nonPlain), 'preset_unsafe_value');

    const cyclic = createValidPreset();
    cyclic.appearance.self = cyclic;
    expectPresetError(() => validateCommunityPreset(cyclic), 'preset_unsafe_value');
  });

  it.each([
    'https://example.test/preset',
    'data:text/html;base64,PHNjcmlwdD4=',
    'javascript:alert(1)',
    '<img src=x onerror=alert(1)>',
    'body { background: url(//example.test/x) }',
    '@import "evil.css"',
    'expression(alert(1))',
  ])('rejects URL, HTML, CSS, or script-like string %s', (title) => {
    expectPresetError(
      () => validateCommunityPreset(createValidPreset({ title })),
      'preset_unsafe_string'
    );
  });

  it('enforces built-in fonts, enums, booleans, colors, finite numeric bounds, and shared composition', () => {
    expect(BUILT_IN_COMMUNITY_FONT_IDS).toContain('Arial');

    const mutations = [
      (preset) => (preset.appearance.chat.fontId = 'font-secret'),
      (preset) => (preset.appearance.chat.fontSize = 7),
      (preset) => (preset.appearance.chat.lineHeight = Number.NaN),
      (preset) => (preset.appearance.chat.contrast = 'extreme'),
      (preset) => (preset.appearance.chat.censorMode = 'html'),
      (preset) => (preset.appearance.chat.showSystemMessages = 'yes'),
      (preset) => (preset.appearance.canvas.backgroundColor = 'red'),
      (preset) => (preset.appearance.canvas.width = 99),
      (preset) => (preset.appearance.blockLayout[0].opacity = 2),
      (preset) => (preset.appearance.blockLayout[0].composition = 'side'),
    ];

    for (const mutate of mutations) {
      const preset = createValidPreset();
      mutate(preset);
      expectPresetError(() => validateCommunityPreset(preset), 'preset_invalid_field');
    }

    const inconsistent = createValidPreset();
    inconsistent.appearance.blockLayout.push({
      ...inconsistent.appearance.blockLayout[0],
      composition: 'below',
    });
    expectPresetError(() => validateCommunityPreset(inconsistent), 'preset_inconsistent_layout');
  });

  it('enforces Unicode text, block count, depth, and encoded byte limits', () => {
    expectPresetError(
      () => validateCommunityPreset(createValidPreset({ title: '😀'.repeat(61) })),
      'preset_invalid_field'
    );

    const tooManyBlocks = createValidPreset();
    tooManyBlocks.appearance.blockLayout = Array.from({ length: 9 }, () => ({
      ...tooManyBlocks.appearance.blockLayout[0],
    }));
    expectPresetError(() => validateCommunityPreset(tooManyBlocks), 'preset_too_many_blocks');

    const tooLarge = createValidPreset({ description: '😀'.repeat(241) });
    expectPresetError(() => validateCommunityPreset(tooLarge), 'preset_invalid_field');
  });

  it('applies one serializable appearance snapshot while preserving private project state', () => {
    const source = createSourceProject();
    const sourceBefore = globalThis.structuredClone(source);
    const preset = createValidPreset();
    preset.appearance.chat = {
      fontId: 'Roboto',
      fontSize: 20,
      lineHeight: 1.8,
      contrast: 'low',
      censorMode: 'remove',
      showSystemMessages: false,
    };
    preset.appearance.canvas = { width: 1920, height: 1080, backgroundColor: '#AABBCC' };
    preset.appearance.blockLayout[0] = {
      x: 100,
      y: 110,
      width: 900,
      height: 500,
      opacity: 0.4,
      composition: 'below',
      paddingX: 12,
      paddingY: 14,
    };

    const applied = createPresetProjectPatch(source, preset);

    expect(applied.chat).toMatchObject({
      input: source.chat.input,
      font: '"Roboto", sans-serif',
      fontSize: 20,
      lineSpacing: 1.8,
      contrast: 'low',
      censorStyle: 'remove',
      hideSystemMessages: true,
      characterNames: source.chat.characterNames,
      colorAnchors: source.chat.colorAnchors,
    });
    expect(applied.canvas).toMatchObject({
      width: 1920,
      height: 1080,
      composition: 'below',
      padding: { x: 12, y: 14 },
      background: { type: 'solid', color: '#AABBCC', assetId: 'background-secret' },
    });
    expect(applied.blocks[0]).toMatchObject({
      id: 'block-secret',
      input: 'blok sohbeti',
      style: source.blocks[0].style,
      opacity: 0.4,
      transform: { x: 100, y: 110, width: 900, height: 500, rotation: 0 },
    });
    expect(applied.layers).toEqual(source.layers);
    expect(applied.fonts).toEqual(source.fonts);
    expect(applied.metadata).toEqual(source.metadata);
    expect(applied.export).toEqual(source.export);
    expect(source).toEqual(sourceBefore);
    expect(() => serializeProject(applied)).not.toThrow();
  });

  it('rejects invalid source projects and leaves both inputs untouched on failure', () => {
    const source = createSourceProject();
    source.layers[0].generatedHtml = '<div>unsafe</div>';
    const preset = createValidPreset();
    const presetBefore = globalThis.structuredClone(preset);

    expect(() => createPresetProjectPatch(source, preset)).toThrow(/transient scene data/i);
    expect(preset).toEqual(presetBefore);
    expect(source.layers[0].generatedHtml).toBe('<div>unsafe</div>');
  });
});

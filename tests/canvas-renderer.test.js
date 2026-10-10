import { describe, expect, it, vi } from 'vitest';
import { createProject } from '../public/js/project-model.ts';
import { canvasCompositionLayout, createCanvasRenderer } from '../public/js/canvas-renderer.ts';
import { createFakeAssets, createFakeCanvas } from './helpers/canvas-fakes.js';

function callsOf(canvas, name) {
  return canvas.context.drawCalls.filter(([method]) => method === name);
}

function createRenderer(options = {}) {
  const exportCanvas = options.exportCanvas ?? createFakeCanvas();
  return {
    exportCanvas,
    renderer: createCanvasRenderer({
      createCanvas: () => exportCanvas,
      assetRegistry: options.assetRegistry ?? createFakeAssets(),
      formatBlock: options.formatBlock ?? (() => []),
      navigator: options.navigator,
      document: options.document,
      createObjectURL: options.createObjectURL,
      revokeObjectURL: options.revokeObjectURL,
    }),
  };
}

describe('canvas renderer', () => {
  it.each([
    ['project custom family', 'Rol Fontu', undefined, '700 12px Rol Fontu'],
    ['block custom family', 'Rol Fontu', 'Blok Fontu', '700 12px Blok Fontu'],
    ['missing family fallback', '', '', '700 12px Arial'],
  ])('uses %s in the canvas context', async (_, projectFont, blockFont, expectedFont) => {
    const target = createFakeCanvas();
    const project = createProject({
      chat: { font: projectFont },
      blocks: [
        {
          kind: 'chat',
          id: 'chat',
          input: 'Selam',
          visible: true,
          opacity: 1,
          scale: 1,
          anchor: 'left',
          transform: { x: 0, y: 0, width: 160, height: 40, rotation: 0 },
          style: {
            ...(blockFont === undefined ? {} : { font: blockFont }),
            fontSize: 12,
            fontWeight: 700,
          },
        },
      ],
    });
    const { renderer } = createRenderer({
      formatBlock: () => [
        [{ text: 'Selam', color: '#ffffff', italic: false, censored: false, remove: false }],
      ],
    });

    await renderer.render(project, target);

    expect(target.context.drawCalls).toContainEqual(['set', 'font', expectedFont]);
  });

  it('does not draw a hidden background in preview or export', async () => {
    const background = { width: 40, height: 20, tag: 'background' };
    const project = createProject({
      canvas: {
        width: 100,
        height: 50,
        background: { type: 'image', assetId: 'background', visible: false },
      },
    });
    const target = createFakeCanvas();
    const { exportCanvas, renderer } = createRenderer({
      assetRegistry: createFakeAssets({
        background: { source: background, width: 40, height: 20 },
      }),
    });

    await renderer.render(project, target);
    await renderer.toBlob(project);

    expect(callsOf(target, 'drawImage')).toEqual([]);
    expect(callsOf(exportCanvas, 'drawImage')).toEqual([]);
  });

  it.each([
    ['fit', [0, 25, 100, 50]],
    ['fill', [-50, 0, 200, 100]],
    ['stretch', [0, 0, 100, 100]],
  ])('draws an image background with exact %s geometry', async (fitMode, expected) => {
    const source = { width: 200, height: 100, tag: 'background' };
    const target = createFakeCanvas();
    const project = createProject({
      canvas: {
        width: 100,
        height: 100,
        fitMode,
        background: { type: 'image', assetId: 'background' },
      },
    });
    const { renderer } = createRenderer({
      assetRegistry: createFakeAssets({
        background: { source, width: 200, height: 100 },
      }),
    });

    await renderer.render(project, target);

    expect(callsOf(target, 'drawImage')).toContainEqual(['drawImage', source, ...expected]);
  });

  it('publishes composition dimensions and item origins for interaction geometry', () => {
    const project = createProject({
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

    expect(canvasCompositionLayout(project.canvas, project.blocks)).toEqual({
      width: 320,
      height: 290,
      sceneOrigin: { x: 0, y: 0 },
      chatOrigin: { x: 10, y: 202 },
    });
  });

  it.each([
    ['png', 'image/png', undefined],
    ['jpeg', 'image/jpeg', 0.55],
  ])('exports %s with its normalized MIME and quality', async (format, mime, quality) => {
    const project = createProject({ export: { format, jpegQuality: 0.55 } });
    const { exportCanvas, renderer } = createRenderer();

    const blob = await renderer.toBlob(project);

    expect(blob.type).toBe(mime);
    expect(exportCanvas.lastBlobRequest).toEqual([mime, quality]);
  });

  it('applies clamped solid background opacity and restores alpha before layers', async () => {
    const target = createFakeCanvas();
    const layerSource = { width: 20, height: 20, tag: 'layer' };
    const project = createProject({
      canvas: {
        background: { type: 'solid', color: '#112233', opacity: 1.4 },
      },
      layers: [
        {
          id: 'layer',
          kind: 'image',
          assetId: 'layer',
          visible: true,
          opacity: 1,
          zIndex: 0,
          effects: {},
          transform: { x: 0, y: 0, width: 20, height: 20, rotation: 0 },
        },
      ],
    });
    const { renderer } = createRenderer({
      assetRegistry: createFakeAssets({
        layer: { source: layerSource, width: 20, height: 20 },
      }),
    });

    await renderer.render(project, target);

    const alpha = target.context.drawCalls.findIndex(
      (call) => call[0] === 'set' && call[1] === 'globalAlpha'
    );
    const backgroundFill = target.context.drawCalls.findIndex((call) => call[0] === 'fillRect');
    const restore = target.context.drawCalls.findIndex((call) => call[0] === 'restore');
    const layerDraw = target.context.drawCalls.findIndex(
      (call) => call[0] === 'drawImage' && call[1] === layerSource
    );
    expect(target.context.drawCalls[alpha]).toEqual(['set', 'globalAlpha', 1]);
    expect(alpha).toBeLessThan(backgroundFill);
    expect(backgroundFill).toBeLessThan(restore);
    expect(restore).toBeLessThan(layerDraw);
  });

  it('applies image background opacity and restores alpha after drawing it', async () => {
    const target = createFakeCanvas();
    const background = { width: 40, height: 20, tag: 'background' };
    const project = createProject({
      canvas: {
        width: 100,
        height: 50,
        background: { type: 'image', assetId: 'background', opacity: 0.35 },
      },
    });
    const { renderer } = createRenderer({
      assetRegistry: createFakeAssets({
        background: { source: background, width: 40, height: 20 },
      }),
    });

    await renderer.render(project, target);

    const alpha = target.context.drawCalls.findIndex(
      (call) => call[0] === 'set' && call[1] === 'globalAlpha'
    );
    const backgroundDraw = target.context.drawCalls.findIndex(
      (call) => call[0] === 'drawImage' && call[1] === background
    );
    const restore = target.context.drawCalls.findIndex((call) => call[0] === 'restore');
    expect(target.context.drawCalls[alpha]).toEqual(['set', 'globalAlpha', 0.35]);
    expect(alpha).toBeLessThan(backgroundDraw);
    expect(backgroundDraw).toBeLessThan(restore);
  });

  it('uses one draw path for preview and jpeg blob output', async () => {
    const target = createFakeCanvas();
    const project = createProject({
      canvas: { background: { type: 'solid', color: '#112233' } },
    });
    const { exportCanvas, renderer } = createRenderer();

    await renderer.render(project, target);
    const blob = await renderer.toBlob(project, { format: 'jpeg', jpegQuality: 0.6 });

    expect(target.context.drawCalls).toEqual(exportCanvas.context.drawCalls);
    expect(target.context.drawCalls.length).toBeGreaterThan(0);
    expect(exportCanvas.lastBlobRequest).toEqual(['image/jpeg', 0.6]);
    expect(blob).toBeInstanceOf(globalThis.Blob);
  });

  it.each([
    ['overlay', 320, 180, [10, 22]],
    ['below', 320, 242, [10, 202]],
    ['inset', 340, 224, [10, 22]],
  ])(
    'applies %s composition dimensions and content origin',
    async (composition, width, height, origin) => {
      const target = createFakeCanvas();
      const project = createProject({
        canvas: {
          width: 320,
          height: 180,
          composition,
          padding: { x: 10, y: 22 },
          background: { type: 'solid', color: '#123456' },
        },
        blocks: [
          {
            kind: 'chat',
            id: 'chat',
            input: 'Selam',
            visible: true,
            zIndex: 0,
            opacity: 1,
            scale: 1,
            anchor: 'left',
            transform: { x: 0, y: 0, width: 160, height: 40, rotation: 0 },
            style: { fontSize: 12 },
          },
        ],
      });
      const { renderer } = createRenderer({
        formatBlock: () => [[{ text: 'Selam', color: '#ffffff' }]],
      });

      await renderer.render(project, target);

      expect([target.width, target.height]).toEqual([width, height]);
      expect(callsOf(target, 'translate')).toContainEqual(['translate', ...origin]);
    }
  );

  it('draws background, z-ordered image layers, then formatted chat with styling', async () => {
    const target = createFakeCanvas();
    const background = { width: 400, height: 200, tag: 'background' };
    const back = { width: 80, height: 60, tag: 'back' };
    const front = { width: 100, height: 50, tag: 'front' };
    const assets = createFakeAssets({
      bg: { source: background, width: 400, height: 200 },
      back: { source: back, width: 80, height: 60 },
      front: { source: front, width: 100, height: 50 },
    });
    const block = {
      kind: 'chat',
      id: 'chat',
      input: 'Selam dÃ¼nya',
      visible: true,
      zIndex: 0,
      opacity: 0.7,
      scale: 1.5,
      anchor: 'center',
      transform: { x: 20, y: 30, width: 100, height: 50, rotation: 0 },
      style: {
        font: 'Arial',
        fontSize: 12,
        fontWeight: 700,
        lineSpacing: 1.5,
        outline: 2,
        outlineColor: '#000000',
        background: { enabled: true, color: '#334455', opacity: 0.4 },
      },
    };
    const project = createProject({
      canvas: {
        width: 200,
        height: 100,
        fitMode: 'fill',
        background: { type: 'image', assetId: 'bg' },
      },
      layers: [
        {
          kind: 'image',
          id: 'front',
          assetId: 'front',
          visible: true,
          opacity: 0.6,
          zIndex: 10,
          effects: { blur: 2, brightness: 1.2, contrast: 0.8 },
          transform: { x: 100, y: 50, width: 100, height: 50, rotation: 90 },
        },
        {
          kind: 'image',
          id: 'back',
          assetId: 'back',
          visible: true,
          opacity: 1,
          zIndex: -2,
          effects: {},
          transform: { x: 0, y: 0, width: 80, height: 60, rotation: 0 },
        },
      ],
      blocks: [block],
    });
    const formatBlock = vi.fn(() => [
      [
        { text: 'Selam ', color: '#ffffff', italic: false, censored: false, remove: false },
        { text: 'dÃ¼nya', color: '#56d64b', italic: true, censored: true, remove: false },
      ],
    ]);
    const { renderer } = createRenderer({ assetRegistry: assets, formatBlock });

    await renderer.render(project, target);

    const images = callsOf(target, 'drawImage');
    expect(images.map((call) => call[1])).toEqual([background, back, front]);
    expect(images[0].slice(2)).toEqual([0, 0, 200, 100]);
    expect(callsOf(target, 'rotate')).toContainEqual(['rotate', Math.PI / 2]);
    expect(target.context.drawCalls).toContainEqual([
      'set',
      'filter',
      'blur(2px) brightness(1.2) contrast(0.8)',
    ]);
    expect(target.context.drawCalls).toContainEqual(['set', 'fillStyle', '#334455']);
    expect(callsOf(target, 'fillRect').length).toBeGreaterThan(0);
    expect(callsOf(target, 'strokeText').length).toBeGreaterThan(0);
    expect(callsOf(target, 'fillText').flat()).toContain('Selam ');
    expect(callsOf(target, 'fillText').flat()).toContain('dÃ¼nya');
    expect(formatBlock).toHaveBeenCalledWith(block, project.chat);
  });

  it('wraps segments to the block width and omits removed censor text', async () => {
    const target = createFakeCanvas();
    const block = {
      kind: 'chat',
      id: 'chat',
      input: 'line',
      visible: true,
      opacity: 1,
      scale: 1,
      anchor: 'right',
      zIndex: 0,
      transform: { x: 0, y: 0, width: 40, height: 100, rotation: 0 },
      style: { fontSize: 12 },
    };
    const project = createProject({ blocks: [block] });
    const { renderer } = createRenderer({
      formatBlock: () => [
        [
          { text: 'bir iki Ã¼Ã§', color: '#fff' },
          { text: 'gizli', color: '#fff', censored: true, remove: true },
        ],
      ],
    });

    await renderer.render(project, target);

    const texts = callsOf(target, 'fillText').map(([, text]) => text);
    expect(texts).toEqual(['bir ', 'iki ', 'Ã¼Ã§']);
    expect(texts).not.toContain('gizli');
  });

  it('copies the shared rendered blob and downloads it with a normalized extension', async () => {
    const write = vi.fn(async () => {});
    const click = vi.fn();
    const remove = vi.fn();
    const append = vi.fn();
    const anchor = { click, remove };
    const document = {
      createElement: vi.fn(() => anchor),
      body: { appendChild: append },
    };
    const createObjectURL = vi.fn(() => 'blob:download');
    const revokeObjectURL = vi.fn();
    const { renderer } = createRenderer({
      navigator: { clipboard: { write } },
      document,
      createObjectURL,
      revokeObjectURL,
    });
    const project = createProject({ export: { format: 'jpeg', jpegQuality: 0.7 } });

    const copied = await renderer.copy(project);
    const downloaded = await renderer.download(project, 'sahne.png');

    expect(copied.type).toBe('image/jpeg');
    expect(write).toHaveBeenCalledTimes(1);
    expect(downloaded).toBe('sahne.jpg');
    expect(anchor).toMatchObject({ href: 'blob:download', download: 'sahne.jpg' });
    expect(append).toHaveBeenCalledWith(anchor);
    expect(click).toHaveBeenCalled();
    expect(remove).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:download');
  });

  it('applies blur filter and film grain to background image', async () => {
    const background = { width: 100, height: 100, tag: 'bg' };
    const project = createProject({
      canvas: {
        width: 200,
        height: 200,
        background: {
          type: 'image',
          assetId: 'bg',
          visible: true,
          blur: 5,
          grain: 30,
        },
      },
    });
    const target = createFakeCanvas();
    const { renderer } = createRenderer({
      assetRegistry: createFakeAssets({ bg: { source: background, width: 100, height: 100 } }),
    });

    await renderer.render(project, target);

    expect(target.context.drawCalls).toContainEqual(['set', 'filter', 'blur(5px)']);
    expect(callsOf(target, 'fillRect').length).toBeGreaterThan(0);
  });

  it('draws visible redaction boxes as black rectangles and ignores hidden ones', async () => {
    const project = createProject({
      canvas: { width: 200, height: 200 },
      redactionBoxes: [
        { id: 'box-1', x: 20, y: 30, width: 50, height: 20, visible: true },
        { id: 'box-hidden', x: 100, y: 100, width: 40, height: 40, visible: false },
        { id: 'box-rotated', x: 10, y: 10, width: 30, height: 15, rotation: 45, visible: true },
      ],
    });
    const target = createFakeCanvas();
    const { renderer } = createRenderer();

    await renderer.render(project, target);

    expect(target.context.drawCalls).toContainEqual(['set', 'fillStyle', '#000000']);
    expect(target.context.drawCalls).toContainEqual(['fillRect', 20, 30, 50, 20]);
    const fillRects = callsOf(target, 'fillRect');
    expect(fillRects.some((call) => call[1] === 100 && call[2] === 100)).toBe(false);
  });

  it('enforces GTAW look styling (Arial, outline 2) when chat.gtawLook is true', async () => {
    const project = createProject({
      chat: { gtawLook: true, font: 'Times New Roman', contrast: 'low' },
      blocks: [
        {
          kind: 'chat',
          id: 'chat',
          input: 'Selam GTAW',
          visible: true,
          transform: { x: 0, y: 0, width: 200, height: 40, rotation: 0 },
        },
      ],
    });
    const target = createFakeCanvas();
    const { renderer } = createRenderer({
      formatBlock: () => [[{ text: 'Selam GTAW', color: '#ffffff' }]],
    });

    await renderer.render(project, target);

    expect(target.context.drawCalls).toContainEqual(['set', 'font', '700 12px Arial']);
    expect(target.context.drawCalls).toContainEqual(['set', 'lineWidth', 4]);
  });


  it('draws a black redaction rectangle for opsec-flagged remove segments and skips fillText', async () => {
    const target = createFakeCanvas();
    const block = {
      kind: 'chat',
      id: 'chat',
      input: 'line',
      visible: true,
      opacity: 1,
      scale: 1,
      anchor: 'left',
      zIndex: 0,
      transform: { x: 0, y: 0, width: 200, height: 100, rotation: 0 },
      style: { fontSize: 12 },
    };
    const project = createProject({ blocks: [block] });
    const { renderer } = createRenderer({
      formatBlock: () => [
        [
          { text: 'acik metin', color: '#fff', remove: false, opsec: false },
          { text: 'gizli', color: '#fff', censored: true, remove: true, opsec: true },
        ],
      ],
    });

    await renderer.render(project, target);

    const texts = callsOf(target, 'fillText').map(([, text]) => text);
    expect(texts).not.toContain('gizli');
    expect(target.context.drawCalls).toContainEqual(['set', 'fillStyle', '#000000']);
    expect(callsOf(target, 'fillRect').length).toBeGreaterThan(0);
  });

  it('skips non-opsec remove segments without drawing any redaction bar', async () => {
    const target = createFakeCanvas();
    const block = {
      kind: 'chat',
      id: 'chat',
      input: 'line',
      visible: true,
      opacity: 1,
      scale: 1,
      anchor: 'left',
      zIndex: 0,
      transform: { x: 0, y: 0, width: 200, height: 100, rotation: 0 },
      style: { fontSize: 12 },
    };
    const project = createProject({ blocks: [block] });
    const { renderer } = createRenderer({
      formatBlock: () => [
        [
          { text: 'acik metin', color: '#fff', remove: false, opsec: false },
          { text: 'gizli', color: '#fff', censored: true, remove: true, opsec: false },
        ],
      ],
    });

    await renderer.render(project, target);

    const texts = callsOf(target, 'fillText').map(([, text]) => text);
    expect(texts).not.toContain('gizli');
    expect(callsOf(target, 'fillRect').length).toBe(0);
  });
});

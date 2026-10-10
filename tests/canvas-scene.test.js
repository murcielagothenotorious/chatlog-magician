import { describe, expect, it } from 'vitest';
import { createProject } from '../public/js/project-model.ts';
import {
  addSceneItem,
  assertOpaqueAssetId,
  createChatBlock,
  createImageLayer,
  moveSceneItem,
  removeSceneItem,
  sceneBounds,
  selectSceneItem,
  snapSceneItem,
  updateSceneItem,
} from '../public/js/canvas-scene.ts';

describe('canvas scene', () => {
  it('accepts opaque asset tokens unchanged', () => {
    const assetId = '550e8400-e29b-41d4-a716-446655440000';

    expect(assertOpaqueAssetId(assetId)).toBe(assetId);
    expect(createImageLayer({ id: 'image-1', assetId }).assetId).toBe(assetId);
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['empty', ''],
    ['whitespace', 'asset id'],
    ['blob URL', 'blob:https://example.test/runtime'],
    ['data URL', 'data:image/png;base64,AAAA'],
    ['HTTPS URL', 'https://example.test/image.png'],
    ['HTTP URL', 'http://example.test/image.png'],
    ['path', 'assets/image.png'],
    ['invalid prefix', '-asset-id'],
    ['overlength', `a${'b'.repeat(128)}`],
    ['bytes', new Uint8Array([1, 2, 3])],
  ])('rejects non-opaque asset IDs: %s', (_, assetId) => {
    expect(() => assertOpaqueAssetId(assetId)).toThrow(TypeError);
    expect(() => createImageLayer({ id: 'image-1', assetId })).toThrow(TypeError);
  });

  it('preserves segment opsec flags through chat block normalization', () => {
    const block = createChatBlock({
      id: 'chat-1',
      formattedLines: [
        [
          {
            text: 'gizli',
            color: '#f1f1f1',
            italic: false,
            censored: false,
            remove: true,
            opsec: true,
          },
        ],
        [{ text: 'açık', color: '#f1f1f1' }],
      ],
    });

    expect(block.formattedLines[0][0].opsec).toBe(true);
    expect(block.formattedLines[1][0].opsec).toBe(false);
  });

  it('rejects an invalid asset ID patch without mutating the source layer', () => {
    const project = addSceneItem(
      createProject(),
      createImageLayer({ id: 'image-1', assetId: 'asset-1' })
    );

    expect(() => updateSceneItem(project, 'image-1', { assetId: 'blob:runtime-only' })).toThrow(
      TypeError
    );
    expect(project.layers[0].assetId).toBe('asset-1');
  });

  it('rejects a JSON-parsed own __proto__ key in scene data', () => {
    const unsafe = JSON.parse('{"nested":{"__proto__":{"polluted":true}}}');

    expect(() => createImageLayer({ id: 'image-1', assetId: 'asset-1', effects: unsafe })).toThrow(
      /unsafe key/i
    );
    expect(() => createChatBlock({ id: 'chat-1', style: unsafe })).toThrow(/unsafe key/i);
  });

  it.each(['constructor', 'prototype'])('rejects a nested own %s key in scene data', (key) => {
    const unsafe = JSON.parse(`{"nested":{"${key}":{}}}`);

    expect(() => createImageLayer({ id: 'image-1', assetId: 'asset-1', effects: unsafe })).toThrow(
      /unsafe key/i
    );
    expect(() => createChatBlock({ id: 'chat-1', style: unsafe })).toThrow(/unsafe key/i);
  });

  it.each(['__proto__', 'constructor', 'prototype'])(
    'rejects a recursively unsafe own %s key in update patches',
    (key) => {
      const project = addSceneItem(
        createProject(),
        createImageLayer({ id: 'image-1', assetId: 'asset-1' })
      );
      const unsafePatch = JSON.parse(`{"nested":{"${key}":{}}}`);

      expect(() => updateSceneItem(project, 'image-1', unsafePatch)).toThrow(/unsafe key/i);
      expect(project.layers[0]).not.toHaveProperty('nested');
    }
  );

  it('creates serializable image layers and chat blocks', () => {
    expect(createImageLayer({ id: 'image-1', assetId: 'asset-1' })).toMatchObject({
      id: 'image-1',
      kind: 'image',
      assetId: 'asset-1',
      visible: true,
      locked: false,
      opacity: 1,
      zIndex: 0,
      transform: { x: 0, y: 0, width: 640, height: 360, rotation: 0 },
    });
    expect(createChatBlock({ id: 'chat-1', input: 'Selam' })).toMatchObject({
      id: 'chat-1',
      kind: 'chat',
      input: 'Selam',
      anchor: 'left',
      scale: 1,
      opacity: 1,
      source: 'custom',
      formattedLines: [],
    });
  });

  it('normalizes linked chat sources and clones plain formatted segments', () => {
    const formattedLines = [
      [
        {
          text: 'John Doe says: Selam',
          color: '#f1f1f1',
          italic: false,
          censored: false,
          remove: false,
        },
      ],
    ];

    const block = createChatBlock({ source: 'main-chat', formattedLines });
    formattedLines[0][0].text = 'changed';

    expect(block.source).toBe('main-chat');
    expect(block.formattedLines).toEqual([
      [
        {
          text: 'John Doe says: Selam',
          color: '#f1f1f1',
          italic: false,
          censored: false,
          remove: false,
          opsec: false,
        },
      ],
    ]);
    expect(createChatBlock({ source: 'unknown' }).source).toBe('custom');
  });

  it('rejects unsafe or non-serializable formatted chat segments', () => {
    const unsafe = JSON.parse('[[{"text":"x","__proto__":{"polluted":true}}]]');

    expect(() => createChatBlock({ formattedLines: unsafe })).toThrow(/unsafe key/i);
    expect(() =>
      createChatBlock({ formattedLines: [[{ text: 'x', color: () => '#fff' }]] })
    ).toThrow(/serializable data/i);
  });

  it('normalizes constrained scene item fields', () => {
    expect(
      createImageLayer({
        id: 'image-1',
        assetId: 'asset-1',
        opacity: 2,
        transform: { width: 0, height: -20, rotation: 540 },
      })
    ).toMatchObject({
      opacity: 1,
      transform: { width: 1, height: 1, rotation: 180 },
    });
    expect(
      createChatBlock({ id: 'chat-1', anchor: 'invalid', opacity: -1, scale: 10 })
    ).toMatchObject({
      anchor: 'left',
      opacity: 0,
      scale: 4,
    });
    expect(createChatBlock({ id: 'chat-2', scale: 0 })).toMatchObject({ scale: 0.25 });
  });

  it('adds image layers and chat blocks to their canonical collections', () => {
    const source = createProject();
    const withLayer = addSceneItem(source, createImageLayer({ id: 'image-1', assetId: 'asset-1' }));
    const withBlock = addSceneItem(withLayer, createChatBlock({ id: 'chat-1' }));

    expect(source).toMatchObject({ layers: [], blocks: [] });
    expect(withBlock.layers.map(({ id }) => id)).toEqual(['image-1']);
    expect(withBlock.blocks.map(({ id }) => id)).toEqual(['chat-1']);
    expect(withBlock).not.toBe(withLayer);
  });

  it('updates, reorders, and removes without mutating the source project', () => {
    const source = addSceneItem(createProject(), createImageLayer({ id: 'a', assetId: 'asset-a' }));
    const updated = updateSceneItem(source, 'a', { locked: true });
    const moved = moveSceneItem(updated, 'a', 'front');
    expect(source.layers[0].locked).toBe(false);
    expect(moved.layers[0]).toMatchObject({ locked: true, zIndex: 0 });
    expect(removeSceneItem(moved, 'a').layers).toEqual([]);
  });

  it('moves items within their own collection and renumbers z indexes', () => {
    const project = createProject({
      layers: [
        createImageLayer({ id: 'back', assetId: 'asset-back', zIndex: 9 }),
        createImageLayer({ id: 'middle', assetId: 'asset-middle', zIndex: 2 }),
        createImageLayer({ id: 'front', assetId: 'asset-front', zIndex: 20 }),
      ],
      blocks: [createChatBlock({ id: 'chat', zIndex: 30 })],
    });

    const toFront = moveSceneItem(project, 'middle', 'front');
    expect(toFront.layers.map(({ id, zIndex }) => [id, zIndex])).toEqual([
      ['back', 0],
      ['front', 1],
      ['middle', 2],
    ]);
    expect(toFront.blocks).toEqual(project.blocks);

    const backward = moveSceneItem(toFront, 'middle', 'backward');
    expect(backward.layers.map(({ id, zIndex }) => [id, zIndex])).toEqual([
      ['back', 0],
      ['middle', 1],
      ['front', 2],
    ]);
    expect(moveSceneItem(backward, 'front', 'back').layers[0].id).toBe('front');
    expect(moveSceneItem(backward, 'back', 'forward').layers[1].id).toBe('back');
  });

  it('selects a detached scene item without storing selection in the project', () => {
    const project = addSceneItem(
      createProject(),
      createChatBlock({ id: 'chat-1', input: 'Selam' })
    );
    const selected = selectSceneItem(project, 'chat-1');

    selected.input = 'Degisti';
    expect(project.blocks[0].input).toBe('Selam');
    expect(project).not.toHaveProperty('selection');
    expect(selectSceneItem(project, 'missing')).toBeNull();
  });

  it('snaps an unlocked item to canvas and peer edges', () => {
    const result = snapSceneItem(
      { x: 3, y: 202, width: 100, height: 50 },
      [{ x: 300, y: 200, width: 50, height: 50 }],
      { width: 400, height: 300, tolerance: 5 }
    );
    expect(result).toMatchObject({ x: 0, y: 200 });
  });

  it('snaps opposite item edges and preserves the source transform', () => {
    const source = { x: 202, y: 100, width: 100, height: 50, rotation: 12 };
    const result = snapSceneItem(source, [{ x: 300, y: 400, width: 50, height: 50 }], {
      width: 500,
      height: 500,
      tolerance: 5,
    });

    expect(result).toEqual({ x: 200, y: 100, width: 100, height: 50, rotation: 12 });
    expect(source.x).toBe(202);
  });

  it('calculates the union of visible finite positive scene transforms', () => {
    const project = createProject({
      layers: [
        createImageLayer({
          id: 'visible-layer',
          assetId: 'asset-visible',
          transform: { x: -10, y: 20, width: 100, height: 50 },
        }),
        createImageLayer({
          id: 'hidden-layer',
          assetId: 'asset-hidden',
          visible: false,
          transform: { x: -100, y: -100, width: 400, height: 400 },
        }),
      ],
      blocks: [
        createChatBlock({
          id: 'visible-block',
          transform: { x: 80, y: 10, width: 40, height: 30 },
        }),
        { id: 'invalid-block', kind: 'chat', visible: true, transform: { width: 0, height: 2 } },
      ],
    });

    expect(sceneBounds(project)).toEqual({ x: -10, y: 10, width: 130, height: 60 });
    expect(sceneBounds(createProject())).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it('selects, updates, and removes redaction boxes in scene operations', () => {
    const project = createProject({
      redactionBoxes: [
        { id: 'box-1', x: 50, y: 60, width: 120, height: 30, visible: true },
        { id: 'box-2', x: 10, y: 20, width: 40, height: 40, visible: false },
      ],
    });

    const selected = selectSceneItem(project, 'box-1');
    expect(selected).toMatchObject({
      id: 'box-1',
      kind: 'redaction',
      transform: { x: 50, y: 60, width: 120, height: 30 },
      visible: true,
    });

    const updated = updateSceneItem(project, 'box-1', {
      transform: { x: 70, y: 80, width: 150, height: 35 },
      visible: false,
    });
    expect(updated.redactionBoxes[0]).toMatchObject({
      id: 'box-1',
      x: 70,
      y: 80,
      width: 150,
      height: 35,
      visible: false,
    });

    const removed = removeSceneItem(updated, 'box-1');
    expect(removed.redactionBoxes.map((b) => b.id)).toEqual(['box-2']);
  });
});

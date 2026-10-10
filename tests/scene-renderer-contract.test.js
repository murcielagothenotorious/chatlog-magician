import { describe, expect, it } from 'vitest';
import { createProject, deserializeProject, serializeProject } from '../public/js/project-model.ts';
import { createProjectHistory } from '../public/js/project-history.ts';
import {
  createRenderPlan,
  extensionForFormat,
  mimeTypeForFormat,
  normalizeExportOptions,
} from '../public/js/scene-renderer-contract.ts';

describe('scene renderer contract', () => {
  it('normalizes supported export formats and numeric bounds', () => {
    expect(normalizeExportOptions({ format: 'jpg', jpegQuality: 3 })).toEqual({
      format: 'jpeg',
      jpegQuality: 1,
      ppi: 96,
    });
    expect(normalizeExportOptions({ format: 'png', jpegQuality: 0, ppi: 601 })).toEqual({
      format: 'png',
      jpegQuality: 0.1,
      ppi: 600,
    });
  });

  it('uses canonical defaults for unsupported and non-finite export values', () => {
    expect(
      normalizeExportOptions({
        format: 'webp',
        jpegQuality: Number.NaN,
        ppi: Number.POSITIVE_INFINITY,
      })
    ).toEqual({ format: 'png', jpegQuality: 0.8, ppi: 96 });
    expect(normalizeExportOptions()).toEqual({ format: 'png', jpegQuality: 0.8, ppi: 96 });
  });

  it.each([
    ['png', 'image/png', 'png'],
    ['jpeg', 'image/jpeg', 'jpg'],
    ['jpg', 'image/jpeg', 'jpg'],
    ['webp', 'image/png', 'png'],
  ])('maps %s to its normalized MIME type and extension', (format, mimeType, extension) => {
    expect(mimeTypeForFormat(format)).toBe(mimeType);
    expect(extensionForFormat(format)).toBe(extension);
  });

  it('creates a stable plan containing only visible layers and blocks ordered by z index', () => {
    const project = createProject({
      canvas: { width: 1280, height: 720 },
      layers: [
        { id: 'high', zIndex: 20 },
        { id: 'equal-first', zIndex: 1 },
        { id: 'hidden-layer', zIndex: -10, visible: false },
        { id: 'equal-second', zIndex: 1 },
      ],
      blocks: [
        { id: 'front', zIndex: 8 },
        { id: 'hidden-block', zIndex: -20, visible: false },
        { id: 'back', zIndex: -2 },
      ],
      export: { format: 'jpg', jpegQuality: 0.7, ppi: 144 },
    });

    const plan = createRenderPlan(project);

    expect(Object.keys(plan)).toEqual(['canvas', 'layers', 'blocks', 'redactionBoxes', 'export']);
    expect(plan.canvas).toEqual(project.canvas);
    expect(plan.layers.map((layer) => layer.id)).toEqual(['equal-first', 'equal-second', 'high']);
    expect(plan.blocks.map((block) => block.id)).toEqual(['back', 'front']);
    expect(plan.redactionBoxes).toEqual([]);
    expect(plan.export).toEqual({ format: 'jpeg', jpegQuality: 0.7, ppi: 144 });
  });

  it('returns a deeply cloned plan without mutating the project', () => {
    const project = createProject({
      canvas: { background: { type: 'color', color: '#123456' } },
      layers: [{ id: 'layer', zIndex: 2, transform: { x: 10 } }],
      blocks: [{ id: 'block', zIndex: 1, style: { color: '#ffffff' } }],
    });
    const original = globalThis.structuredClone(project);

    const plan = createRenderPlan(project);
    plan.canvas.background.color = '#000000';
    plan.layers[0].transform.x = 99;
    plan.blocks[0].style.color = '#ff0000';

    expect(project).toEqual(original);
    expect(plan.canvas).not.toBe(project.canvas);
    expect(plan.layers[0]).not.toBe(project.layers[0]);
    expect(plan.blocks[0]).not.toBe(project.blocks[0]);
  });

  it('creates a render plan from a project accepted by deserialization and history', () => {
    const deserialized = deserializeProject(
      serializeProject(
        createProject({
          canvas: { width: 1280, height: 720 },
          layers: [{ id: 'background', zIndex: -1, source: 'assets/background.png' }],
          blocks: [{ id: 'chat', zIndex: 2, text: '<span>roleplay text</span>' }],
        })
      )
    );
    const history = createProjectHistory(deserialized);
    const accepted = history.commit((draft) => {
      draft.blocks[0].style = { color: '#ffffff' };
    });

    expect(() => createRenderPlan(accepted)).not.toThrow();
    expect(createRenderPlan(accepted)).toMatchObject({
      canvas: { width: 1280, height: 720 },
      layers: [{ id: 'background' }],
      blocks: [{ id: 'chat', style: { color: '#ffffff' } }],
    });
  });

  it('rejects transient project state from direct callers', () => {
    const project = createProject();
    project.canvas.previewMarkup = '<canvas>transient preview</canvas>';

    expect(() => createRenderPlan(project)).toThrow(/transient scene data/i);
  });
});

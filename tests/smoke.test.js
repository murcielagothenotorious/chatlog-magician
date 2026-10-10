import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import { renderLegacyBody } from './helpers/render-legacy-body';

const layoutPath = fileURLToPath(new URL('../app/layout.tsx', import.meta.url));
const scriptsPath = fileURLToPath(new URL('../app/legacy/legacy-scripts.ts', import.meta.url));
const controllerPath = fileURLToPath(
  new URL('../public/js/project-controller.ts', import.meta.url)
);
const canvasControllerPath = fileURLToPath(
  new URL('../public/js/canvas-controller.ts', import.meta.url)
);
const canvasStylesPath = fileURLToPath(new URL('../styles/canvas-workspace.css', import.meta.url));
const rootPath = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));

describe('smoke', () => {
  it('runs the test harness', () => {
    expect(true).toBe(true);
  });

  it('loads the controller modules inside the legacy-main bundle, after the early bundle', () => {
    const scripts = readFileSync(scriptsPath, 'utf8');
    const earlyScriptIndex = scripts.indexOf('/js/legacy-early.js?v=');
    const mainScriptIndex = scripts.indexOf('/js/legacy-main.js?v=');

    expect(earlyScriptIndex).toBeGreaterThan(-1);
    expect(mainScriptIndex).toBeGreaterThan(earlyScriptIndex);
    expect(scripts).not.toContain('type="module"');
  });

  it('chains init, ui-utils, and the three controllers in original order inside the bundle entry', () => {
    // The bundle is a single IIFE: execution order is the import order of
    // scripts/legacy-main.ts, so it must mirror the original tag order.
    const entry = readFileSync(rootPath('scripts/legacy-main.ts'), 'utf8');
    const order = [
      '/js/chat.js',
      '/color-palette/color-palette.js',
      '/js/chatlog-parser.js',
      '/js/app.js',
      '/js/init.js',
      '/js/ui-utils.js',
      '/js/project-controller.js',
      '/js/canvas-controller.js',
      '/js/local-projects-controller.js',
    ];
    let previous = -1;
    for (const marker of order) {
      const index = entry.indexOf(marker);
      expect(index, `${marker} must be imported in order`).toBeGreaterThan(previous);
      previous = index;
    }
  });

  it('connects the project controller to each foundation module', () => {
    expect(existsSync(controllerPath)).toBe(true);
    if (!existsSync(controllerPath)) return;

    const controller = readFileSync(controllerPath, 'utf8');

    expect(controller).toContain("from './project-model.js'");
    expect(controller).toContain("from './project-history.js'");
    expect(controller).toContain("from './project-state-bridge.js'");
  });

  it('loads the gated canvas workspace stylesheet and controller module exactly once', () => {
    const layout = readFileSync(layoutPath, 'utf8');
    const entry = readFileSync(rootPath('scripts/legacy-main.ts'), 'utf8');

    expect(layout.match(/\.\.\/styles\/canvas-workspace\.css/g)).toHaveLength(1);
    expect(entry.match(/\/js\/canvas-controller\.js/g)).toHaveLength(1);
    expect(existsSync(canvasControllerPath)).toBe(true);
    expect(existsSync(canvasStylesPath)).toBe(true);
    expect(layout).toContain('data-canvas-ready="true"');
  });

  it('provides segmented mode controls and the required canvas workspace landmarks', () => {
    const html = renderLegacyBody();

    expect(html).not.toContain('id="toggleMode"');
    for (const id of [
      'modeChat',
      'modeCanvas',
      'canvasWorkspace',
      'canvasViewport',
      'canvasStage',
      'canvasPreview',
      'canvasSelection',
      'canvasGuides',
      'canvasLayerList',
    ]) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toMatch(/id="output"[\s\S]*id="canvasWorkspace"/);
    expect(html).toMatch(/id="canvasPreview"[^>]*aria-label=/);
    expect(html).toMatch(/id="canvasStatus"[^>]*aria-live="polite"/);
    expect(html).toContain('id="canvasBackgroundUpload"');
    expect(html).toContain('id="canvasImageUpload"');
    expect(html).not.toContain('Fotoğraf Modu Bakıma Alındı');
    expect(html).not.toContain('Fotoğraf Modu Nasıl Kullanılır?');
  });
});

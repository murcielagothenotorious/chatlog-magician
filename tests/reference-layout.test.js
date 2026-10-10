import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import { renderLegacyBody } from './helpers/render-legacy-body';

const rootPath = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const layoutPath = rootPath('app/layout.tsx');
const stylesPath = rootPath('styles/reference-layout.css');

describe('reference-aligned workspace layout', () => {
  it('orders editor, toolbar, preview, and export controls like the reference', () => {
    const html = renderLegacyBody();
    const layout = readFileSync(layoutPath, 'utf8');
    const editor = html.indexOf('id="chatlogInput"');
    const toolbar = html.indexOf('class="button-group minimal-group workspace-toolbar"');
    const upload = html.indexOf('id="txtUploadArea"');
    const preview = html.indexOf('id="output"');
    const actions = html.indexOf('class="output-actions"');

    expect(layout).toContain('className="reference-shell"');
    expect(html).toContain('class="quick-settings"');
    expect(editor).toBeGreaterThan(-1);
    expect(toolbar).toBeGreaterThan(editor);
    expect(upload).toBeGreaterThan(toolbar);
    expect(preview).toBeGreaterThan(upload);
    expect(actions).toBeGreaterThan(preview);
  });

  it('loads the reference layout last and keeps render font ownership elsewhere', () => {
    const layout = readFileSync(layoutPath, 'utf8');

    expect(existsSync(stylesPath)).toBe(true);
    expect(layout.indexOf('styles/reference-layout.css')).toBeGreaterThan(
      layout.indexOf('styles/help-tour.css')
    );

    if (!existsSync(stylesPath)) return;
    const styles = readFileSync(stylesPath, 'utf8');
    expect(styles).toContain("--ui-font: 'Inter'");
    expect(styles).toContain('background: #060708');
    expect(styles).toMatch(/#main > \.grid-container[\s\S]*margin-inline:\s*auto/);
    expect(styles).toMatch(
      /:where\(button, input,[^}]+font-family:\s*var\(--ui-font\) !important/s
    );
    expect(styles).toMatch(/\.quick-settings[\s\S]*background:\s*#f7f7f8/);
    expect(styles).toMatch(/#chatlogInput[\s\S]*border:\s*2px solid #2869bd/);
    expect(styles).not.toMatch(
      /(?:#output(?![\w-])|\.output(?![\w-])|\.generated(?![\w-])|\.history-item-text(?![\w-]))[^{]*\{[^}]*font-family:/s
    );
    expect(styles).not.toContain('transition: all');
  });

  it('keeps the preview surface out of copied and downloaded output', () => {
    const html = renderLegacyBody();
    const styles = readFileSync(stylesPath, 'utf8');

    expect(html).toMatch(/class="output-preview-surface"[^>]*>\s*<div id="output"/);
    expect(styles).toMatch(/\.output-preview-surface\s*\{[^}]*background:\s*#222327/s);
    expect(styles).toMatch(
      /#output:not\(\.background-active\)\s*\{[^}]*background:\s*transparent/s
    );
    expect(styles).not.toMatch(/\.reference-shell #output\s*\{[^}]*background:\s*#222327/s);
  });
});

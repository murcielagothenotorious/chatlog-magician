import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

const sourcePath = fileURLToPath(
  new URL('../public/color-palette/color-palette.ts', import.meta.url)
);
const source = readFileSync(sourcePath, 'utf8');
const scripts = readFileSync(
  fileURLToPath(new URL('../app/legacy/legacy-scripts.ts', import.meta.url)),
  'utf8'
);

describe('output text selection coloring', () => {
  it('opens coloring mode with the colorable words covered by a native selection', () => {
    expect(source).toContain(".on('mouseup.nativeSelection', handleNativeTextSelection)");
    expect(source).toContain('window.getSelection()');
    expect(source).toContain('range.intersectsNode(element)');
    expect(source).toContain('enterColoringMode(matchedElements)');
    // color-palette ships inside the legacy-main bundle, behind the single
    // ?v= cache-buster (was its own per-module tag).
    expect(scripts).toContain('/js/legacy-main.js?v=');
  });

  it('removes the native selection listener during cleanup', () => {
    expect(source).toContain("$output.off('mouseup.nativeSelection')");
  });
});

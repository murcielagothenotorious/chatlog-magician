import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import { renderLegacyBody } from './helpers/render-legacy-body';

const rootPath = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const html = renderLegacyBody();
const layout = readFileSync(rootPath('app/layout.tsx'), 'utf8');
const styles = readFileSync(rootPath('styles/reference-layout.css'), 'utf8');
const init = readFileSync(rootPath('public/js/init.ts'), 'utf8');
const uiUtils = readFileSync(rootPath('public/js/ui-utils.ts'), 'utf8');

describe('compact mode-aware chrome', () => {
  it('keeps the quick settings focused on the three primary inputs', () => {
    const quickSettings = html.slice(
      html.indexOf('class="quick-settings"'),
      html.indexOf('<label for="chatlogInput"')
    );

    expect(quickSettings).toContain('id="font-label"');
    expect(quickSettings).toContain('id="lineLengthInput"');
    expect(quickSettings).toContain('id="characterNameInput"');
    expect(quickSettings).not.toContain('id="lineSpacingInput"');
    expect(quickSettings).not.toContain('grid-x');
    expect(styles).toMatch(
      /\.quick-settings\s*\{[^}]*grid-template-columns:\s*148px 148px minmax\(320px, 1fr\)/s
    );
  });

  it('supports locale switching and defaults to Turkish with TR, EN, ES, RU available', () => {
    expect(html).toContain('id="localeSelect"');
    expect(layout).toMatch(/<html[^>]*lang="tr"/);
    expect(init).toContain("document.getElementById('localeSelect')");
  });

  it('groups frequent formatting controls and moves secondary actions into one popup', () => {
    expect(html).toContain('class="chat-format-toolbar"');
    expect(html).toContain('<div class="workspace-toolbar-row">');
    expect(html).toContain('class="toolbar-overflow"');
    expect(html).toContain('class="toolbar-overflow__panel"');
    const overflow = html.slice(
      html.indexOf('class="toolbar-overflow"'),
      html.indexOf('</details>', html.indexOf('class="toolbar-overflow"'))
    );
    for (const id of [
      'lineSpacingInput',
      'floatingSysMsgToggle',
      'toggleItalicParsing',
      'toggleWhisperColoring',
      'communityOpen',
      'openFeaturesBtn',
      'showHelpBtn',
      'openFeedbackBtn',
    ]) {
      expect(overflow).toContain(`id="${id}"`);
    }
    const outputActions = html.slice(
      html.indexOf('class="output-actions"'),
      html.indexOf('</div>', html.indexOf('class="output-actions"'))
    );
    expect(outputActions).toContain('id="toggleContrast"');
    expect(init).toContain("toolbarOverflow.removeAttribute('open')");
    expect(styles).toMatch(/\.workspace-toolbar\s*\{[^}]*gap:\s*4px/s);
    expect(styles).toMatch(/\.chat-format-toolbar\s*\{[^}]*margin-inline-start:\s*0/s);
    expect(styles).toMatch(/\.toolbar-overflow\s*\{[^}]*margin-inline-start:\s*auto/s);
    expect(styles).toContain('--toolbar-control-size: 36px');
    expect(styles).toMatch(
      /\.canvas-mode-switch\s*\{[^}]*min-height:\s*var\(--toolbar-control-size\)/s
    );
    expect(styles).toMatch(
      /\.toolbar-overflow > summary\s*\{[^}]*width:\s*var\(--toolbar-control-size\)[^}]*height:\s*var\(--toolbar-control-size\)/s
    );
    expect(styles).toMatch(
      /#txtUploadArea,\s*\.reference-shell #toggleBackground\s*\{[^}]*box-sizing:\s*border-box !important[^}]*block-size:\s*var\(--toolbar-control-size\) !important[^}]*max-block-size:\s*var\(--toolbar-control-size\) !important/s
    );
    expect(styles).toMatch(/\.toolbar-overflow__panel\s*\{[^}]*width:\s*280px/s);
    expect(styles).toMatch(
      /\.toolbar-overflow__panel \.button\s*\{[^}]*min-height:\s*40px !important/s
    );
  });

  it('shows project controls only while Canvas mode is active', () => {
    expect(styles).toMatch(
      /body:not\(\[data-canvas-active='true'\]\) \.local-project-toolbar\s*\{[^}]*display:\s*none/s
    );
    expect(styles).toMatch(
      /body\[data-canvas-active='true'\] \.local-project-toolbar\s*\{[^}]*display:\s*inline-flex/s
    );
    for (const selector of ['txt-upload-area', 'chat-format-toolbar', 'toolbar-overflow']) {
      expect(styles).toMatch(
        new RegExp(
          `\\.reference-shell\\[data-canvas-active='true'\\] \\.${selector}\\s*\\{[^}]*display:\\s*none`,
          's'
        )
      );
    }
  });

  it('uses a small latest-update popover instead of the changelog drawer', () => {
    expect(html).toContain('class="changelog-popover"');
    expect(html).not.toContain('id="changelogBackdrop"');
    expect(html).not.toContain('class="changelog-drawer"');
    expect(html).toContain('v2.0.0 — Canvas Modu Açıldı');
    expect(styles).toMatch(/\.changelog-popover\s*\{[^}]*position:\s*fixed/s);
    expect(styles).toMatch(/\.changelog-popover\s*\{[^}]*bottom:/s);
    expect(styles).toMatch(/\.changelog-popover\s*\{[^}]*max-width:\s*360px/s);
  });

  it('keeps the popover trigger state accessible', () => {
    // The trigger button is intentionally commented out in the markup source
    // (the popover replaced the drawer); assert against source, not render.
    const bodySource = readFileSync(rootPath('app/legacy/body.tsx'), 'utf8');
    expect(bodySource).toContain('<button type="button" class="changelog-tab"');
    expect(bodySource).toContain('aria-controls="changelogDrawer"');
    expect(init).toContain("openChangelogBtn.setAttribute('aria-expanded', 'true')");
    expect(init).toContain("openChangelogBtn.setAttribute('aria-expanded', 'false')");
    expect(init).toContain("event.key !== 'Escape'");
    expect(uiUtils).toMatch(/cm_changelog_seen_v2_/);
  });
});

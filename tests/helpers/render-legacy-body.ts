import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import LegacyBody from '../../app/legacy/body';

// Renders the served body markup (what app/page.tsx inlines at build time)
// so layout/markup tests assert against real output, not source text.
export function renderLegacyBody(): string {
  return renderToStaticMarkup(createElement(LegacyBody));
}

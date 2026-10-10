import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';

import { describe, expect, it } from 'vitest';

describe('feedback privacy boundary', () => {
  it('has no legacy endpoint that accepts or transmits full diagnostic reports', async () => {
    const sources = await Promise.all([
      readFile(new URL('../public/js/error-logger.ts', import.meta.url), 'utf8'),
      readFile(new URL('../public/js/ui-utils.ts', import.meta.url), 'utf8'),
    ]);
    const combined = sources.join('\n');

    expect(combined).not.toContain('/api/report-bug');
    expect(combined).not.toContain('fullReport');
    expect(combined).not.toContain('DISCORD_WEBHOOK_URL');
    expect(combined).not.toContain('window._fbSetCat');
  });
});

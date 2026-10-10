import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// The public snapshot is local-only (plus Discord feedback delivery): no
// Supabase-backed module, route, migration, client, or env wiring may exist.
// This test fails if any of that surface is reintroduced.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SELF = `tests${sep}no-supabase-surface.test.js`;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next') {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx|js|mjs|cjs|sql|toml|json|css|md)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const GONE_PATHS = [
  'supabase',
  'api/_lib/cloud-config.ts',
  'api/_lib/cloud-handlers.ts',
  'api/_lib/cloud-project-store.ts',
  'api/_lib/cloud-rate-limit.ts',
  'api/_lib/cloud-supabase.ts',
  'api/_lib/cloud-validation.ts',
  'api/_lib/community-config.ts',
  'api/_lib/community-handlers.ts',
  'api/_lib/imgbb-client.ts',
  'api/_lib/supporter-handlers.ts',
  'api/_lib/telemetry-handler.ts',
  'app/api/admin',
  'app/api/cloud',
  'app/api/community',
  'app/api/share',
  'app/api/supporter',
  'app/api/telemetry',
  'public/js/cloud-crypto.ts',
  'public/js/cloud-sync-client.ts',
  'public/js/cloud-sync-controller.ts',
  'public/js/community-client.ts',
  'public/js/public-share-controller.ts',
  'public/js/supporter-controller.ts',
  'public/js/telemetry-client.ts',
  'styles/cloud-sync.css',
  'styles/services.css',
  'docs/cloud-operations.md',
  'docs/community-operations.md',
];

const SURFACE_PATTERNS = [
  /@supabase\/supabase-js/,
  /\.supabase\.co/,
  /getCloudSupabase/,
  /consume_cloud_rate_limit/,
  /moderate_community_preset/,
  /get_effective_entitlements/,
  /community_presets/,
  /telemetry_events/,
  /supporter_grants/,
  /createTelemetryHandler/,
  /createSupporterHandlers/,
  /createCommunityEndpoint/,
  /createCloudSync/,
  /createCommunityClient/,
  /window\.Telemetry/,
  /ChatlogCloud/,
  /(^|[^a-zA-Z])SUPABASE_[A-Z_]+/,
];

describe('no Supabase surface in the public snapshot', () => {
  it('ships none of the removed Supabase-backed paths', () => {
    for (const gone of GONE_PATHS) {
      expect(existsSync(join(root, gone)), `${gone} must not exist`).toBe(false);
    }
  });

  it('contains no Supabase client, RPC, table, or contract references', () => {
    const hits = [];
    for (const file of walk(root)) {
      if (relative(root, file) === SELF) continue;
      const code = readFileSync(file, 'utf8');
      const matched = SURFACE_PATTERNS.filter((pattern) => pattern.test(code)).map((pattern) =>
        String(pattern)
      );
      if (matched.length > 0) hits.push(`${relative(root, file)}: ${matched.join(', ')}`);
    }
    expect(hits).toEqual([]);
  });

  it('declares no Supabase dependency, env, cron, or CSP wiring', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    expect(Object.keys(pkg.dependencies ?? {})).not.toContain('@supabase/supabase-js');
    const lock = readFileSync(join(root, 'package-lock.json'), 'utf8');
    expect(lock).not.toMatch(/@supabase\//);
    const env = readFileSync(join(root, '.env.example'), 'utf8');
    expect(env).not.toMatch(/SUPABASE_|CLOUD_|COMMUNITY_|TELEMETRY_|CRON_|SUPPORTER_|IMGBB_/);
    expect(env).toContain('FEEDBACK_DISCORD_WEBHOOK_URL');
    const vercel = readFileSync(join(root, 'vercel.json'), 'utf8');
    expect(vercel).not.toMatch(/api\/cloud/);
    const nextConfig = readFileSync(join(root, 'next.config.ts'), 'utf8');
    expect(nextConfig).not.toMatch(/supabase\.co/);
  });
});

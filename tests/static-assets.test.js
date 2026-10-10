import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));

function walkFiles(directory, extension) {
  const entries = readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) return walkFiles(full, extension);
    return entry.isFile() && full.endsWith(extension) ? [full] : [];
  });
}

// Every script/stylesheet the Next.js shell loads must resolve on disk.
// A missing file is a silent 404 at runtime (no build error), which is exactly
// how a previous migration step broke browser-loaded ES modules.
describe('static assets referenced by the Next.js shell', () => {
  it('serves every local script and stylesheet from the app shell', () => {
    const shell = ['app/layout.tsx', 'app/legacy/legacy-scripts.ts']
      .map((file) => readFileSync(join(root, file), 'utf8'))
      .join('\n');
    const absolute = [...shell.matchAll(/['"`](\/(?!\/)[^'"`?]+)(?:\?[^'"`]*)?['"`]/g)].map(
      (match) => match[1]
    );
    const relative = [...shell.matchAll(/['"]((?:\.\.?\/)[^'"]+\.css)['"]/g)].map(
      (match) => match[1]
    );

    expect(absolute.length).toBeGreaterThan(0);
    expect(relative.length).toBeGreaterThan(0);
    for (const reference of absolute) {
      expect(existsSync(join(root, 'public', reference)), `${reference} must exist`).toBe(true);
    }
    for (const reference of relative) {
      const target = resolve(join(root, 'app'), reference);
      expect(existsSync(target), `${reference} must exist`).toBe(true);
    }
  });

  it('has no IE-only escape hacks in bundled stylesheets', () => {
    // A `min-width:0\0` media query (IE9-11-only syntax) makes the Next.js CSS
    // pipeline fail parsing with "Invalid media query". If a vendor file is
    // ever re-synced, this catches the hack before the warning returns.
    const failures = [];
    for (const file of [
      ...walkFiles(join(root, 'styles'), '.css'),
      ...walkFiles(join(root, 'app'), '.css'),
    ]) {
      const code = readFileSync(file, 'utf8');
      if (/min-width:0\\0/.test(code)) failures.push(file);
    }
    expect(failures).toEqual([]);
  });

  it('resolves every relative module import inside public/js on disk', () => {
    const failures = [];
    // The .ts sources are the truth; their .js twins are gone (the bundler
    // consumes the sources directly), so resolve against the sources.
    for (const file of walkFiles(join(root, 'public', 'js'), '.ts')) {
      const code = readFileSync(file, 'utf8');
      const specifiers = [
        ...code.matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]/g),
        ...code.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g),
      ].map((match) => match[1]);
      for (const specifier of specifiers) {
        if (!specifier.startsWith('.')) continue;
        // TS conventions in play: `./x.js` maps to `./x.ts` (esbuild/vite),
        // and modules shared with the Next build import extensionless
        // (Turbopack does not rewrite `.js` — see community-preset-contract).
        const base = resolve(dirname(file), specifier.replace(/\.js$/, ''));
        const candidates = [base, `${base}.ts`];
        if (!candidates.some((candidate) => existsSync(candidate))) {
          failures.push(`${file} -> ${specifier}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('has the two legacy IIFE bundles built on disk', () => {
    // npm test runs bundle:js first (pretest), like emit:js used to. A missing
    // bundle is a silent 404 at runtime — same failure mode the check above
    // guards against.
    for (const name of ['legacy-early.js', 'legacy-main.js']) {
      expect(existsSync(join(root, 'public', 'js', name)), `${name} must exist`).toBe(true);
    }
  });

  it('resolves every relative server import inside api/ on disk', () => {
    const failures = [];
    for (const file of walkFiles(join(root, 'api'), '.ts')) {
      const code = readFileSync(file, 'utf8');
      const specifiers = [
        ...code.matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]/g),
      ].map((match) => match[1]);
      for (const specifier of specifiers) {
        if (!specifier.startsWith('.')) continue;
        const target = resolve(dirname(file), specifier);
        // api/_lib is never bundled (see scripts/bundle-legacy.ts): routes import
        // the .ts directly, extensionless, and Next.js compiles them.
        const candidates = [target, `${target}.ts`, join(target, 'index.ts')];
        if (!candidates.some((candidate) => existsSync(candidate))) {
          failures.push(`${file} -> ${specifier}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});

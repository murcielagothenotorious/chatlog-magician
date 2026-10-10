// Builds the two legacy client IIFE bundles served by the Next.js shell:
//
//   public/js/legacy-early.js  — the 5 head classics (error-logger first, so
//                                window.onerror is installed early)
//   public/js/legacy-main.js   — the remaining classics + color palette +
//                                module controllers + the whole ESM graph,
//                                with init.ts's dynamic imports inlined
//
// Replaces the per-module .js twins previously emitted by scripts/emit-js.ts
// (tsc): the browser loads 2 fixed-name files instead of 20. Fixed names, no
// content hash — cache busting is the single ?v=<package.json version> token
// composed in app/legacy/legacy-scripts.ts. No minify: stack traces keep the
// original names (external .map files ship alongside for devtools).
//
// IIFE rationale: one bundle scope preserves the bare cross-file references
// between the deferred classics exactly as they were, and esbuild inlines
// init.ts's dynamic import() calls (splitting is off), keeping its await
// ordering intact. Entries live in scripts/ (scripts/legacy-early.ts,
// scripts/legacy-main.ts); their import order is the execution order.
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

await build({
  entryPoints: [
    path.join(root, 'scripts/legacy-early.ts'),
    path.join(root, 'scripts/legacy-main.ts'),
  ],
  outdir: path.join(root, 'public/js'),
  bundle: true,
  format: 'iife',
  splitting: false,
  minify: false,
  sourcemap: true,
  target: 'es2020',
  platform: 'browser',
  legalComments: 'inline',
  logLevel: 'info',
});

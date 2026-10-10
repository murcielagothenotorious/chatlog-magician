import pkg from '../../package.json';
import { LEGACY_INLINE_SCRIPTS } from './inline-scripts';

// Legacy scripts in ORIGINAL document order (order and attributes verified
// against dist/index.html, the pre-Next build artifact). Native defer
// semantics: parsed in order, executed after parsing, in order, before
// DOMContentLoaded.
//
// Why an HTML string instead of JSX or next/script?
// - next/script beforeInteractive hoists scripts into <head> WITHOUT defer,
//   so top-level DOM queries ran against an empty document and half the UI
//   silently died.
// - React 19 refuses JSX script elements inside components ("Scripts inside
//   React components are never executed when rendering on the client").
// So the tags are composed here as an opaque string and rendered ONCE via
// dangerouslySetInnerHTML at the end of <body> in app/page.tsx. The browser
// parses them as normal parser-inserted scripts: defer classics execute in
// document order, the inline script runs at parse position (after the modal
// markup it wires — since every other tag here is deferred, it still runs
// before them, its original slot). Nothing hydrates, so the string is never
// re-assigned client-side (innerHTML-inserted scripts would not run).
//
// The two local bundles are built by scripts/bundle-legacy.ts from the
// co-located .ts sources (public/js + public/color-palette):
// - legacy-early: the 5 head classics — error-logger first so window error
//   reporting is installed before anything else can throw.
// - legacy-main: the remaining classics + color palette + module controllers
//   + the whole ESM graph (init.ts's dynamic imports are inlined).
// The bundle tag sits after the CDN tags: jQuery + the export libraries are
// globals by the time the bundle's IIFE runs (all defer order is preserved).
//
// The 4 CDN tags carry their original integrity/crossorigin/onerror
// attributes verbatim (collapsed to one line each — insignificant
// whitespace). Classic scripts stay out of the module graph (implicit
// cross-file globals); componentize top-down during UI polish.

const BUNDLE_VERSION: string = pkg.version;

const LEGACY_BUNDLE_EARLY = `/js/legacy-early.js?v=${BUNDLE_VERSION}`;
const LEGACY_BUNDLE_MAIN = `/js/legacy-main.js?v=${BUNDLE_VERSION}`;

const LEGACY_CDN_SCRIPT_TAGS: string[] = [
  '<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js" integrity="sha512-v2CJ7UaYy4JwqLDIrZUI/4hqeoQieOmAZNXBeQyjo21dadnwR+8ZaIJVT8EE2iyI61OV8e6M8PP2/4hpQINQ/g==" crossorigin="anonymous" defer></script>',
  '<script src="https://cdnjs.cloudflare.com/ajax/libs/foundation/6.9.0/js/foundation.min.js" integrity="sha512-P4f0g0iAkyfUF2V2VX8dxkoBxPLULaV2TM8HQGXFRb75AzLVAf+sn+MRweu/C81rL2JaYutbY6cWAbmwJbtOcg==" crossorigin="anonymous" defer onerror="console.warn(\'Foundation.js failed to load from CDN\')"></script>',
  '<!-- Pinned to 3.10.4 (latest on cdnjs): 3.5.0 throws an uncaught FileReader TypeError + hangs the export when any inlined resource fails at network level (XHR status 0). -->',
  '<script src="https://cdnjs.cloudflare.com/ajax/libs/dom-to-image-more/3.10.4/dom-to-image-more.min.js" integrity="sha512-9uIu57A2beST7Usmf4S9vJKMJvyEuacdjxRb3qQ6pdh7Gp0o430mwfQeRs/dLSssirCyLoUs7ucSc+g846RUUg==" crossorigin="anonymous" defer onerror="console.warn(\'dom-to-image-more.js failed to load from CDN\')"></script>',
  '<script src="https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js" integrity="sha512-Qlv6VSKh1gDKGoJbnyA5RMXYcvnpIqhO++MhIM2fStMcGT9i2T//tSwYFlcyoRRDcDZ+TYHpH8azBBCyhpSeqw==" crossorigin="anonymous" defer onerror="console.warn(\'FileSaver.js failed to load from CDN\')"></script>',
];

const deferTag = (src: string): string => `<script src="${src}" defer></script>`;

export function renderLegacyScriptTags(): string {
  const tags: string[] = [
    deferTag(LEGACY_BUNDLE_EARLY),
    ...LEGACY_CDN_SCRIPT_TAGS,
    ...LEGACY_INLINE_SCRIPTS.map((s) => `<script>${s.code}</script>`),
    deferTag(LEGACY_BUNDLE_MAIN),
  ];
  return tags.join('\n');
}

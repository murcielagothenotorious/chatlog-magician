// Entry for the legacy-main IIFE bundle (see scripts/bundle-legacy.ts).
// Import order IS execution order for the side-effect classics below — it
// must match the original tag order from dist/index.html: the deferred body
// classics, then the tail classics (init registers its DOMContentLoaded
// listener before ui-utils), then the three module controllers in their
// original document order. The static ESM graph hanging off the controllers
// and init's dynamic imports are inlined by esbuild (no-splitting IIFE), so
// dependency ordering and lazy-load timing are preserved by the bundler.
import '../public/js/chat.js';
import '../public/color-palette/color-palette.js';
import '../public/js/chatlog-parser.js';
import '../public/js/app.js';
import '../public/js/init.js';
import '../public/js/ui-utils.js';
import '../public/js/project-controller.js';
import '../public/js/canvas-controller.js';
import '../public/js/local-projects-controller.js';

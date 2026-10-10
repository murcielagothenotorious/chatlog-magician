// Entry for the legacy-early IIFE bundle (see scripts/bundle-legacy.ts).
// Import order IS execution order — it must match the original head tag
// order from dist/index.html (error-logger first so window.onerror is
// installed before anything else can throw). None of these modules contain
// static imports or jQuery usage; they only publish window.* contracts.
import '../public/js/error-logger.js';
import '../public/js/error-handler.js';
import '../public/js/cross-origin-fix.js';
import '../public/js/cors-handler.js';
import '../public/js/analytics.js';

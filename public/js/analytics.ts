interface Window {
  va?: (...args: unknown[]) => void;
  vaq?: unknown[];
}

// Vercel Web Analytics initialization (browser-compatible without bundler)
window.va =
  window.va ||
  function () {
    // eslint-disable-next-line prefer-rest-params -- external Vercel loader consumes the Arguments object; a rest array would change the pushed value type
    (window.vaq = window.vaq || []).push(arguments);
  };

(function loadVercelAnalytics() {
  try {
    const host = location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    if (isLocal) return;
    const s = document.createElement('script');
    s.defer = true;
    s.src = '/_vercel/insights/script.js';
    s.onerror = function () {
      // Silently ignore if not available (non-Vercel environments)
    };
    document.head.appendChild(s);
  } catch (_e) {
    // no-op
  }
})();

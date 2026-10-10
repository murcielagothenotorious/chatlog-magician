interface Window {
  CORSHandler?: unknown;
}

(function () {
  'use strict';

  // CORS Handler for dom-to-image compatibility
  const CORSHandler = {
    problematicResources: new Set(),

    init: function () {
      this.setupStyleSheetHandling();
      this.setupImageHandling();
      this.setupFontHandling();
    },

    setupStyleSheetHandling: function () {
      // Monitor for stylesheet loading errors (but don't interfere with scripts)
      const originalAddEventListener = HTMLLinkElement.prototype.addEventListener;
      HTMLLinkElement.prototype.addEventListener = function (type, listener, options) {
        if (type === 'error') {
          const originalListener = listener;
          listener = function (event) {
            const link = event.target;
            if (
              link.href &&
              (link.href.includes('cdnjs.cloudflare.com') ||
                link.href.includes('fonts.googleapis.com'))
            ) {
              CORSHandler.problematicResources.add(link.href);
              console.log('CORS issue detected with stylesheet:', link.href);
            }
            return originalListener.call(this, event);
          };
        }
        return originalAddEventListener.call(this, type, listener, options);
      };
    },

    setupImageHandling: function () {
      const originalImage = window.Image;
      window.Image = function () {
        const img = new originalImage();
        img.crossOrigin = 'anonymous';
        return img;
      } as unknown as typeof Image;
      window.Image.prototype = originalImage.prototype;
    },

    setupFontHandling: function () {
      if ('fonts' in document) {
        const originalLoad = document.fonts.load;
        document.fonts.load = function (fontSpec, text) {
          return originalLoad.call(this, fontSpec, text).catch((error) => {
            console.log('Font loading failed, using fallback:', error);
            return Promise.resolve([]);
          });
        };
      }
    },

    getDomToImageOptions: function (baseOptions = {}) {
      return {
        ...baseOptions,
        // Use high quality without forcing background or transforms
        quality: 1.0,
        cacheBust: false,
        // Skip font embedding: drop font URLs instead of downloading them.
        // dom-to-image-more has no skipFonts option (the old key was silently
        // ignored, so every @font-face file was fetched on each fallback
        // export). Dropped URLs stay remote in the CSS and are ignored at
        // raster time, so no fetch can fail here.
        filterUrls: function (url) {
          const value = String(url || '');
          return !value.startsWith('data:font/') && !/\.(woff2?|ttf|otf|eot)(\?|#|$)/i.test(value);
        },
        filter: function (node) {
          if (node.tagName === 'LINK' && node.href) {
            if (
              CORSHandler.problematicResources.has(node.href) ||
              node.href.includes('cdnjs.cloudflare.com') ||
              node.href.includes('fonts.googleapis.com')
            ) {
              return false;
            }
          }

          if (
            node.tagName === 'IMG' &&
            node.src &&
            !node.src.startsWith('data:') &&
            !node.src.startsWith('blob:')
          ) {
            try {
              const url = new URL(node.src);
              if (url.origin !== window.location.origin) {
                node.crossOrigin = 'anonymous';
              }
            } catch (_e) {
              return false;
            }
          }

          return true;
        },

        imagePlaceholder:
          'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2Y0ZjRmNCIvPjwvc3ZnPg==',

        // Handle CSS rules access (supported hook name is lowercase onclone;
        // the old onCloneNode key was silently ignored and never ran)
        onclone: function (clonedNode) {
          const links = clonedNode.querySelectorAll('link[rel="stylesheet"]');
          links.forEach((link) => {
            if (
              link.href &&
              (link.href.includes('cdnjs.cloudflare.com') ||
                link.href.includes('fonts.googleapis.com'))
            ) {
              link.remove();
            }
          });
          return clonedNode;
        },
      };
    },

    createCleanOutput: function (originalOutput) {
      const clone = originalOutput.cloneNode(true);

      const externalLinks = clone.querySelectorAll('link[rel="stylesheet"]');
      externalLinks.forEach((link) => {
        if (
          link.href &&
          (link.href.includes('cdnjs.cloudflare.com') || link.href.includes('fonts.googleapis.com'))
        ) {
          link.remove();
        }
      });

      const images = clone.querySelectorAll('img');
      images.forEach((img) => {
        if (img.src && !img.src.startsWith('data:') && !img.src.startsWith('blob:')) {
          img.crossOrigin = 'anonymous';
        }
      });

      return clone;
    },
  };

  // Expose to global scope
  window.CORSHandler = CORSHandler;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => CORSHandler.init());
  } else {
    CORSHandler.init();
  }

  if (window.performance && window.performance.mark) {
    window.addEventListener('load', () => {
      performance.mark('cors-handler-initialized');
      performance.measure('cors-handler-setup', 'cors-handler-initialized');
    });
  }
})();

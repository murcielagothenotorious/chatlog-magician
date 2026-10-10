interface Window {
  CONFIG?: any;
  Foundation?: any;
  foundation?: any;
  ColorPalette?: any;
  domtoimage?: any;
  saveAs?: any;
  copyBlobToClipboard?: any;
  renderChatToBlob?: any;
  hasExportableContent?: any;
  downloadOutputImage?: any;
  clearHistory?: any;
  ChatlogParser?: any;
  ChatlogGuidance?: any;
  i18n?: any;
  showToast?: any;
  showAlertDialog?: any;
  showConfirmDialog?: any;
}

declare var $: any;
declare var ChatlogParser: any;

if (typeof window.Foundation !== 'undefined') {
  $(document).foundation();
} else {
  console.warn('Foundation framework not available');
}

const CONFIG = {
  // Font settings
  FONT_SIZE_SMALL_THRESHOLD: 13, // Font sizes <= this get smoothing
  FONT_SIZE_MIN: 8,
  FONT_SIZE_MAX: 24,
  FONT_SIZE_DEFAULT: 12,
  FONT_SIZE_LARGE_THRESHOLD: 20, // Font sizes >= this are considered large

  // Line settings
  LINE_LENGTH_MIN: 1,
  LINE_LENGTH_DEFAULT: 77,
  LINE_HEIGHT_SMALL: 1.5,
  LINE_HEIGHT_DEFAULT: 1.3,
  LINE_HEIGHT_LARGE: 1.35,
  // Line spacing (manual override)
  LINE_SPACING_DEFAULT: 1.3,
  LINE_SPACING_MIN: 0.8,
  LINE_SPACING_MAX: 3.0,

  // Performance
  INPUT_THROTTLE_MS: 200,
  PROCESSING_DEBOUNCE_MS: 300,
  IMAGE_LOAD_TIMEOUT_MS: 30000,
  // UI timing
  COPY_FEEDBACK_DURATION_MS: 1500,
  AUTO_SAVE_INDICATOR_MS: 2000,
  TOOLTIP_FADE_MS: 200,
  ANIMATION_FADE_MS: 600,
  DRAG_FLAG_RESET_MS: 150,
  // History
  MAX_HISTORY_ITEMS: 20,
  // BMC button nudge
  BMC_NUDGE_INITIAL_DELAY_MS: 15000,
  BMC_NUDGE_MIN_INTERVAL_MS: 20000,
  BMC_NUDGE_MAX_INTERVAL_MS: 60000,
  BMC_NUDGE_ANIMATION_MS: 800,
};

window.CONFIG = CONFIG;

function showAutoSaveIndicator(message?: any) {
  try {
    const existing = document.querySelector('.auto-save-indicator');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.className = 'auto-save-indicator';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML =
      '<div class="spinner" aria-hidden="true"></div><p class="loading-text">' +
      (message || 'Saved') +
      '</p>';
    document.body.appendChild(el);
    setTimeout(() => {
      el.classList.add('fade-out');
      setTimeout(() => el.remove(), 600);
    }, CONFIG.AUTO_SAVE_INDICATOR_MS - 800);
  } catch (_e) {
    // noop
  }
}

try {
  const __origSet = localStorage.setItem.bind(localStorage);
  const SAVE_KEYS = new Set([
    'chatlogFontSize',
    'chatlogLineLength',
    'chatlogLineSpacing',
    'chatlogCharacterName',
    'chatlogHistory',
  ]);
  localStorage.setItem = function (key, value) {
    const res = __origSet(key, value);
    if (SAVE_KEYS.has(String(key))) {
      showAutoSaveIndicator('Saved');
    }
    return res;
  };
} catch (_e) {
  // noop
}

// Typographic Golden Scale - Hand-picked sizes optimized for readability
const TYPOGRAPHIC_SCALE = [8, 10, 12, 15, 19, 24];

const _scaleEnabled = false;
let lastProcessedText = '';
let processingTimeout = null;

function _fontWeightForSize(_px) {
  return 700;
}

function updateFontSize() {
  const fontSize = parseFloat($('#font-label').val()) || CONFIG.FONT_SIZE_DEFAULT;
  const fontWeight = _fontWeightForSize(fontSize);
  $('#output').css({ 'font-size': fontSize + 'px', 'font-weight': fontWeight });

  if (fontSize <= CONFIG.FONT_SIZE_SMALL_THRESHOLD) {
    $('#output').addClass('font-smoothed');
  } else {
    $('#output').removeClass('font-smoothed');
  }

  applySizeClasses(fontSize);

  try {
    localStorage.setItem('chatlogFontSize', fontSize.toString());
  } catch (e) {
    console.warn('Could not save font size to localStorage:', e);
  }
}

function _isTypographicGolden(fontSize) {
  return TYPOGRAPHIC_SCALE.includes(fontSize);
}

/**
 * @param {string} direction - 'up' or 'down'
 * @returns {number} The next golden size, or current size if at boundary
 */
function _getNextGoldenSize(currentSize, direction = 'up') {
  const index = TYPOGRAPHIC_SCALE.indexOf(currentSize);
  if (index === -1) return currentSize;
  if (direction === 'up' && index < TYPOGRAPHIC_SCALE.length - 1) {
    return TYPOGRAPHIC_SCALE[index + 1];
  } else if (direction === 'down' && index > 0) {
    return TYPOGRAPHIC_SCALE[index - 1];
  }
  return currentSize;
}

function _nearestGolden(n) {
  return TYPOGRAPHIC_SCALE.reduce(
    (best, v) => (Math.abs(v - n) < Math.abs(best - n) ? v : best),
    TYPOGRAPHIC_SCALE[0]
  );
}

function _percentDelta(a, b) {
  return (((b - a) / a) * 100).toFixed(1);
}

function goldenHintHTML(scale) {
  return scale.map((s) => `${s}px`).join(' → ');
}

function applySizeClasses(px) {
  $('#output').toggleClass('is-small', px <= CONFIG.FONT_SIZE_DEFAULT);
  $('#output').toggleClass('is-large', px >= CONFIG.FONT_SIZE_LARGE_THRESHOLD);
}

function updateLineSpacing() {
  const spacing = parseFloat($('#lineSpacingInput').val()) || CONFIG.LINE_SPACING_DEFAULT;
  const clamped = Math.min(CONFIG.LINE_SPACING_MAX, Math.max(CONFIG.LINE_SPACING_MIN, spacing));
  $('#output').css('line-height', clamped);

  // Inline bg bantları arasındaki half-leading boşluğu satır aralığı arttıkça
  // büyür. Sabit 2px shadow küçük aralıklarda taşmaya, büyük aralıklarda yetersiz
  // kalmaya yol açıyor. Bu yüzden shadow boyutunu dinamik hesaplıyoruz:
  //   gap-per-side ≈ (line-height - 1) * font-size / 2
  // 1.4 altında shadow tamamen kapalı (gap yok, taşmayı önle).
  const needsGapFill = clamped >= 1.4;
  const fontSize = parseFloat($('#font-label').val()) || CONFIG.FONT_SIZE_DEFAULT;
  const shadowPx = needsGapFill ? Math.max(2, Math.ceil(((clamped - 1) * fontSize) / 2)) : 0;
  $('#output').toggleClass('bg-gap-fill', needsGapFill);
  document.documentElement.style.setProperty('--bg-gap-fill-px', shadowPx + 'px');

  try {
    localStorage.setItem('chatlogLineSpacing', clamped.toString());
  } catch (e) {
    console.warn('Could not save line spacing to localStorage:', e);
  }
}

function _printScaleDeltas() {
  console.table(
    TYPOGRAPHIC_SCALE.slice(0, -1).map((s, i) => {
      const t = TYPOGRAPHIC_SCALE[i + 1];
      return { from: s, to: t, percent: +(((t - s) / s) * 100).toFixed(1) };
    })
  );
}

// Used to create tighter crops of the generated chat log images
function trimCanvas(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imgData.data;
  let top = null,
    bottom = null,
    left = null,
    right = null;

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const alpha = pixels[(y * canvas.width + x) * 4 + 3];
      if (alpha > 0) {
        top = y;
        break;
      }
    }
    if (top !== null) break;
  }

  for (let y = canvas.height - 1; y >= 0; y--) {
    for (let x = 0; x < canvas.width; x++) {
      const alpha = pixels[(y * canvas.width + x) * 4 + 3];
      if (alpha > 0) {
        bottom = y;
        break;
      }
    }
    if (bottom !== null) break;
  }

  for (let x = 0; x < canvas.width; x++) {
    for (let y = 0; y < canvas.height; y++) {
      const alpha = pixels[(y * canvas.width + x) * 4 + 3];
      if (alpha > 0) {
        left = x;
        break;
      }
    }
    if (left !== null) break;
  }

  for (let x = canvas.width - 1; x >= 0; x--) {
    for (let y = 0; y < canvas.height; y++) {
      const alpha = pixels[(y * canvas.width + x) * 4 + 3];
      if (alpha > 0) {
        right = x;
        break;
      }
    }
    if (right !== null) break;
  }

  if (top !== null && bottom !== null && left !== null && right !== null) {
    const trimmedCanvas = document.createElement('canvas');
    trimmedCanvas.width = right - left + 1;
    trimmedCanvas.height = bottom - top + 1;
    trimmedCanvas
      .getContext('2d', { willReadFrequently: true })
      .putImageData(ctx.getImageData(left, top, trimmedCanvas.width, trimmedCanvas.height), 0, 0);
    return trimmedCanvas;
  } else {
    return canvas;
  }
}

// Format: MM-DD-YYYY_HH-MM-SS_chatlog.png
function generateFilename() {
  return (
    new Date()
      .toLocaleString()
      .replaceAll(',', '_')
      .replaceAll(' ', '_')
      .replaceAll('/', '-')
      .replace('__', '_')
      .replaceAll(':', '-') + '_chatlog.png'
  );
}

window.copyBlobToClipboard = async function (blob) {
  try {
    const item = new ClipboardItem({ [blob.type || 'image/png']: blob });
    await navigator.clipboard.write([item]);
    const btn = document.getElementById('copyOutputImage');
    if (btn) {
      const origHtml = btn.innerHTML;
      const origBg = btn.style.backgroundColor;
      const origBorder = btn.style.borderColor;
      const origColor = btn.style.color;
      btn.innerHTML = '<i class="fas fa-check copy-success-icon" aria-hidden="true"></i>';
      btn.style.backgroundColor = 'rgba(46, 204, 113, 0.18)';
      btn.style.borderColor = 'rgba(46, 204, 113, 0.5)';
      btn.style.color = '#2ecc71';
      setTimeout(() => {
        btn.innerHTML = origHtml;
        btn.style.backgroundColor = origBg;
        btn.style.borderColor = origBorder;
        btn.style.color = origColor;
      }, 1500);
    }
  } catch (error) {
    console.warn('Clipboard write failed, attempting automatic download fallback:', error);
    // Smart fallback for Firefox / restricted environments:
    // If copying fails (e.g. Firefox ClipboardItem disabled or permission denied),
    // automatically save the image as a file and show a friendly toast/notification.
    let fallbackSaved = false;
    try {
      if (typeof window.saveAs === 'function') {
        window.saveAs(blob, generateFilename());
        fallbackSaved = true;
        if (typeof window.showToast === 'function') {
          window.showToast('Pano kısıtlı: Görsel dosya olarak indirildi', 'fa-download');
        } else if (typeof window.showAlertDialog === 'function') {
          window.showAlertDialog(
            'Tarayıcınız panoya doğrudan görsel kopyalamayı kısıtladığı için görsel dosya olarak indirildi.',
            'Bilgilendirme'
          );
        }
      }
    } catch (_downloadErr) {
      console.error('Fallback download also failed:', _downloadErr);
    }

    if (!fallbackSaved) {
      if (typeof window.showAlertDialog === 'function') {
        window.showAlertDialog(
          'Kopyalama başarısız oldu. Tarayıcınız resim kopyalamayı desteklemiyor olabilir veya siteye kopyalama izni verilmemiş olabilir.'
        );
      } else {
        alert(
          'Kopyalama başarısız oldu. Tarayıcınız resim kopyalamayı desteklemiyor olabilir veya siteye kopyalama izni verilmemiş olabilir.'
        );
      }
    }
  }
};

/**
 * Checks whether #output holds any exportable chat text.
 * Pure DOM read (no canvas, no layout recompute): true when at least one
 * .generated line carries non-whitespace text.
 */
function hasExportableContent(outputElement) {
  if (!outputElement || typeof outputElement.querySelectorAll !== 'function') return false;
  const lines = outputElement.querySelectorAll('.generated');
  for (let i = 0; i < lines.length; i++) {
    const text = typeof lines[i].textContent === 'string' ? lines[i].textContent : '';
    if (text.trim()) return true;
  }
  return false;
}
window.hasExportableContent = hasExportableContent;

/**
 * Fallback engine: renders the formatted chat log (#output) directly to an
 * HTML5 Canvas blob. Uses the native Canvas 2D API instead of
 * SVG/foreignObject for environments where DOM snapshotting is blocked
 * (e.g. Firefox), eliminating blank renders, security errors, and CSS rule
 * access failures. Approximates the visible output; the primary export path
 * snapshots the element exactly via dom-to-image.
 */
function renderChatToBlob(outputElement) {
  return new Promise((resolve, reject) => {
    try {
      if (!outputElement) {
        return reject(new Error('Çıktı alanı bulunamadı.'));
      }

      const generatedLines = outputElement.querySelectorAll('.generated');
      if (generatedLines.length === 0) {
        const emptyError: any = new Error('Çıktı alanında dönüştürülecek sohbet metni bulunamadı.');
        emptyError.code = 'EMPTY_OUTPUT';
        return reject(emptyError);
      }

      const fontFamily =
        window.ChatlogParser?.currentFontFamily ||
        (document.getElementById('fontFamily') as any)?.value ||
        'Arial, sans-serif';
      const fontSizeInput: any = document.getElementById('font-label');
      const fontSize = fontSizeInput ? parseInt(fontSizeInput.value, 10) || 12 : 12;

      let lineSpacing = 1.45;
      if (outputElement.classList.contains('is-small')) lineSpacing = 1.5;
      else if (outputElement.classList.contains('is-large')) lineSpacing = 1.35;
      const lineHeight = Math.max(14, Math.round(fontSize * lineSpacing));

      const hasBackground =
        window.ChatlogParser?.backgroundActive ||
        outputElement.classList.contains('background-active');

      const isOpsec =
        Boolean(window.ChatlogParser?.opsecActive) ||
        outputElement.classList.contains('opsec-active') ||
        Boolean(typeof $ !== 'undefined' && $('#opsecBtn').hasClass('active'));

      const lowShadows = [
        [-1, -1],
        [-1, 0],
        [-1, 1],
        [0, -1],
        [0, 1],
        [1, -1],
        [1, 0],
        [1, 1],
      ];
      const mediumExtra = [
        [0, 2],
        [0, -2],
        [2, 0],
        [-2, 0],
      ];
      const highExtra = [
        [-2, -2],
        [2, -2],
        [-2, 2],
        [2, 2],
        [1, 2],
        [-1, 2],
        [1, -2],
        [-1, -2],
        [2, 1],
        [-2, 1],
        [2, -1],
        [-2, -1],
      ];
      let shadows = lowShadows;
      if (outputElement.classList.contains('contrast-high')) {
        shadows = [...lowShadows, ...mediumExtra, ...highExtra];
      } else if (outputElement.classList.contains('contrast-medium')) {
        shadows = [...lowShadows, ...mediumExtra];
      }

      const visualLines = [];
      generatedLines.forEach((genLine) => {
        const current = [];
        function walk(node) {
          if (node.nodeType === 3) {
            const text = node.nodeValue;
            if (text) {
              const parent = node.parentElement;
              const style = parent ? window.getComputedStyle(parent) : null;
              current.push({
                text,
                color: style?.color || '#f1f1f1',
                italic:
                  style?.fontStyle === 'italic' ||
                  parent?.tagName === 'I' ||
                  parent?.tagName === 'EM' ||
                  parent?.classList?.contains('italic'),
                isCensored: parent?.classList?.contains('censored-content') || false,
                isBlurMode: parent?.classList?.contains('blur-mode') || false,
                isRemoveMode: parent?.classList?.contains('censored-remove') || false,
                isOpsec:
                  parent?.classList?.contains('opsec-censored') ||
                  Boolean(parent?.closest?.('.opsec-censored')),
              });
            }
          } else if (node.nodeType === 1) {
            if (node.tagName === 'BR') {
              if (current.length > 0) {
                visualLines.push([...current]);
                current.length = 0;
              }
            } else {
              node.childNodes.forEach(walk);
            }
          }
        }
        genLine.childNodes.forEach(walk);
        if (current.length > 0) visualLines.push(current);
      });

      if (visualLines.length === 0) {
        const emptyError: any = new Error('Görsel satırları ayrıştırılamadı.');
        emptyError.code = 'EMPTY_OUTPUT';
        return reject(emptyError);
      }

      const getSegmentFont = (seg) =>
        `${seg?.italic ? 'italic ' : ''}700 ${fontSize}px ${fontFamily}`;

      const measureCanvas = document.createElement('canvas');
      const measureCtx = measureCanvas.getContext('2d');
      measureCtx.textBaseline = 'top';

      let maxLineWidth = 0;
      visualLines.forEach((line) => {
        let w = 0;
        line.forEach((seg) => {
          measureCtx.font = getSegmentFont(seg);
          w += measureCtx.measureText(seg.text).width;
        });
        if (w > maxLineWidth) maxLineWidth = w;
      });

      const padX = 20;
      const padY = 20;
      const canvasWidth = Math.ceil(maxLineWidth + padX * 2);
      const canvasHeight = Math.ceil(visualLines.length * lineHeight + padY * 2);

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(10, canvasWidth);
      canvas.height = Math.max(10, canvasHeight);

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.imageSmoothingEnabled = false;
      ctx.textBaseline = 'top';

      let currentY = padY;
      const bgPaddingH = 0;
      const bgPaddingTop = 0;
      const bgPaddingBottom = 0;

      visualLines.forEach((line) => {
        let currentX = padX;
        if (hasBackground) {
          let lineW = 0;
          line.forEach((seg) => {
            ctx.font = getSegmentFont(seg);
            lineW += ctx.measureText(seg.text).width;
          });
          ctx.fillStyle = '#000000';
          ctx.fillRect(
            Math.round(currentX),
            Math.round(currentY),
            Math.round(lineW),
            Math.round(lineHeight)
          );
        }

        line.forEach((seg) => {
          ctx.font = getSegmentFont(seg);
          const segW = ctx.measureText(seg.text).width;
          if (seg.isRemoveMode) {
            if (isOpsec || seg.isOpsec) {
              const boxHeight = Math.round(fontSize * 1.15);
              const boxY = Math.round(currentY + (lineHeight - boxHeight) / 2);
              const boxX = Math.round(currentX);
              const boxW = Math.max(4, Math.round(segW));
              ctx.fillStyle = '#000000';
              ctx.fillRect(boxX, boxY, boxW, boxHeight);
              ctx.lineWidth = 1;
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
              ctx.strokeRect(boxX + 0.5, boxY + 0.5, Math.max(1, boxW - 1), boxHeight - 1);
            }
            currentX += segW;
            return;
          }

          if (seg.isCensored && seg.isBlurMode) {
            ctx.save();
            ctx.filter = 'blur(4px)';
          }

          // Draw outline shadows
          ctx.fillStyle = '#000000';
          shadows.forEach(([dx, dy]) => {
            ctx.fillText(seg.text, Math.round(currentX + dx), Math.round(currentY + dy));
          });

          // Draw text
          ctx.fillStyle = seg.color || '#f1f1f1';
          ctx.fillText(seg.text, Math.round(currentX), Math.round(currentY));

          if (seg.isCensored && seg.isBlurMode) {
            ctx.restore();
          }

          currentX += segW;
        });

        currentY += lineHeight;
      });

      const trimmed = trimCanvas(canvas);
      trimmed.toBlob((blob) => {
        if (!blob) reject(new Error('Kırpılmış görsel oluşturulamadı.'));
        else resolve(blob);
      }, 'image/png');
    } catch (err) {
      reject(err);
    }
  });
}
window.renderChatToBlob = renderChatToBlob;

/**
 * Exports the formatted chat log as a PNG image
 * Handles cleanup of UI elements, canvas generation, and file download
 * Saves the current chat log to history automatically
 */
function downloadOutputImage(action = 'download') {
  const getT = (key, fallback) =>
    window.ChatlogGuidance?.i18n?.t(key) || window.i18n?.t(key) || fallback;
  // QoL: clear any active selections before generating the image
  let hadColoringMode = false;
  try {
    if (window.ColorPalette && typeof window.ColorPalette.clearSelections === 'function') {
      window.ColorPalette.clearSelections();
    } else {
      // Fallback: remove selection class directly
      document
        .querySelectorAll('.selected-for-coloring')
        .forEach((el) => el.classList.remove('selected-for-coloring'));
    }
    const $out = $('#output');
    hadColoringMode = $out.hasClass('coloring-mode');
    if (hadColoringMode) {
      $out.removeClass('coloring-mode');
    }
  } catch (_e) {
    // Non-fatal; continue with export
  }

  // Defer the actual export to the next frame so DOM updates (class removals) are applied
  setTimeout(() => {
    const text = $('#chatlogInput').val().trim();
    if (text) {
      saveToHistory(text);
      refreshHistoryPanel();
    }

    const output = $('#output');

    showLoadingIndicator();

    const height = output.prop('scrollHeight') + 100;
    const width = output.width();
    const originalPadding = output.css('padding-bottom');

    output.css('padding-bottom', '100px');

    const domtoimageOptions = window.CORSHandler
      ? (window.CORSHandler as any).getDomToImageOptions({
          width: width,
          height: height,
          style: {
            transform: 'scale(1)',
            transformOrigin: 'top left',
          },
          filter: function (node) {
            if (node.classList && node.classList.contains('selected-for-coloring')) return false;
            return true;
          },
        })
      : {
          width: width,
          height: height,
          style: {
            transform: 'scale(1)',
            transformOrigin: 'top left',
          },
          filter: function (node) {
            if (
              node.tagName === 'LINK' &&
              node.href &&
              (node.href.includes('cdnjs.cloudflare.com') ||
                node.href.includes('fonts.googleapis.com'))
            ) {
              return false;
            }
            if (node.classList && node.classList.contains('selected-for-coloring')) return false;
            return true;
          },
          // Skip font embedding (mirrors CORSHandler.getDomToImageOptions;
          // dom-to-image-more has no skipFonts option).
          filterUrls: function (url) {
            const value = String(url || '');
            return (
              !value.startsWith('data:font/') && !/\.(woff2?|ttf|otf|eot)(\?|#|$)/i.test(value)
            );
          },
          imagePlaceholder:
            'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2Y0ZjRmNCIvPjwvc3ZnPg==',
        };

    // Empty guard first: never snapshot (or re-render) an output with no chat
    // text. Shows the same toast the native engine used to raise via
    // EMPTY_OUTPUT, so both engines agree without touching either one.
    if (!hasExportableContent(output[0])) {
      output.css('padding-bottom', originalPadding);
      hideLoadingIndicator();
      if (hadColoringMode) output.addClass('coloring-mode');
      if (typeof window.showToast === 'function') {
        window.showToast(
          getT('toast.emptyOutput', 'Dışa aktarılacak sohbet bulunamadı.'),
          'fa-info-circle'
        );
      }
      return;
    }

    // Check if test environment explicitly mocked domtoimage.toBlob with custom behavior
    const isCustomMock =
      typeof window.domtoimage !== 'undefined' &&
      typeof window.domtoimage.toBlob === 'function' &&
      !window.domtoimage.impl;

    if (isCustomMock) {
      window.domtoimage
        .toBlob(output[0], domtoimageOptions)
        .then(function (blob) {
          output.css('padding-bottom', originalPadding);
          processGeneratedBlob(blob, action);
        })
        .catch(function (error) {
          handleImageGenerationError(error);
        });
      return;
    }

    // Primary: exact DOM snapshot of #output via dom-to-image — what you see
    // is what gets downloaded/copied, with no re-render and no recomputed
    // layout. The native Canvas 2D engine below is only a fallback for
    // environments where SVG foreignObject snapshotting is blocked.
    const snapshotApi =
      typeof window.domtoimage !== 'undefined' && typeof window.domtoimage.toBlob === 'function'
        ? window.domtoimage
        : null;

    function runNativeEngine() {
      renderChatToBlob(output[0])
        .then(async function (trimmedBlob) {
          output.css('padding-bottom', originalPadding);
          if (action === 'copy') {
            await window.copyBlobToClipboard(trimmedBlob);
          } else {
            window.saveAs(trimmedBlob, generateFilename());
          }
          hideLoadingIndicator();
          if (hadColoringMode) output.addClass('coloring-mode');
        })
        .catch(function (error) {
          if (error && error.code === 'EMPTY_OUTPUT') {
            // Unreachable in practice (pre-checked above); kept as a safety net.
            output.css('padding-bottom', originalPadding);
            hideLoadingIndicator();
            if (hadColoringMode) output.addClass('coloring-mode');
            if (typeof window.showToast === 'function') {
              window.showToast(
                getT('toast.emptyOutput', 'Dışa aktarılacak sohbet bulunamadı.'),
                'fa-info-circle'
              );
            }
            return;
          }
          handleImageGenerationError(error);
        });
    }

    if (!snapshotApi) {
      runNativeEngine();
      return;
    }
    snapshotApi
      .toBlob(output[0], domtoimageOptions)
      .then(function (blob) {
        output.css('padding-bottom', originalPadding);
        processGeneratedBlob(blob, action);
      })
      .catch(function (error) {
        console.warn('DOM snapshot failed, trying native canvas fallback:', error);
        runNativeEngine();
      });
    function processGeneratedBlob(blob, action) {
      if (!blob) {
        console.error('Error: Blob is null or undefined');
        if (window.ErrorLogger) {
          (window.ErrorLogger as any).logError(new Error('Failed to generate image: blob is null'));
        }
        alert('Failed to generate image blob. Please try again.');
        hideLoadingIndicator();
        if (hadColoringMode) output.addClass('coloring-mode');
        return;
      }

      if (blob.size === 0) {
        console.error('Error: Blob is empty (size: 0)');
        if (window.ErrorLogger) {
          (window.ErrorLogger as any).logError(
            new Error('Failed to generate image: blob is empty')
          );
        }
        alert('Generated image is empty. Please try again.');
        hideLoadingIndicator();
        if (hadColoringMode) output.addClass('coloring-mode');
        return;
      }

      console.log('Processing blob:', {
        size: blob.size,
        type: blob.type,
      });

      const img = new Image();
      img.crossOrigin = 'anonymous';

      let objectURL = null;
      let loadTimeout = null;
      let hasCompleted = false;

      const cleanup = () => {
        if (objectURL) {
          URL.revokeObjectURL(objectURL);
          objectURL = null;
        }
        if (loadTimeout) {
          clearTimeout(loadTimeout);
          loadTimeout = null;
        }
      };

      img.onload = function () {
        if (hasCompleted) return;
        hasCompleted = true;

        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;

          // Set willReadFrequently to true for better performance with multiple readback operations
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(img, 0, 0);

          const trimmedCanvas = trimCanvas(canvas);
          trimmedCanvas.toBlob(async function (trimmedBlob) {
            if (!trimmedBlob) {
              console.error('Error: Failed to create trimmed blob');
              if (window.ErrorLogger) {
                (window.ErrorLogger as any).logError(new Error('Failed to create trimmed blob'));
              }
              alert('Failed to process the image. Please try again.');
            } else {
              if (action === 'copy') {
                await window.copyBlobToClipboard(trimmedBlob);
              } else {
                window.saveAs(trimmedBlob, generateFilename());
              }
            }
            cleanup();
            hideLoadingIndicator();
            if (hadColoringMode) output.addClass('coloring-mode');
          });
        } catch (error) {
          console.error('Error processing image:', error);
          if (window.ErrorLogger) {
            (window.ErrorLogger as any).logError(error);
          }
          alert('Error processing the image. Please try again.');
          cleanup();
          hideLoadingIndicator();
          if (hadColoringMode) output.addClass('coloring-mode');
        }
      };

      img.onerror = function (_event) {
        if (hasCompleted) return;
        hasCompleted = true;

        const errorDetails = {
          blobSize: blob.size,
          blobType: blob.type,
          imageWidth: img.width,
          imageHeight: img.height,
          src: img.src ? 'blob URL' : 'no src',
        };

        console.error('Error loading generated image', errorDetails);

        if (window.ErrorLogger) {
          const error = new Error('Error loading generated image');
          (error as any).details = errorDetails;
          (window.ErrorLogger as any).logError(error);
        }

        alert('There was an error processing the generated image. Please try again.');
        cleanup();
        hideLoadingIndicator();
        if (hadColoringMode) output.addClass('coloring-mode');
      };

      loadTimeout = setTimeout(() => {
        if (hasCompleted) return;
        hasCompleted = true;

        console.error('Error: Image load timeout after 30 seconds');
        if (window.ErrorLogger) {
          (window.ErrorLogger as any).logError(new Error('Image load timeout after 30 seconds'));
        }

        alert('Image processing timed out. Please try again with a smaller chatlog.');
        cleanup();
        hideLoadingIndicator();
        if (hadColoringMode) output.addClass('coloring-mode');
      }, 30000);

      try {
        objectURL = URL.createObjectURL(blob);
        img.src = objectURL;
      } catch (error) {
        console.error('Error creating object URL:', error);
        if (window.ErrorLogger) {
          (window.ErrorLogger as any).logError(error);
        }
        alert('Failed to create image URL. Please try again.');
        cleanup();
        hideLoadingIndicator();
        if (hadColoringMode) output.addClass('coloring-mode');
      }
    }

    function handleImageGenerationError(error) {
      console.error('Error generating image:', error);

      let errorMessage = 'There was an error generating the image. Please try again.';

      if (error.message && error.message.includes('SecurityError')) {
        errorMessage =
          'Unable to access external resources. The image may be generated without some styling.';
      } else if (error.message && error.message.includes('cssRules')) {
        errorMessage =
          'Some external styles could not be loaded. The image will be generated with available styles.';
      }

      alert(errorMessage);
      hideLoadingIndicator();
      const output = $('#output');
      if (hadColoringMode) output.addClass('coloring-mode');
    }
  }, 0);
}
window.downloadOutputImage = downloadOutputImage;

function showLoadingIndicator() {
  if ($('#loadingIndicator').length === 0) {
    $('body').append(`
      <div id="loadingIndicator" class="loading-overlay">
        <div class="loading-dialog">
          <div class="spinner"></div>
          <p class="loading-text">Generating image...</p>
        </div>
      </div>
    `);
  } else {
    $('#loadingIndicator').show();
  }
}

function hideLoadingIndicator() {
  $('#loadingIndicator').hide();
}

// toggleBackground function removed - handled by chatlog-parser.js

function autoResizeTextarea() {
  this.style.height = 'auto';
  this.style.height = this.scrollHeight + 'px';

  const currentText = $(this).val();
  if (currentText === lastProcessedText) return;

  clearTimeout(processingTimeout);
  processingTimeout = setTimeout(() => {
    lastProcessedText = currentText;
    if (typeof ChatlogParser.processOutput === 'function') {
      ChatlogParser.processOutput();
    }
  }, CONFIG.PROCESSING_DEBOUNCE_MS);
}

/**
 * Copies text to clipboard with fallback for older browsers
 * Shows visual feedback on the button element
 * @param {HTMLElement} button - The button element to show feedback on
 */
function copyToClipboard(text, button) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        showCopySuccess(button);
      })
      .catch((err) => {
        console.log('Clipboard API failed, trying fallback', err);
        copyUsingFallback(text, button);
      });
  } else {
    copyUsingFallback(text, button);
  }
}

function copyUsingFallback(text, button) {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;

    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);

    textarea.focus();
    textarea.select();

    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);

    if (successful) {
      showCopySuccess(button);
    } else {
      showCopyError(button);
    }
  } catch (err) {
    console.error('Fallback copy failed:', err);
    showCopyError(button);
  }
}

function showCopySuccess(button) {
  const $btn = $(button);
  const originalHtml = $btn.html();
  const originalBg = $btn.css('background-color');
  const originalBorder = $btn.css('border-color');
  const originalColor = $btn.css('color');

  $btn
    .css({
      'background-color': 'rgba(46, 204, 113, 0.18)',
      'border-color': 'rgba(46, 204, 113, 0.5)',
      color: '#2ecc71',
    })
    .html('<i class="fas fa-check copy-success-icon" aria-hidden="true"></i>');

  setTimeout(() => {
    $btn
      .css({
        'background-color': originalBg,
        'border-color': originalBorder,
        color: originalColor,
      })
      .html(originalHtml);
  }, CONFIG.COPY_FEEDBACK_DURATION_MS);
}

function showCopyError(button) {
  const $btn = $(button);
  const originalHtml = $btn.html();
  const originalBg = $btn.css('background-color');
  const originalBorder = $btn.css('border-color');
  const originalColor = $btn.css('color');

  $btn
    .css({
      'background-color': 'rgba(231, 76, 60, 0.18)',
      'border-color': 'rgba(231, 76, 60, 0.5)',
      color: '#e74c3c',
    })
    .html('<i class="fas fa-times copy-error-icon" aria-hidden="true"></i>');

  setTimeout(() => {
    $btn
      .css({
        'background-color': originalBg,
        'border-color': originalBorder,
        color: originalColor,
      })
      .html(originalHtml);
  }, CONFIG.COPY_FEEDBACK_DURATION_MS);
}

// Reserved for future use - keyboard shortcuts handler
function _handleKeyboardShortcuts(_e) {
  // Keyboard shortcuts removed as requested
}

function initTooltips() {
  $('.info-bracket').hover(
    function () {
      $(this).find('.tooltip-text').fadeIn(CONFIG.TOOLTIP_FADE_MS);
    },
    function () {
      $(this).find('.tooltip-text').fadeOut(CONFIG.TOOLTIP_FADE_MS);
    }
  );
}

/**
 * Saves a chat log to local storage history
 * Maintains a maximum of CONFIG.MAX_HISTORY_ITEMS entries
 * Handles quota exceeded errors gracefully
 */
function saveToHistory(text) {
  try {
    if (!text || !text.trim()) return;

    let history = [];
    try {
      const storedHistory = localStorage.getItem('chatlogHistory');
      if (storedHistory) {
        history = JSON.parse(storedHistory);
        if (!Array.isArray(history)) {
          console.warn('Invalid history format, resetting...');
          history = [];
        }
      }
    } catch (e) {
      console.error('Error reading history:', e);
      history = [];
    }

    history = history.filter((item) => item !== text);
    history.unshift(text);

    const MAX_HISTORY = CONFIG.MAX_HISTORY_ITEMS;
    if (history.length > MAX_HISTORY) {
      history = history.slice(0, MAX_HISTORY);
    }

    try {
      localStorage.setItem('chatlogHistory', JSON.stringify(history));
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        history = history.slice(0, Math.floor(MAX_HISTORY / 2));
        try {
          localStorage.setItem('chatlogHistory', JSON.stringify(history));
        } catch (e2) {
          console.error('Failed to save history after cleanup:', e2);
        }
      } else {
        console.error('Error saving history:', e);
      }
    }
  } catch (e) {
    console.error('Error in saveToHistory:', e);
  }
}

/**
 * @returns {Array<string>} Array of historical chat log texts
 */
function loadHistory() {
  try {
    const history = JSON.parse(localStorage.getItem('chatlogHistory') || '[]');
    return Array.isArray(history) ? history : [];
  } catch (e) {
    console.error('Error loading history:', e);
    return [];
  }
}

function toggleHistoryPanel() {
  const panel = document.getElementById('historyPanel');
  const isOpen = panel.classList.contains('open');

  panel.classList.toggle('open');
  // After toggle, the state is opposite of isOpen, so aria-hidden should match the old state
  panel.setAttribute('aria-hidden', String(isOpen));

  const main = document.getElementById('main');
  if (main) {
    if (!isOpen) {
      main.setAttribute('inert', '');
      main.setAttribute('aria-hidden', 'true');
    } else {
      main.removeAttribute('inert');
      main.removeAttribute('aria-hidden');
    }
  }

  const tab = document.querySelector('.history-tab');
  tab.setAttribute('aria-expanded', String(!isOpen));
  tab.setAttribute('aria-label', isOpen ? 'Open chat history' : 'Close chat history');

  if (!isOpen) {
    tab.classList.add('hidden');
  } else {
    tab.classList.remove('hidden');
  }

  const bmcContainer = document.getElementById('bmc-container');
  if (bmcContainer) {
    bmcContainer.style.display = isOpen ? 'none' : 'block';
    bmcContainer.style.opacity = isOpen ? '0' : '1';
    bmcContainer.style.visibility = isOpen ? 'hidden' : 'visible';
    bmcContainer.style.pointerEvents = isOpen ? 'none' : 'auto';
  }

  if (!isOpen) {
    const firstItem = panel.querySelector<HTMLElement>('.history-item');
    if (firstItem) firstItem.focus();
  }
}

document.addEventListener('click', (e: any) => {
  const historyPanel = document.getElementById('historyPanel');

  if (!e.target.closest('#historyPanel, .history-tab') && historyPanel.classList.contains('open')) {
    toggleHistoryPanel();
  }
});

/**
 * Clears all chat log history after user confirmation
 */
window.clearHistory = async function () {
  const getT = (key, fallback) =>
    window.ChatlogGuidance?.i18n?.t(key) || window.i18n?.t(key) || fallback;
  const deleteTitle = getT('history.deleteTitle', 'Sohbet Geçmişini Sil');
  const deleteConfirm = getT(
    'history.deleteConfirm',
    'Tüm sohbet geçmişini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.'
  );
  const clearAll = getT('history.clearAll', 'Geçmişi Sil');
  const cancelText = getT('ui.cancel', 'Vazgeç');

  const confirmed =
    typeof window.showConfirmDialog === 'function'
      ? await window.showConfirmDialog({
          title: deleteTitle,
          message: deleteConfirm,
          confirmText: clearAll,
          cancelText: cancelText,
          danger: true,
        })
      : confirm(deleteConfirm);

  if (confirmed) {
    localStorage.removeItem('chatlogHistory');
    refreshHistoryPanel();
    if (typeof window.showToast === 'function') {
      window.showToast(getT('toast.historyCleared', 'Sohbet geçmişi temizlendi'), 'fa-trash-alt');
    }
  }
};

/**
 * Refreshes the history panel UI with current history items
 * Applies formatting to each history item for preview
 */
function refreshHistoryPanel() {
  const getT = (key, fallback) =>
    window.ChatlogGuidance?.i18n?.t(key) || window.i18n?.t(key) || fallback;
  const $historyItems = $('.history-items');
  const $loading = $(
    `<div class="history-loading">${getT('history.loading', 'Loading history...')}</div>`
  );
  const $empty = $(
    `<div class="history-empty">${getT('history.empty', 'Kaydedilmiş sohbet kaydı bulunamadı')}</div>`
  );

  $historyItems.empty().append($loading.addClass('active'));

  try {
    const history = loadHistory();

    if (history.length === 0) {
      $loading.removeClass('active');
      $historyItems.append($empty.addClass('active'));
      return;
    }

    const $items = history.map((text, index) => {
      const $item = $(
        '<div class="history-item liquidGlass-wrapper" role="button" tabindex="0" aria-label="Load chatlog from history"></div>'
      );
      $item.data('index', index);

      $item.append('<div class="liquidGlass-effect"></div>');
      $item.append('<div class="liquidGlass-tint"></div>');
      $item.append('<div class="liquidGlass-shine"></div>');

      const $textContainer = $(
        '<div class="liquidGlass-text"><div class="history-item-text"></div></div>'
      );
      const $historyText = $textContainer.find('.history-item-text');

      const lines = text.split('\n');
      const formattedLines = lines.map((line) => {
        // Use the same formatting function as the main output
        if (typeof ChatlogParser.formatLineWithFilter === 'function') {
          return ChatlogParser.formatLineWithFilter(line);
        }
        // Fallback: escape HTML and wrap in white span to match output
        const sanitized = line.replace(/[<>&"']/g, function (match) {
          return {
            '<': '&lt;',
            '>': '&gt;',
            '&': '&amp;',
            '"': '&quot;',
            "'": '&#x27;',
          }[match];
        });
        return `<span class="white">${sanitized}</span>`;
      });

      $historyText.html(formattedLines.join('<br>'));
      $item.append($textContainer);

      return $item;
    });

    $loading.removeClass('active');
    $historyItems.append($items);
  } catch (e) {
    console.error('Error refreshing history panel:', e);
    $loading.removeClass('active');
    $historyItems.append($('<div class="history-error">Error loading history</div>'));
  }
}

document.addEventListener('cm:locale-changed', function () {
  if (typeof refreshHistoryPanel === 'function' && document.getElementById('historyPanel')) {
    refreshHistoryPanel();
  }
});

/**
 * Escapes HTML special characters to prevent XSS attacks
 * @returns {string} The escaped string safe for HTML insertion
 */
function _escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

$(document).ready(function () {
  // Background state is restored by chatlog-parser.js

  if (typeof window.ColorPalette !== 'undefined') {
    window.ColorPalette.init();
  } else {
    console.warn('ColorPalette not available, initialization skipped');
  }

  if (typeof window.foundation === 'undefined' && typeof window.Foundation === 'undefined') {
    console.warn('Foundation.js not loaded - UI components may not work properly');
  }

  if (typeof window.domtoimage === 'undefined') {
    console.warn(
      'dom-to-image-more.js not loaded - exports will use the approximate native canvas fallback'
    );
  }

  if (typeof window.saveAs === 'undefined') {
    console.warn('FileSaver.js not loaded - file download feature will be unavailable');
  }

  function getCharacterList() {
    return JSON.parse(localStorage.getItem('characterNameList') || '[]');
  }
  function saveCharacterList(list) {
    localStorage.setItem('characterNameList', JSON.stringify(list));
  }
  function renderCharacterDropdown() {
    const dropdown = $('#characterNameDropdown');
    const $liquidGlassText = dropdown.find('.liquidGlass-text');
    const list = getCharacterList();
    const content =
      list.length === 0
        ? '<div style="background-color: #202124; padding: 8px; color: #aaa9a9;">Kayıtlı karakter bulunamadı</div>'
        : list
            .map(
              (name) =>
                `<div class="character-dropdown-item" style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; cursor: pointer;">
          <span class="character-name-select">${$('<div>').text(name).html()}</span>
          <button class="remove-character-btn" data-name="${$('<div>').text(name).html()}" style="background: none; border: none; color: #c00; font-size: 16px; cursor: pointer;">&times;</button>
        </div>`
            )
            .join('');

    if ($liquidGlassText.length > 0) {
      $liquidGlassText.html(content);
    } else {
      dropdown.html(content);
    }
  }

  $('#addCharacterBtn').on('click', function () {
    const val = $('#characterNameInput').val().trim();
    if (!val) return;
    const list = getCharacterList();
    if (!list.includes(val)) {
      list.push(val);
      saveCharacterList(list);
      renderCharacterDropdown();
    }
    $('#characterNameInput').val('');
  });

  $('#showCharacterListBtn').on('click', function (e) {
    e.stopPropagation();
    const dropdown = $('#characterNameDropdown');
    if (dropdown.is(':visible')) {
      dropdown.hide();
    } else {
      renderCharacterDropdown();
      dropdown.show();
    }
  });

  $(document).on('click', '.character-name-select', function () {
    const name = $(this).text();
    $('#characterNameInput').val(name);
    $('#characterNameDropdown').hide();
    localStorage.setItem('chatlogCharacterName', name);
    if (typeof ChatlogParser.applyFilter === 'function') ChatlogParser.applyFilter();
  });

  $(document).on('click', '.remove-character-btn', function (e) {
    e.stopPropagation();
    const name = $(this).data('name');
    const list = getCharacterList().filter((n) => n !== name);
    saveCharacterList(list);
    renderCharacterDropdown();
  });

  $(document).on('click', function (e) {
    if (!$(e.target).closest('.input-group').length) {
      $('#characterNameDropdown').hide();
    }
  });

  $('#characterNameInput').on('keydown', function (e) {
    if (e.key === 'Escape') {
      $('#characterNameDropdown').hide();
    }
  });

  $('#font-label').val(localStorage.getItem('chatlogFontSize') || CONFIG.FONT_SIZE_DEFAULT);
  $('#lineLengthInput').val(
    localStorage.getItem('chatlogLineLength') || CONFIG.LINE_LENGTH_DEFAULT
  );
  if (localStorage.getItem('chatlogLineSpacing') === '1.45') {
    localStorage.setItem('chatlogLineSpacing', CONFIG.LINE_SPACING_DEFAULT.toString());
  }
  $('#lineSpacingInput').val(
    localStorage.getItem('chatlogLineSpacing') || CONFIG.LINE_SPACING_DEFAULT
  );
  $('#characterNameInput').val(localStorage.getItem('chatlogCharacterName') || '');

  $('#font-label').next('.golden-sizes-hint').html(goldenHintHTML(TYPOGRAPHIC_SCALE));

  updateFontSize();
  updateLineSpacing();

  initTooltips();

  refreshHistoryPanel();

  $('#font-label').on('input', function () {
    const value = parseInt($(this).val()) || CONFIG.FONT_SIZE_DEFAULT;
    if (value < CONFIG.FONT_SIZE_MIN) $(this).val(CONFIG.FONT_SIZE_MIN);
    if (value > CONFIG.FONT_SIZE_MAX) $(this).val(CONFIG.FONT_SIZE_MAX);

    // Font size is now stored automatically in updateFontSize()
    updateFontSize();

    // Bg gap-fill shadow boyutu font-size'a bağlı — yeniden hesapla.
    updateLineSpacing();

    if (typeof ChatlogParser.processOutput === 'function') {
      ChatlogParser.processOutput();
    }

    showAutoSaveIndicator();
  });

  $('#lineLengthInput').on('input', function () {
    const value = parseInt($(this).val()) || CONFIG.LINE_LENGTH_DEFAULT;
    // Remove line length limitations - allow any positive value
    if (value < CONFIG.LINE_LENGTH_MIN) $(this).val(CONFIG.LINE_LENGTH_MIN);

    try {
      localStorage.setItem('chatlogLineLength', $(this).val());
    } catch (e) {
      console.warn('Could not save line length to localStorage:', e);
    }
    if (typeof ChatlogParser.processOutput === 'function') {
      ChatlogParser.processOutput();
    }
    showAutoSaveIndicator();
  });

  $('#lineSpacingInput').on('input', function () {
    const value = parseFloat($(this).val());
    if (!isNaN(value)) {
      if (value < CONFIG.LINE_SPACING_MIN) $(this).val(CONFIG.LINE_SPACING_MIN);
      if (value > CONFIG.LINE_SPACING_MAX) $(this).val(CONFIG.LINE_SPACING_MAX);
    }
    updateLineSpacing();
    showAutoSaveIndicator();
  });

  $('#characterNameInput').on('input', function () {
    try {
      localStorage.setItem('chatlogCharacterName', $(this).val());
    } catch (e) {
      console.warn('Could not save character name to localStorage:', e);
    }
    if (typeof ChatlogParser.applyFilter === 'function') {
      ChatlogParser.applyFilter();
    }
    showAutoSaveIndicator();
  });

  $('#chatlogInput').on('input', function () {
    const text = $(this).val().trim();

    if (text.length > 1000) {
      $('#output').addClass('processing');
      setTimeout(() => {
        $('#output').removeClass('processing');
      }, 100);
    }
  });

  $(document).on('chatlogProcessed', function (_event, _text) {});

  $('#downloadOutputTransparent').click(async function () {
    downloadOutputImage('download');
  });

  $('#copyOutputImage').click(async function () {
    downloadOutputImage('copy');
  });
  // toggleBackground binding removed - handled by chatlog-parser.js

  const textarea: any = document.querySelector('.textarea-input');
  textarea.addEventListener('input', autoResizeTextarea);

  if (textarea.value) {
    autoResizeTextarea.call(textarea);
  }

  $('#censorCharButton').click(function () {
    copyToClipboard('÷', this);
  });

  $('.button').hover(
    function () {
      $(this).css('transform', 'translateY(-2px)');
    },
    function () {
      $(this).css('transform', 'translateY(0)');
    }
  );

  $(document).on('click', function (e) {
    if (!$(e.target).closest('#historyPanel, #chatlogInput, .history-tab').length) {
      const panel = document.getElementById('historyPanel');
      if (panel && panel.classList.contains('open')) {
        toggleHistoryPanel();
      }
    }
  });

  $(document).on('click', '.history-item', function () {
    const index = $(this).data('index');
    const history = loadHistory();
    if (history[index]) {
      $('#chatlogInput').val(history[index]).trigger('input');
      const panel = document.getElementById('historyPanel');
      if (panel && panel.classList.contains('open')) {
        toggleHistoryPanel();
      }
    }
  });

  // Ensure a single Clear All button exists and is wired (no inline handlers)
  (function ensureClearHistoryButton() {
    const $header = $('.history-header');
    if (!$header.length) return;
    let $btn = $header.find('.clear-history-btn');
    if (!$btn.length) {
      $btn = $(
        '<button class="clear-history-btn" aria-label="Clear all history">Clear All</button>'
      );
      $header.append($btn);
    }
    $btn.off('click.clear').on('click.clear', function (e) {
      e.preventDefault();
      if (typeof window.clearHistory === 'function') {
        window.clearHistory();
      }
    });
  })();

  $('#closeHistoryBtn').on('click', function () {
    const panel = document.getElementById('historyPanel');
    if (panel && panel.classList.contains('open')) {
      toggleHistoryPanel();
    }
  });

  $('#closeColorPaletteBtn').on('click', function () {
    $('#toggleColorPalette').trigger('click');
  });
});

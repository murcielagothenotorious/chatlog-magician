import { calculateFitRect } from './canvas-geometry.js';
import {
  createRenderPlan,
  extensionForFormat,
  mimeTypeForFormat,
  normalizeExportOptions,
} from './scene-renderer-contract.js';

const DEFAULT_FONT_SIZE = 12;
const DEFAULT_LINE_SPACING = 1.3;

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positive(value, fallback) {
  const number = finite(value, fallback);
  return number > 0 ? number : fallback;
}

export function canvasCompositionLayout(canvas, blocks = []) {
  const width = positive(canvas.width, 600);
  const height = positive(canvas.height, 600);
  const paddingX = Math.max(0, finite(canvas.padding?.x, 0));
  const paddingY = Math.max(0, finite(canvas.padding?.y, 0));
  const composition = canvas.composition;

  if (composition === 'inset') {
    return {
      width: width + paddingX * 2,
      height: height + paddingY * 2,
      sceneOrigin: { x: paddingX, y: paddingY },
      chatOrigin: { x: paddingX, y: paddingY },
    };
  }

  if (composition === 'below') {
    const visibleBlocks = blocks.filter((block) => block?.visible !== false);
    const chatBottom = visibleBlocks.reduce((bottom, block) => {
      const y = finite(block?.transform?.y, 0);
      const blockHeight = positive(block?.transform?.height, 0);
      return Math.max(bottom, y + blockHeight);
    }, 0);
    const chatRight = visibleBlocks.reduce((right, block) => {
      const x = finite(block?.transform?.x, 0);
      const blockWidth = positive(block?.transform?.width, 0);
      return Math.max(right, x + blockWidth);
    }, 0);
    return {
      width: Math.max(width, paddingX + chatRight),
      height: height + paddingY + chatBottom,
      sceneOrigin: { x: 0, y: 0 },
      chatOrigin: { x: paddingX, y: height + paddingY },
    };
  }

  return {
    width,
    height,
    sceneOrigin: { x: 0, y: 0 },
    chatOrigin: { x: paddingX, y: paddingY },
  };
}

function assetSource(assetRegistry, assetId) {
  const record = assetId ? assetRegistry?.get?.(assetId) : null;
  if (!record?.source) return null;
  const width = positive(record.width ?? record.source.width, 0);
  const height = positive(record.height ?? record.source.height, 0);
  if (width <= 0 || height <= 0) return null;
  return { source: record.source, width, height };
}

function drawFilmGrain(context, x, y, width, height, grainAmount) {
  if (!grainAmount || grainAmount <= 0) return;
  try {
    const grainCanvas =
      typeof document !== 'undefined' && document.createElement
        ? document.createElement('canvas')
        : null;
    if (grainCanvas && grainCanvas.getContext) {
      const size = 128;
      grainCanvas.width = size;
      grainCanvas.height = size;
      const gctx = grainCanvas.getContext('2d');
      if (gctx && gctx.createImageData) {
        const imgData = gctx.createImageData(size, size);
        const data = imgData.data;
        const opacity = (grainAmount / 100) * 0.4;
        for (let i = 0; i < data.length; i += 4) {
          const val = Math.floor(Math.random() * 255);
          data[i] = val;
          data[i + 1] = val;
          data[i + 2] = val;
          data[i + 3] = Math.floor(Math.random() * 255 * opacity);
        }
        gctx.putImageData(imgData, 0, 0);
        const pattern = context.createPattern ? context.createPattern(grainCanvas, 'repeat') : null;
        if (pattern) {
          context.save();
          context.fillStyle = pattern;
          context.fillRect(x, y, width, height);
          context.restore();
          return;
        }
      }
    }
  } catch (_e) {
    // ignore
  }
  context.save();
  try {
    context.globalAlpha = Math.min(1, Math.max(0, (grainAmount / 100) * 0.2));
    context.fillStyle = '#808080';
    context.fillRect(x, y, width, height);
  } finally {
    context.restore();
  }
}

function drawRedactionBoxes(context, redactionBoxes = [], origin = { x: 0, y: 0 }) {
  if (!Array.isArray(redactionBoxes) || redactionBoxes.length === 0) return;
  for (const box of redactionBoxes) {
    if (box.visible === false) continue;
    const x = finite(box.x, 0) + finite(origin.x, 0);
    const y = finite(box.y, 0) + finite(origin.y, 0);
    const width = positive(box.width, 0);
    const height = positive(box.height, 0);
    if (width <= 0 || height <= 0) continue;

    const rotation = (finite(box.rotation, 0) * Math.PI) / 180;
    context.save();
    try {
      if (rotation !== 0) {
        context.translate(x + width / 2, y + height / 2);
        context.rotate(rotation);
        context.fillStyle = '#000000';
        context.fillRect(-width / 2, -height / 2, width, height);
      } else {
        context.fillStyle = '#000000';
        context.fillRect(x, y, width, height);
      }
    } finally {
      context.restore();
    }
  }
}

function drawBackground(context, plan, layout, assetRegistry) {
  const { background = {}, fitMode = 'fit' } = plan.canvas;
  if (background.visible === false) return;
  const { x, y } = layout.sceneOrigin;
  const width = positive(plan.canvas.width, 600);
  const height = positive(plan.canvas.height, 600);
  const opacity = Math.min(1, Math.max(0, finite(background.opacity, 1)));
  const blur = Math.max(0, finite(background.blur, 0));
  const grain = Math.min(100, Math.max(0, finite(background.grain, 0)));

  if (background.type === 'solid' || background.type === 'color') {
    context.save();
    try {
      context.globalAlpha = opacity;
      context.fillStyle = background.color || '#000000';
      context.fillRect(x, y, width, height);
      if (grain > 0) {
        drawFilmGrain(context, x, y, width, height, grain);
      }
    } finally {
      context.restore();
    }
    return;
  }
  if (background.type !== 'image') return;

  const asset = assetSource(assetRegistry, background.assetId);
  if (!asset) return;
  const rect = calculateFitRect(asset, { width, height }, fitMode);
  context.save();
  try {
    context.globalAlpha = opacity;
    if (blur > 0) {
      context.filter = `blur(${blur}px)`;
    }
    context.drawImage(asset.source, x + rect.x, y + rect.y, rect.width, rect.height);
    if (grain > 0) {
      context.filter = 'none';
      drawFilmGrain(context, x, y, width, height, grain);
    }
  } finally {
    context.restore();
  }
}

function effectFilter(effects: any = {}) {
  const filters = [];
  const blur = Math.max(0, finite(effects.blur, 0));
  if (blur > 0) filters.push(`blur(${blur}px)`);
  for (const [key, cssName] of [
    ['brightness', 'brightness'],
    ['contrast', 'contrast'],
    ['grayscale', 'grayscale'],
    ['saturate', 'saturate'],
    ['sepia', 'sepia'],
  ]) {
    if (effects[key] !== undefined) filters.push(`${cssName}(${finite(effects[key], 1)})`);
  }
  if (effects.hueRotate !== undefined) {
    filters.push(`hue-rotate(${finite(effects.hueRotate, 0)}deg)`);
  }
  return filters.length > 0 ? filters.join(' ') : 'none';
}

function drawImageLayer(context, layer, origin, assetRegistry) {
  const asset = assetSource(assetRegistry, layer.assetId);
  if (!asset) return;
  const transform = layer.transform ?? {};
  const x = finite(transform.x, 0);
  const y = finite(transform.y, 0);
  const width = positive(transform.width, asset.width);
  const height = positive(transform.height, asset.height);
  const rotation = (finite(transform.rotation, 0) * Math.PI) / 180;

  context.save();
  context.globalAlpha = Math.min(1, Math.max(0, finite(layer.opacity, 1)));
  context.filter = effectFilter(layer.effects);
  context.translate(origin.x + x + width / 2, origin.y + y + height / 2);
  context.rotate(rotation);
  context.drawImage(asset.source, -width / 2, -height / 2, width, height);
  context.restore();
}

function chatStyle(block, chat) {
  const isGtawLook = chat.gtawLook === true;
  const style = block.style ?? {};
  const contrast = style.contrast ?? chat.contrast;
  const contrastOutline = isGtawLook ? 2 : ({ low: 1, medium: 2, high: 3 }[contrast] ?? 0);
  const background = style.background ?? chat.background ?? {};
  return {
    font: isGtawLook ? 'Arial' : style.font || chat.font || 'Arial',
    fontSize: positive(style.fontSize ?? chat.fontSize, DEFAULT_FONT_SIZE),
    fontWeight: isGtawLook ? 700 : finite(style.fontWeight, 700),
    lineSpacing: positive(
      style.lineSpacing ?? chat.lineSpacing,
      isGtawLook ? 1.25 : DEFAULT_LINE_SPACING
    ),
    outline: Math.max(0, finite(style.outline, contrastOutline)),
    outlineColor: style.outlineColor || '#000000',
    background: {
      enabled: background.enabled === true,
      color: background.color || style.backgroundColor || '#000000',
      opacity: Math.min(1, Math.max(0, finite(background.opacity ?? style.backgroundOpacity, 1))),
    },
  };
}

function fontValue(style, segment) {
  return `${segment.italic ? 'italic ' : ''}${style.fontWeight} ${style.fontSize}px ${style.font}`;
}

function splitText(text) {
  return String(text).match(/\S+\s*|\s+/gu) ?? [];
}

function wrapSegments(context, inputLines, width, style) {
  const lines = [];
  for (const sourceLine of inputLines) {
    let line = [];
    let lineWidth = 0;
    for (const segment of sourceLine) {
      for (const token of splitText(segment.text)) {
        context.font = fontValue(style, segment);
        const tokenWidth = context.measureText(token).width;
        if (line.length > 0 && lineWidth + tokenWidth > width) {
          lines.push({ entries: line, width: lineWidth });
          line = [];
          lineWidth = 0;
        }

        if (tokenWidth <= width || token.length <= 1) {
          line.push({ ...segment, text: token, width: tokenWidth });
          lineWidth += tokenWidth;
          continue;
        }

        for (const character of token) {
          const characterWidth = context.measureText(character).width;
          if (line.length > 0 && lineWidth + characterWidth > width) {
            lines.push({ entries: line, width: lineWidth });
            line = [];
            lineWidth = 0;
          }
          line.push({ ...segment, text: character, width: characterWidth });
          lineWidth += characterWidth;
        }
      }
    }
    lines.push({ entries: line, width: lineWidth });
  }
  return lines;
}

function lineStart(anchor, width, lineWidth) {
  if (anchor === 'center') return (width - lineWidth) / 2;
  if (anchor === 'right') return width - lineWidth;
  return 0;
}

function wrapCacheKey(blockId, formatted, width, style) {
  let hash = `${blockId}|${width}|${style.font}|${style.fontSize}|${style.fontWeight}`;
  for (const line of formatted) {
    for (const seg of line) {
      hash += `|${seg.text}|${seg.italic ? 1 : 0}|${seg.color || ''}`;
    }
    hash += '\n';
  }
  return hash;
}

function drawChatBlock(context, block, chat, origin, formatBlock, wrapCache) {
  const formatted = formatBlock(block, chat);
  if (!Array.isArray(formatted) || formatted.length === 0) return;

  const transform = block.transform ?? {};
  const scale = positive(block.scale, 1);
  const width = positive(transform.width, 640) / scale;
  const style = chatStyle(block, chat);
  let lines;
  if (wrapCache) {
    const cacheKey = wrapCacheKey(block.id, formatted, width, style);
    lines = wrapCache.get(cacheKey);
    if (!lines) {
      lines = wrapSegments(context, formatted, width, style);
      wrapCache.set(cacheKey, lines);
    }
  } else {
    lines = wrapSegments(context, formatted, width, style);
  }
  const lineHeight = style.fontSize * style.lineSpacing;
  const textHeight = Math.max(lineHeight, lines.length * lineHeight);
  const rotation = (finite(transform.rotation, 0) * Math.PI) / 180;

  context.save();
  context.globalAlpha = Math.min(1, Math.max(0, finite(block.opacity, 1)));
  context.translate(origin.x + finite(transform.x, 0), origin.y + finite(transform.y, 0));
  context.rotate(rotation);
  context.scale(scale, scale);

  if (style.background.enabled) {
    const alpha = context.globalAlpha;
    context.globalAlpha = alpha * style.background.opacity;
    context.fillStyle = style.background.color;
    context.fillRect(0, 0, width, textHeight);
    context.globalAlpha = alpha;
  }

  const opsecActive =
    Boolean(typeof globalThis !== 'undefined' && globalThis.ChatlogParser?.opsecActive) ||
    Boolean(
      typeof globalThis !== 'undefined' &&
      globalThis.document?.getElementById?.('output')?.classList?.contains('opsec-active')
    );

  lines.forEach((line, lineIndex) => {
    let x = lineStart(block.anchor, width, line.width);
    const y = style.fontSize + lineIndex * lineHeight;
    for (const entry of line.entries) {
      context.font = fontValue(style, entry);
      context.fillStyle = entry.color || '#f1f1f1';
      context.textBaseline = 'alphabetic';
      if (entry.remove) {
        if (opsecActive || entry.opsec) {
          // Draw solid black redaction bar for opsec mode
          const boxH = Math.round(style.fontSize * 1.15);
          const boxY = y - style.fontSize + Math.round((lineHeight - boxH) / 2);
          context.fillStyle = '#000000';
          context.fillRect(x, boxY, Math.max(4, entry.width), boxH);
          context.lineWidth = 1;
          context.strokeStyle = 'rgba(255, 255, 255, 0.45)';
          context.strokeRect(x + 0.5, boxY + 0.5, Math.max(3, entry.width - 1), boxH - 1);
        }
        // advance x regardless
        x += entry.width;
        continue;
      }
      context.filter = entry.censored ? 'blur(4px)' : 'none';
      if (style.outline > 0) {
        context.lineWidth = style.outline * 2;
        context.strokeStyle = style.outlineColor;
        context.lineJoin = 'round';
        context.strokeText(entry.text, x, y);
      }
      context.fillText(entry.text, x, y);
      x += entry.width;
    }
  });
  context.restore();
}

function canvasToBlob(canvas, mimeType, quality) {
  if (typeof canvas.convertToBlob === 'function') {
    return canvas.convertToBlob({ type: mimeType, quality });
  }
  if (typeof canvas.toBlob !== 'function') {
    return Promise.reject(new TypeError('Canvas does not support blob export'));
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas export failed'))),
      mimeType,
      quality
    );
  });
}

function normalizedFilename(filename, format) {
  const extension = extensionForFormat(format);
  const stem = String(filename || 'chatlog').replace(/\.(?:png|jpe?g)$/i, '') || 'chatlog';
  return `${stem}.${extension}`;
}

export function createCanvasRenderer({
  createCanvas = () => document.createElement('canvas'),
  assetRegistry,
  formatBlock,
  navigator: browserNavigator = globalThis.navigator,
  document: browserDocument = globalThis.document,
  createObjectURL = globalThis.URL?.createObjectURL?.bind(globalThis.URL),
  revokeObjectURL = globalThis.URL?.revokeObjectURL?.bind(globalThis.URL),
  ClipboardItem: ClipboardItemConstructor = globalThis.ClipboardItem,
}: any = {}) {
  if (typeof createCanvas !== 'function') throw new TypeError('createCanvas must be a function');
  if (typeof formatBlock !== 'function') throw new TypeError('formatBlock must be a function');

  const wrapCache = new Map();

  async function drawScene(project, targetCanvas) {
    const plan = createRenderPlan(project);
    const layout = canvasCompositionLayout(plan.canvas, plan.blocks);
    targetCanvas.width = layout.width;
    targetCanvas.height = layout.height;
    const context = targetCanvas.getContext?.('2d');
    if (!context) throw new TypeError('A 2D canvas context is required');

    context.clearRect(0, 0, layout.width, layout.height);
    drawBackground(context, plan, layout, assetRegistry);
    for (const layer of plan.layers)
      drawImageLayer(context, layer, layout.sceneOrigin, assetRegistry);
    drawRedactionBoxes(context, plan.redactionBoxes || project.redactionBoxes, layout.sceneOrigin);
    for (const block of plan.blocks) {
      drawChatBlock(context, block, project.chat ?? {}, layout.chatOrigin, formatBlock, wrapCache);
    }
    return targetCanvas;
  }

  async function toBlob(project, options = {}) {
    const exportOptions = normalizeExportOptions({ ...project?.export, ...options });
    const canvas = createCanvas();
    wrapCache.clear();
    await drawScene(project, canvas);
    return canvasToBlob(
      canvas,
      mimeTypeForFormat(exportOptions.format),
      exportOptions.format === 'jpeg' ? exportOptions.jpegQuality : undefined
    );
  }

  async function copy(project) {
    if (typeof browserNavigator?.clipboard?.write !== 'function') {
      throw new Error('Clipboard image writing is unavailable');
    }
    const blob = await toBlob(project);
    const item = ClipboardItemConstructor
      ? new ClipboardItemConstructor({ [blob.type]: blob })
      : { [blob.type]: blob };
    await browserNavigator.clipboard.write([item]);
    return blob;
  }

  async function download(project, filename = 'chatlog') {
    if (!browserDocument?.createElement || !browserDocument?.body || !createObjectURL) {
      throw new Error('Browser download APIs are unavailable');
    }
    const options = normalizeExportOptions(project?.export);
    const blob = await toBlob(project, options);
    const url = createObjectURL(blob);
    const anchor = browserDocument.createElement('a');
    const outputName = normalizedFilename(filename, options.format);
    anchor.href = url;
    anchor.download = outputName;
    browserDocument.body.appendChild(anchor);
    try {
      anchor.click();
    } finally {
      anchor.remove();
      revokeObjectURL?.(url);
    }
    return outputName;
  }

  return {
    render: drawScene,
    toBlob,
    copy,
    download,
    clearCache() {
      wrapCache.clear();
    },
  };
}

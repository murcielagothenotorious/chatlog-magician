import { normalizeProject } from './project-model.js';

const ANCHORS = new Set(['left', 'center', 'right']);
const CHAT_SOURCES = new Set(['main-chat', 'custom']);
const MOVE_DIRECTIONS = new Set(['front', 'back', 'forward', 'backward']);
const DEFAULT_TRANSFORM = { x: 0, y: 0, width: 640, height: 360, rotation: 0 };
const OPAQUE_ASSET_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const UNSAFE_RECORD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function clamp(value, minimum, maximum, fallback) {
  let number;
  try {
    number = Number(value);
  } catch {
    return fallback;
  }
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}

function finiteNumber(value, fallback) {
  return clamp(value, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, fallback);
}

function stringValue(value, fallback) {
  return typeof value === 'string' ? value : fallback;
}

function booleanValue(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function createId(kind) {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${kind}-${globalThis.crypto.randomUUID()}`;
  }
  return `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function cloneSerializable(value, path, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'object') {
    throw new TypeError(`${path} must contain only serializable data`);
  }
  if (seen.has(value)) {
    throw new TypeError(`${path} must contain only serializable data`);
  }

  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${path} must contain only serializable data`);
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new TypeError(`${path} must contain only serializable data`);
  }
  const unsafeKey = Object.getOwnPropertyNames(value).find((key) => UNSAFE_RECORD_KEYS.has(key));
  if (unsafeKey) {
    throw new TypeError(`${path} contains unsafe key ${unsafeKey}`);
  }

  seen.add(value);
  const clone = Array.isArray(value) ? [] : {};
  for (const [key, child] of Object.entries(value)) {
    clone[key] = cloneSerializable(child, `${path}.${key}`, seen);
  }
  seen.delete(value);
  return clone;
}

function dataRecord(value, path) {
  if (value === undefined) return {};
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${path} must be a serializable object`);
  }
  return cloneSerializable(value, path);
}

function normalizeFormattedLines(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new TypeError('Formatted chat lines must be an array');

  return value.map((line, lineIndex) => {
    if (!Array.isArray(line)) throw new TypeError('Each formatted chat line must be an array');
    return line.map((segment, segmentIndex) => {
      const data = dataRecord(segment, `Formatted chat segment ${lineIndex}.${segmentIndex}`);
      return {
        text: stringValue(data.text, ''),
        color: stringValue(data.color, '#f1f1f1'),
        italic: booleanValue(data.italic, false),
        censored: booleanValue(data.censored, false),
        remove: booleanValue(data.remove, false),
        opsec: booleanValue(data.opsec, false),
      };
    });
  });
}

function normalizeTransform(value: any = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    x: finiteNumber(source.x, DEFAULT_TRANSFORM.x),
    y: finiteNumber(source.y, DEFAULT_TRANSFORM.y),
    width: clamp(source.width, 1, Number.MAX_VALUE, DEFAULT_TRANSFORM.width),
    height: clamp(source.height, 1, Number.MAX_VALUE, DEFAULT_TRANSFORM.height),
    rotation: clamp(source.rotation, -180, 180, DEFAULT_TRANSFORM.rotation),
  };
}

function sceneCollection(project, id) {
  if (project.layers.some((item) => item.id === id)) return 'layers';
  if (project.blocks.some((item) => item.id === id)) return 'blocks';
  return null;
}

function normalizeSceneItem(item) {
  if (item?.kind === 'image') return createImageLayer(item);
  if (item?.kind === 'chat') return createChatBlock(item);
  throw new TypeError('Scene item kind must be image or chat');
}

export function assertOpaqueAssetId(assetId) {
  if (typeof assetId !== 'string' || !OPAQUE_ASSET_ID_PATTERN.test(assetId)) {
    throw new TypeError('Asset ID must be an opaque token');
  }
  return assetId;
}

export function createImageLayer(options: any = {}) {
  return {
    id: stringValue(options.id, createId('image')),
    kind: 'image',
    name: stringValue(options.name, 'Image'),
    assetId: assertOpaqueAssetId(options.assetId),
    visible: booleanValue(options.visible, true),
    locked: booleanValue(options.locked, false),
    opacity: clamp(options.opacity, 0, 1, 1),
    zIndex: Math.round(finiteNumber(options.zIndex, 0)),
    effects: dataRecord(options.effects, 'Image layer effects'),
    transform: normalizeTransform(options.transform),
  };
}

export function createChatBlock(options: any = {}) {
  return {
    id: stringValue(options.id, createId('chat')),
    kind: 'chat',
    name: stringValue(options.name, 'Chat'),
    input: stringValue(options.input, ''),
    source: CHAT_SOURCES.has(options.source) ? options.source : 'custom',
    formattedLines: normalizeFormattedLines(options.formattedLines),
    visible: booleanValue(options.visible, true),
    locked: booleanValue(options.locked, false),
    opacity: clamp(options.opacity, 0, 1, 1),
    zIndex: Math.round(finiteNumber(options.zIndex, 0)),
    scale: clamp(options.scale, 0.25, 4, 1),
    anchor: ANCHORS.has(options.anchor) ? options.anchor : 'left',
    transform: normalizeTransform(options.transform),
    style: dataRecord(options.style, 'Chat block style'),
  };
}

export function addSceneItem(project, item) {
  const next: any = normalizeProject(project);
  const normalizedItem = normalizeSceneItem(item);
  next[normalizedItem.kind === 'image' ? 'layers' : 'blocks'].push(normalizedItem);
  return normalizeProject(next);
}

export function updateSceneItem(project, id, patch = {}) {
  const safePatch = dataRecord(patch, 'Scene item patch');
  const next: any = normalizeProject(project);

  const boxIndex = next.redactionBoxes?.findIndex((item) => item.id === id);
  if (boxIndex !== undefined && boxIndex >= 0) {
    const current = next.redactionBoxes[boxIndex];
    const transform = safePatch.transform ? normalizeTransform(safePatch.transform) : null;
    next.redactionBoxes[boxIndex] = {
      ...current,
      ...(transform
        ? {
            x: transform.x,
            y: transform.y,
            width: transform.width,
            height: transform.height,
          }
        : {}),
      ...(safePatch.visible !== undefined
        ? { visible: booleanValue(safePatch.visible, true) }
        : {}),
    };
    return normalizeProject(next);
  }

  const collection = sceneCollection(next, id);
  if (!collection) return normalizeProject(next);

  const index = next[collection].findIndex((item) => item.id === id);
  const current = next[collection][index];
  next[collection][index] = normalizeSceneItem({
    ...current,
    ...safePatch,
    id: current.id,
    kind: current.kind,
    effects: { ...current.effects, ...safePatch.effects },
    style: { ...current.style, ...safePatch.style },
    transform: { ...current.transform, ...safePatch.transform },
  });
  return normalizeProject(next);
}

export function removeSceneItem(project, id) {
  const next: any = normalizeProject(project);
  next.layers = next.layers.filter((item) => item.id !== id);
  next.blocks = next.blocks.filter((item) => item.id !== id);
  if (Array.isArray(next.redactionBoxes)) {
    next.redactionBoxes = next.redactionBoxes.filter((item) => item.id !== id);
  }
  return normalizeProject(next);
}

export function moveSceneItem(project, id, direction) {
  const next: any = normalizeProject(project);
  const collection = sceneCollection(next, id);
  if (!collection || !MOVE_DIRECTIONS.has(direction)) return normalizeProject(next);

  const ordered = next[collection]
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) => finiteNumber(a.item.zIndex, 0) - finiteNumber(b.item.zIndex, 0) || a.index - b.index
    )
    .map(({ item }) => item);
  const currentIndex = ordered.findIndex((item) => item.id === id);
  const [item] = ordered.splice(currentIndex, 1);
  let targetIndex;
  if (direction === 'front') targetIndex = ordered.length;
  if (direction === 'back') targetIndex = 0;
  if (direction === 'forward') targetIndex = Math.min(currentIndex + 1, ordered.length);
  if (direction === 'backward') targetIndex = Math.max(currentIndex - 1, 0);
  ordered.splice(targetIndex, 0, item);
  next[collection] = ordered.map((entry, zIndex) => ({ ...entry, zIndex }));
  return normalizeProject(next);
}

export function selectSceneItem(project, id) {
  const source: any = normalizeProject(project);
  const found = [...source.layers, ...source.blocks].find((item) => item.id === id);
  if (found) return found;
  const box = source.redactionBoxes?.find((item) => item.id === id);
  if (box) {
    return {
      id: box.id,
      kind: 'redaction',
      name: 'Sansür Kutusu',
      visible: box.visible !== false,
      locked: false,
      transform: {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        rotation: 0,
      },
    };
  }
  return null;
}

function snapCoordinate(position, size, targets, tolerance) {
  let snapped = position;
  let nearestDistance = tolerance + 1;
  for (const target of targets) {
    for (const candidate of [target, target - size]) {
      const distance = Math.abs(candidate - position);
      if (distance <= tolerance && distance < nearestDistance) {
        snapped = candidate;
        nearestDistance = distance;
      }
    }
  }
  return snapped;
}

export function snapSceneItem(transform, peers = [], canvas: any = {}) {
  const source = transform && typeof transform === 'object' ? transform : {};
  const width = finiteNumber(source.width, 0);
  const height = finiteNumber(source.height, 0);
  const x = finiteNumber(source.x, 0);
  const y = finiteNumber(source.y, 0);
  const tolerance = Math.max(0, finiteNumber(canvas.tolerance, 5));
  const horizontalTargets = [0, finiteNumber(canvas.width, 0)];
  const verticalTargets = [0, finiteNumber(canvas.height, 0)];

  for (const peer of peers) {
    if (
      !Number.isFinite(peer?.x) ||
      !Number.isFinite(peer?.y) ||
      !Number.isFinite(peer?.width) ||
      !Number.isFinite(peer?.height) ||
      peer.width <= 0 ||
      peer.height <= 0
    ) {
      continue;
    }
    horizontalTargets.push(peer.x, peer.x + peer.width);
    verticalTargets.push(peer.y, peer.y + peer.height);
  }

  return {
    ...source,
    x: snapCoordinate(x, width, horizontalTargets, tolerance),
    y: snapCoordinate(y, height, verticalTargets, tolerance),
  };
}

export function sceneBounds(project) {
  const source: any = normalizeProject(project);
  const rectangles = [...source.layers, ...source.blocks]
    .filter((item) => item.visible !== false)
    .map((item) => item.transform)
    .filter(
      (transform) =>
        Number.isFinite(transform?.x) &&
        Number.isFinite(transform?.y) &&
        Number.isFinite(transform?.width) &&
        Number.isFinite(transform?.height) &&
        transform.width > 0 &&
        transform.height > 0
    );

  if (rectangles.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

  const left = Math.min(...rectangles.map(({ x }) => x));
  const top = Math.min(...rectangles.map(({ y }) => y));
  const right = Math.max(...rectangles.map(({ x, width }) => x + width));
  const bottom = Math.max(...rectangles.map(({ y, height }) => y + height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

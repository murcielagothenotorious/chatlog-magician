// Extensionless on purpose: api/_lib imports this module through Next
// (Turbopack), which does not map a `.js` specifier to the `.ts` source the
// way esbuild/vite do; the browser never loads it natively (bundled).
import { deserializeProject, serializeProject, type Project } from './project-model';

export const COMMUNITY_PRESET_SCHEMA_VERSION = 1;

const FONT_STACKS: Record<string, string> = {
  Arial: 'Arial, Helvetica, sans-serif',
  'Trebuchet MS': '"Trebuchet MS", Helvetica, sans-serif',
  Verdana: 'Verdana, Geneva, sans-serif',
  Tahoma: 'Tahoma, Geneva, sans-serif',
  Georgia: 'Georgia, serif',
  Palatino: '"Palatino Linotype", "Book Antiqua", Palatino, serif',
  'Times New Roman': '"Times New Roman", Times, serif',
  'Arial Black': '"Arial Black", Gadget, sans-serif',
  'Comic Sans MS': '"Comic Sans MS", cursive, sans-serif',
  Impact: 'Impact, Charcoal, sans-serif',
  'Lucida Sans': '"Lucida Sans Unicode", "Lucida Grande", sans-serif',
  'Courier New': '"Courier New", Courier, monospace',
  'Lucida Console': '"Lucida Console", Monaco, monospace',
  Calibri: 'Calibri, sans-serif',
  Raleway: '"Raleway", sans-serif',
  Roboto: '"Roboto", sans-serif',
  Ubuntu: '"Ubuntu", sans-serif',
  Mukta: '"Mukta", sans-serif',
  'Open Sans': '"Open Sans", sans-serif',
  'Nunito Sans': '"Nunito Sans", sans-serif',
  Inter: '"Inter", sans-serif',
};

export const BUILT_IN_COMMUNITY_FONTS: Readonly<Record<string, string>> =
  Object.freeze(FONT_STACKS);

export const BUILT_IN_COMMUNITY_FONT_IDS: readonly string[] = Object.freeze(
  Object.keys(BUILT_IN_COMMUNITY_FONTS)
);

export interface CommunityPresetChat {
  fontId: string;
  fontSize: number;
  lineHeight: number;
  contrast: string;
  censorMode: string;
  showSystemMessages: boolean;
  lineLength: number;
}

export interface CommunityPresetCanvas {
  width: number;
  height: number;
  backgroundColor: string;
}

export interface CommunityPresetBlock {
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  composition: string;
  paddingX: number;
  paddingY: number;
}

export interface CommunityPresetAppearance {
  chat: CommunityPresetChat;
  canvas: CommunityPresetCanvas;
  blockLayout: CommunityPresetBlock[];
}

export interface CommunityPreset {
  schemaVersion: number;
  title: string;
  description: string;
  appearance: CommunityPresetAppearance;
}

const MAX_PRESET_BYTES = 32 * 1024;
const MAX_TREE_DEPTH = 6;
const MAX_BLOCKS = 8;
const UNSAFE_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);
const ROOT_KEYS: readonly string[] = ['schemaVersion', 'title', 'description', 'appearance'];
const APPEARANCE_KEYS: readonly string[] = ['chat', 'canvas', 'blockLayout'];
const CHAT_KEYS: readonly string[] = [
  'fontId',
  'fontSize',
  'lineHeight',
  'contrast',
  'censorMode',
  'showSystemMessages',
  'lineLength',
];
const CANVAS_KEYS: readonly string[] = ['width', 'height', 'backgroundColor'];
const BLOCK_KEYS: readonly string[] = [
  'x',
  'y',
  'width',
  'height',
  'opacity',
  'composition',
  'paddingX',
  'paddingY',
];
const CONTRASTS: ReadonlySet<string> = new Set(['off', 'low', 'medium', 'high']);
const CENSOR_MODES: ReadonlySet<string> = new Set(['remove', 'blur']);
const COMPOSITIONS: ReadonlySet<string> = new Set(['overlay', 'below', 'inset']);
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const UNSAFE_STRING_PATTERN =
  /(?:\b[a-z][a-z0-9+.-]*:(?:\/\/|[^\s])|(?:^|\s)\/\/[^\s]|\bwww\.|<\/?[a-z!][^>]*>|\burl\s*\(|@import\b|\bexpression\s*\()/i;
const ARRAY_INDEX_PATTERN = /^(?:0|[1-9]\d*)$/;

export class CommunityPresetError extends TypeError {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'CommunityPresetError';
    this.code = code;
  }
}

function fail(code: string, message: string): never {
  throw new CommunityPresetError(code, message);
}

function assertSafeTree(
  value: unknown,
  path = 'preset',
  depth = 0,
  ancestors = new Set<object>()
): void {
  if (depth > MAX_TREE_DEPTH) fail('preset_too_deep', `${path} exceeds maximum depth`);
  if (value === null || typeof value === 'boolean') return;

  if (typeof value === 'string') {
    if (UNSAFE_STRING_PATTERN.test(value)) {
      fail('preset_unsafe_string', `${path} contains URL or executable markup`);
    }
    return;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('preset_invalid_field', `${path} must be finite`);
    return;
  }

  if (typeof value !== 'object') fail('preset_unsafe_value', `${path} is not serializable`);
  if (ancestors.has(value)) fail('preset_unsafe_value', `${path} contains a cycle`);

  const prototype: unknown = Object.getPrototypeOf(value);
  if (Array.isArray(value)) {
    if (prototype !== Array.prototype) fail('preset_unsafe_value', `${path} is not a plain array`);
  } else if (prototype !== Object.prototype) {
    fail('preset_unsafe_value', `${path} is not a plain object`);
  }

  if (Object.getOwnPropertySymbols(value).length > 0) {
    fail('preset_unsafe_value', `${path} contains symbol keys`);
  }

  ancestors.add(value);
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (Array.isArray(value) && key === 'length') continue;
    if (Array.isArray(value) && !ARRAY_INDEX_PATTERN.test(key)) {
      fail('preset_unknown_field', `${path}.${key} is not allowed`);
    }
    if (UNSAFE_KEYS.has(key)) fail('preset_unsafe_value', `${path} contains unsafe key ${key}`);
    if (!descriptor.enumerable || 'get' in descriptor || 'set' in descriptor) {
      fail('preset_unsafe_value', `${path}.${key} must be a plain data property`);
    }
    assertSafeTree(descriptor.value, `${path}.${key}`, depth + 1, ancestors);
  }
  ancestors.delete(value);
}

function cloneSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T extends object>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child as object);
  }
  return value;
}

function assertExactKeys(
  value: unknown,
  expected: readonly string[],
  path: string
): asserts value is Record<string, unknown> {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail('preset_invalid_field', `${path} must be a plain object`);
  }
  const actual = Object.keys(value);
  const unknown = actual.find((key) => !expected.includes(key));
  const missing = expected.find((key) => !Object.prototype.hasOwnProperty.call(value, key));
  if (unknown) fail('preset_unknown_field', `${path}.${unknown} is not allowed`);
  if (missing) fail('preset_invalid_field', `${path}.${missing} is required`);
}

function assertString(
  value: unknown,
  path: string,
  maximumCodePoints: number,
  { allowEmpty = false }: { allowEmpty?: boolean } = {}
): string {
  if (typeof value !== 'string') fail('preset_invalid_field', `${path} must be a string`);
  const normalized = (value as string).trim();
  const length = Array.from(normalized).length;
  if ((!allowEmpty && length === 0) || length > maximumCodePoints) {
    fail('preset_invalid_field', `${path} length is invalid`);
  }
  return normalized;
}

function assertNumber(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
  { integer = false }: { integer?: boolean } = {}
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum ||
    (integer && !Number.isInteger(value))
  ) {
    fail('preset_invalid_field', `${path} is outside its allowed range`);
  }
  return value as number;
}

function assertEnum<T>(value: unknown, allowed: ReadonlySet<T>, path: string): T {
  if (!allowed.has(value as T)) fail('preset_invalid_field', `${path} is invalid`);
  return value as T;
}

function validateChat(value: unknown): void {
  assertExactKeys(value, CHAT_KEYS, 'preset.appearance.chat');
  if (!Object.prototype.hasOwnProperty.call(BUILT_IN_COMMUNITY_FONTS, value.fontId as string)) {
    fail('preset_invalid_field', 'preset.appearance.chat.fontId is not built in');
  }
  assertNumber(value.fontSize, 'preset.appearance.chat.fontSize', 8, 24);
  assertNumber(value.lineHeight, 'preset.appearance.chat.lineHeight', 0.8, 3);
  assertEnum(value.contrast, CONTRASTS, 'preset.appearance.chat.contrast');
  assertEnum(value.censorMode, CENSOR_MODES, 'preset.appearance.chat.censorMode');
  if (typeof value.showSystemMessages !== 'boolean') {
    fail('preset_invalid_field', 'preset.appearance.chat.showSystemMessages must be boolean');
  }
  assertNumber(value.lineLength, 'preset.appearance.chat.lineLength', 1, 300, { integer: true });
}

function validateCanvas(value: unknown): void {
  assertExactKeys(value, CANVAS_KEYS, 'preset.appearance.canvas');
  assertNumber(value.width, 'preset.appearance.canvas.width', 100, 7680, { integer: true });
  assertNumber(value.height, 'preset.appearance.canvas.height', 100, 4320, { integer: true });
  if (typeof value.backgroundColor !== 'string' || !COLOR_PATTERN.test(value.backgroundColor)) {
    fail('preset_invalid_field', 'preset.appearance.canvas.backgroundColor is invalid');
  }
}

function validateBlock(value: unknown, index: number): void {
  const path = `preset.appearance.blockLayout.${index}`;
  assertExactKeys(value, BLOCK_KEYS, path);
  assertNumber(value.x, `${path}.x`, -7680, 7680);
  assertNumber(value.y, `${path}.y`, -4320, 4320);
  assertNumber(value.width, `${path}.width`, 1, 7680);
  assertNumber(value.height, `${path}.height`, 1, 4320);
  assertNumber(value.opacity, `${path}.opacity`, 0, 1);
  assertEnum(value.composition, COMPOSITIONS, `${path}.composition`);
  assertNumber(value.paddingX, `${path}.paddingX`, 0, 7680);
  assertNumber(value.paddingY, `${path}.paddingY`, 0, 4320);
}

function assertEncodedSize(value: unknown): void {
  const bytes = new TextEncoder().encode(JSON.stringify(value)).byteLength;
  if (bytes > MAX_PRESET_BYTES) fail('preset_too_large', 'Preset exceeds 32 KiB');
}

function canonicalProject(project: unknown): Project {
  return deserializeProject(serializeProject(project));
}

function bounded(value: unknown, fallback: number, minimum: number, maximum: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

function fontIdForProject(font: unknown): string {
  if (Object.prototype.hasOwnProperty.call(BUILT_IN_COMMUNITY_FONTS, font as string)) {
    return font as string;
  }
  return BUILT_IN_COMMUNITY_FONT_IDS.find((id) => BUILT_IN_COMMUNITY_FONTS[id] === font) ?? 'Arial';
}

export function migrateCommunityPreset(input: unknown): Record<string, unknown> {
  assertSafeTree(input);
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    fail('preset_invalid_field', 'Preset root must be a plain object');
  }
  const record = input as Record<string, unknown>;
  if (
    !Object.prototype.hasOwnProperty.call(record, 'schemaVersion') ||
    typeof record.schemaVersion !== 'number' ||
    !Number.isInteger(record.schemaVersion) ||
    (record.schemaVersion as number) < 1
  ) {
    fail('preset_invalid_version', 'Preset version is invalid');
  }
  if ((record.schemaVersion as number) > COMMUNITY_PRESET_SCHEMA_VERSION) {
    fail(
      'preset_unsupported_version',
      `Unsupported preset version: ${record.schemaVersion as number}`
    );
  }
  const cloned = cloneSafe(record);
  const appearance = cloned.appearance as Record<string, unknown> | undefined;
  const chat = appearance?.chat as Record<string, unknown> | undefined;
  if (chat && !('lineLength' in chat)) {
    chat.lineLength = 77;
  }
  return cloned;
}

export function validateCommunityPreset(input: unknown): CommunityPreset {
  const preset = migrateCommunityPreset(input);
  assertExactKeys(preset, ROOT_KEYS, 'preset');
  const title = assertString(preset.title, 'preset.title', 60);
  const description = assertString(preset.description, 'preset.description', 240, {
    allowEmpty: true,
  });
  assertExactKeys(preset.appearance, APPEARANCE_KEYS, 'preset.appearance');
  const appearance = preset.appearance as Record<string, unknown>;
  validateChat(appearance.chat);
  validateCanvas(appearance.canvas);

  if (!Array.isArray(appearance.blockLayout)) {
    fail('preset_invalid_field', 'preset.appearance.blockLayout must be an array');
  }
  const blockLayout = appearance.blockLayout as unknown[];
  if (blockLayout.length > MAX_BLOCKS) {
    fail('preset_too_many_blocks', `Preset may contain at most ${MAX_BLOCKS} blocks`);
  }
  blockLayout.forEach(validateBlock);
  const first = blockLayout[0] as Record<string, unknown> | undefined;
  if (
    first &&
    blockLayout.some((block) => {
      const record = block as Record<string, unknown>;
      return (
        record.composition !== first.composition ||
        record.paddingX !== first.paddingX ||
        record.paddingY !== first.paddingY
      );
    })
  ) {
    fail('preset_inconsistent_layout', 'Block composition and padding must be shared');
  }

  preset.title = title;
  preset.description = description;
  assertEncodedSize(preset);
  return deepFreeze(preset) as unknown as CommunityPreset;
}

export function extractCommunityPreset(project: unknown, meta: unknown): CommunityPreset {
  const source = canonicalProject(project);
  const metaRecord = (meta ?? {}) as { title?: unknown; description?: unknown };
  const blocks = (source.blocks as unknown[]).map((block) => {
    const record = (block ?? {}) as Record<string, unknown>;
    const transform = (record.transform ?? {}) as Record<string, unknown>;
    return {
      x: bounded(transform.x, 0, -7680, 7680),
      y: bounded(transform.y, 0, -4320, 4320),
      width: bounded(transform.width, 640, 1, 7680),
      height: bounded(transform.height, 360, 1, 4320),
      opacity: bounded(record.opacity, 1, 0, 1),
      composition: COMPOSITIONS.has(source.canvas.composition)
        ? source.canvas.composition
        : 'overlay',
      paddingX: bounded(source.canvas.padding?.x, 0, 0, 7680),
      paddingY: bounded(source.canvas.padding?.y, 0, 0, 4320),
    };
  });

  return validateCommunityPreset({
    schemaVersion: COMMUNITY_PRESET_SCHEMA_VERSION,
    title: metaRecord.title,
    description: metaRecord.description ?? '',
    appearance: {
      chat: {
        fontId: fontIdForProject(source.chat.font),
        fontSize: source.chat.fontSize,
        lineHeight: source.chat.lineSpacing,
        contrast: source.chat.contrast,
        censorMode: source.chat.censorStyle,
        showSystemMessages: !source.chat.hideSystemMessages,
        lineLength: source.chat.lineLength ?? 77,
      },
      canvas: {
        width: source.canvas.width,
        height: source.canvas.height,
        backgroundColor: COLOR_PATTERN.test(source.canvas.background?.color)
          ? source.canvas.background.color
          : '#000000',
      },
      blockLayout: blocks,
    },
  });
}

export function createPresetProjectPatch(project: unknown, input: unknown): Project {
  const source = canonicalProject(project);
  const preset = validateCommunityPreset(input);
  const { chat, canvas, blockLayout } = preset.appearance;
  const sharedLayout = blockLayout[0];

  const candidate = {
    ...source,
    chat: {
      ...source.chat,
      font: BUILT_IN_COMMUNITY_FONTS[chat.fontId],
      fontSize: chat.fontSize,
      lineSpacing: chat.lineHeight,
      contrast: chat.contrast,
      censorStyle: chat.censorMode,
      hideSystemMessages: !chat.showSystemMessages,
      lineLength: chat.lineLength ?? source.chat.lineLength ?? 77,
    },
    canvas: {
      ...source.canvas,
      width: canvas.width,
      height: canvas.height,
      ...(sharedLayout
        ? {
            composition: sharedLayout.composition,
            padding: { x: sharedLayout.paddingX, y: sharedLayout.paddingY },
          }
        : {}),
      background: {
        ...source.canvas.background,
        type: 'solid',
        color: canvas.backgroundColor,
      },
    },
    blocks: (source.blocks as unknown[]).map((block, index) => {
      const layout = blockLayout[index];
      if (!layout) return block;
      const record = (block ?? {}) as Record<string, unknown>;
      const transform = (record.transform ?? {}) as Record<string, unknown>;
      return {
        ...record,
        opacity: layout.opacity,
        transform: {
          ...transform,
          x: layout.x,
          y: layout.y,
          width: layout.width,
          height: layout.height,
        },
      };
    }),
  };

  return canonicalProject(candidate);
}

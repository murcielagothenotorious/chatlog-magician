export const PROJECT_SCHEMA_VERSION = 2;

export interface ProjectMetadata {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatBackground {
  enabled: boolean;
  color: string;
  opacity: number;
}

export interface ChatSettings {
  input: string;
  fontSize: number;
  lineLength: number;
  lineSpacing: number;
  characterNames: string[];
  font: string;
  background: ChatBackground;
  namesEnabled: boolean;
  censorStyle: string;
  contrast: string;
  italicParsing: boolean;
  hideSystemMessages: boolean;
  colorAnchors: unknown[];
}

export interface CanvasBackground {
  type: string;
  color: string;
  assetId: string | null;
  blur: number;
  grain: number;
}

export interface CanvasPadding {
  x: number;
  y: number;
}

export interface CanvasSettings {
  width: number;
  height: number;
  background: CanvasBackground;
  fitMode: string;
  composition: string;
  padding: CanvasPadding;
}

export interface FontMetadata {
  id: string;
  family: string;
  name: string;
  type: string;
  size: number;
}

export interface RedactionBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
}

export interface ExportOptions {
  format: string;
  jpegQuality: number;
  ppi: number;
}

export interface Project {
  schemaVersion: number;
  metadata: ProjectMetadata;
  chat: ChatSettings;
  canvas: CanvasSettings;
  layers: unknown[];
  blocks: unknown[];
  redactionBoxes: RedactionBox[];
  fonts: FontMetadata[];
  export: ExportOptions;
}

export type MutableProject = Record<string, unknown>;

const DEFAULT_PROJECT: Project = {
  schemaVersion: PROJECT_SCHEMA_VERSION,
  metadata: { id: '', title: 'Adsız Proje', createdAt: '', updatedAt: '' },
  chat: {
    input: '',
    fontSize: 12,
    lineLength: 77,
    lineSpacing: 1.3,
    characterNames: [],
    font: 'Arial',
    background: { enabled: false, color: '#000000', opacity: 1 },
    namesEnabled: true,
    censorStyle: 'remove',
    contrast: 'off',
    italicParsing: true,
    hideSystemMessages: true,
    colorAnchors: [],
  },
  canvas: {
    width: 600,
    height: 600,
    background: { type: 'transparent', color: '#000000', assetId: null, blur: 0, grain: 0 },
    fitMode: 'fit',
    composition: 'overlay',
    padding: { x: 0, y: 0 },
  },
  layers: [],
  blocks: [],
  redactionBoxes: [],
  fonts: [],
  export: { format: 'png', jpegQuality: 0.8, ppi: 96 },
};

const FIT_MODES: ReadonlySet<string> = new Set(['fit', 'fill', 'stretch']);
const COMPOSITIONS: ReadonlySet<string> = new Set(['overlay', 'below', 'inset']);
const EXPORT_FORMATS: ReadonlySet<string> = new Set(['png', 'jpeg']);
const FONT_TYPES: ReadonlySet<string> = new Set([
  'font/woff2',
  'font/woff',
  'font/ttf',
  'font/otf',
]);
const OPAQUE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const MAX_FONT_BYTES = 5 * 1024 * 1024;
const TRANSIENT_SCENE_KEY_PATTERN = /(html|markup|node|element)/i;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function boundedNumber(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
  integer = false
): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  const normalized = integer ? Math.round(number) : number;
  return Math.min(maximum, Math.max(minimum, normalized));
}

function oneOf<T>(value: unknown, allowed: ReadonlySet<T>, fallback: T): T {
  return allowed.has(value as T) ? (value as T) : fallback;
}

function createId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `project-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function deepClone<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeFontMetadata(value: unknown): FontMetadata | null {
  const source = asRecord(value);
  if (
    !OPAQUE_ID_PATTERN.test(String(source.id ?? '')) ||
    typeof source.family !== 'string' ||
    source.family.trim() === '' ||
    typeof source.name !== 'string' ||
    source.name.trim() === '' ||
    typeof source.type !== 'string' ||
    !FONT_TYPES.has(source.type) ||
    typeof source.size !== 'number' ||
    !Number.isFinite(source.size) ||
    source.size < 0 ||
    source.size > MAX_FONT_BYTES
  ) {
    return null;
  }

  return {
    id: source.id as string,
    family: (source.family as string).trim(),
    name: (source.name as string).trim(),
    type: source.type as string,
    size: source.size as number,
  };
}

function normalizeRedactionBox(value: unknown): RedactionBox {
  const source = asRecord(value);
  return {
    id: typeof source.id === 'string' && source.id ? source.id : createId(),
    x: boundedNumber(source.x, 0, -10000, 10000),
    y: boundedNumber(source.y, 0, -10000, 10000),
    width: boundedNumber(source.width, 100, 1, 10000),
    height: boundedNumber(source.height, 40, 1, 10000),
    visible: source.visible !== false,
  };
}

function isDomLike(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.nodeType === 'number' &&
    (typeof record.nodeName === 'string' ||
      typeof record.ownerDocument === 'object' ||
      typeof record.cloneNode === 'function')
  );
}

function assertProjectVersion(source: Record<string, unknown>): void {
  if (!Object.prototype.hasOwnProperty.call(source, 'schemaVersion')) return;

  const inputVersion: unknown = source.schemaVersion;
  if (
    typeof inputVersion !== 'number' ||
    !Number.isFinite(inputVersion) ||
    !Number.isInteger(inputVersion) ||
    inputVersion < 1
  ) {
    throw new Error('Invalid project version');
  }
  if (inputVersion > PROJECT_SCHEMA_VERSION) {
    throw new Error(`Unsupported project version: ${inputVersion}`);
  }
}

function assertProjectRoot(value: unknown): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Project root must be a plain object');
  }

  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('Project root must be a plain object');
  }
}

function assertSerializable(value: unknown, path = 'project', seen = new Set<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;

  if (typeof value === 'number') {
    if (Number.isFinite(value)) return;
    throw new TypeError(`Project must contain only serializable data (${path})`);
  }

  if (typeof value !== 'object') {
    throw new TypeError(`Project must contain only serializable data (${path})`);
  }

  if (isDomLike(value)) {
    throw new TypeError(`Project cannot contain a DOM-like object (${path})`);
  }
  if (seen.has(value)) {
    throw new TypeError(`Project must contain only serializable data (${path})`);
  }

  const prototype: unknown = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`Project must contain only serializable data (${path})`);
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new TypeError(`Project must contain only serializable data (${path})`);
  }

  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    assertSerializable(child, `${path}.${key}`, seen);
  }
  seen.delete(value);
}

function assertPersistentProjectData(value: unknown, path: string[] = []): void {
  if (typeof value === 'string') {
    const isChatInput = path.length === 2 && path[0] === 'chat' && path[1] === 'input';
    if (!isChatInput && value.trim().toLowerCase().startsWith('blob:')) {
      throw new TypeError(`Project cannot contain a blob URL (${path.join('.')})`);
    }
    return;
  }

  if (value === null || typeof value !== 'object') return;

  for (const [key, child] of Object.entries(value)) {
    if (TRANSIENT_SCENE_KEY_PATTERN.test(key)) {
      throw new TypeError(
        `Project cannot contain transient scene data (${[...path, key].join('.')})`
      );
    }
    assertPersistentProjectData(child, [...path, key]);
  }
}

function assertPersistentProject(value: unknown): void {
  assertProjectRoot(value);
  assertProjectVersion(asRecord(value));
  assertSerializable(value);
  assertPersistentProjectData(value);
}

const MIGRATIONS: Record<number, (project: MutableProject) => MutableProject> = {
  1(project) {
    return {
      ...project,
      schemaVersion: 2,
      fonts: Array.isArray(project.fonts)
        ? project.fonts
            .map(normalizeFontMetadata)
            .filter((font): font is FontMetadata => font !== null)
        : [],
    };
  },
};

export function migrateProject(input: unknown): MutableProject {
  assertProjectRoot(input);
  const source: MutableProject = Object.prototype.hasOwnProperty.call(input, 'schemaVersion')
    ? input
    : { ...input, schemaVersion: 1 };
  assertProjectVersion(source);

  let project: MutableProject = deepClone(source);
  if (!Object.prototype.hasOwnProperty.call(input, 'schemaVersion')) {
    project.schemaVersion = 1;
  }

  for (;;) {
    const version: unknown = project.schemaVersion;
    if (typeof version !== 'number' || version >= PROJECT_SCHEMA_VERSION) break;
    const migrate = MIGRATIONS[version];
    if (typeof migrate !== 'function') {
      throw new Error(`Unsupported project version: ${project.schemaVersion}`);
    }
    project = migrate(project);
  }

  return project;
}

export function normalizeProject(input: unknown = {}): Project {
  const source = migrateProject(asRecord(input));

  const metadata = asRecord(source.metadata);
  const chat = asRecord(source.chat);
  const chatBackground = asRecord(chat.background);
  const canvas = asRecord(source.canvas);
  const canvasBackground = asRecord(canvas.background);
  const padding = asRecord(canvas.padding);
  const exportOptions = asRecord(source.export);
  const timestamp = new Date().toISOString();

  const format = exportOptions.format === 'jpg' ? 'jpeg' : exportOptions.format;
  const project = {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    metadata: {
      ...DEFAULT_PROJECT.metadata,
      ...(metadata as Partial<ProjectMetadata>),
      id: (metadata.id as string | undefined) || createId(),
      createdAt: (metadata.createdAt as string | undefined) || timestamp,
      updatedAt:
        (metadata.updatedAt as string | undefined) ||
        (metadata.createdAt as string | undefined) ||
        timestamp,
    },
    chat: {
      ...DEFAULT_PROJECT.chat,
      ...(chat as Partial<ChatSettings>),
      fontSize: boundedNumber(chat.fontSize, DEFAULT_PROJECT.chat.fontSize, 8, 24),
      lineLength: boundedNumber(chat.lineLength, DEFAULT_PROJECT.chat.lineLength, 1, 1000, true),
      lineSpacing: boundedNumber(chat.lineSpacing, DEFAULT_PROJECT.chat.lineSpacing, 0.8, 3),
      characterNames: Array.isArray(chat.characterNames) ? chat.characterNames : [],
      colorAnchors: Array.isArray(chat.colorAnchors) ? chat.colorAnchors : [],
      background: {
        ...DEFAULT_PROJECT.chat.background,
        ...(chatBackground as Partial<ChatBackground>),
        opacity: boundedNumber(
          chatBackground.opacity,
          DEFAULT_PROJECT.chat.background.opacity,
          0,
          1
        ),
      },
    },
    canvas: {
      ...DEFAULT_PROJECT.canvas,
      ...(canvas as Partial<CanvasSettings>),
      width: boundedNumber(canvas.width, DEFAULT_PROJECT.canvas.width, 100, 7680, true),
      height: boundedNumber(canvas.height, DEFAULT_PROJECT.canvas.height, 100, 4320, true),
      background: {
        ...DEFAULT_PROJECT.canvas.background,
        ...(canvasBackground as Partial<CanvasBackground>),
        blur: boundedNumber(canvasBackground.blur, 0, 0, 20),
        grain: boundedNumber(canvasBackground.grain, 0, 0, 100),
      },
      fitMode: oneOf(canvas.fitMode, FIT_MODES, DEFAULT_PROJECT.canvas.fitMode),
      composition: oneOf(canvas.composition, COMPOSITIONS, DEFAULT_PROJECT.canvas.composition),
      padding: {
        x: boundedNumber(padding.x, DEFAULT_PROJECT.canvas.padding.x, 0, 7680),
        y: boundedNumber(padding.y, DEFAULT_PROJECT.canvas.padding.y, 0, 4320),
      },
    },
    layers: Array.isArray(source.layers) ? source.layers : [],
    blocks: Array.isArray(source.blocks) ? source.blocks : [],
    redactionBoxes: Array.isArray(source.redactionBoxes)
      ? source.redactionBoxes.map(normalizeRedactionBox).filter(Boolean)
      : [],
    fonts: Array.isArray(source.fonts)
      ? source.fonts
          .map(normalizeFontMetadata)
          .filter((font): font is FontMetadata => font !== null)
      : [],
    export: {
      ...DEFAULT_PROJECT.export,
      ...(exportOptions as Partial<ExportOptions>),
      format: oneOf(format, EXPORT_FORMATS, DEFAULT_PROJECT.export.format),
      jpegQuality: boundedNumber(
        exportOptions.jpegQuality,
        DEFAULT_PROJECT.export.jpegQuality,
        0.1,
        1
      ),
      ppi: boundedNumber(exportOptions.ppi, DEFAULT_PROJECT.export.ppi, 72, 600, true),
    },
  };

  return deepClone(project) as Project;
}

export function createProject(overrides: unknown = {}): Project {
  return normalizeProject(overrides);
}

export function serializeProject(project: unknown): string {
  assertPersistentProject(project);
  return JSON.stringify(normalizeProject(project));
}

export function deserializeProject(json: string): Project {
  const project: unknown = JSON.parse(json);
  assertPersistentProject(project);
  return normalizeProject(project);
}

import { deserializeProject, serializeProject, type ExportOptions } from './project-model.js';

export interface RenderPlan {
  canvas: Record<string, unknown>;
  layers: unknown[];
  blocks: unknown[];
  redactionBoxes: unknown[];
  export: ExportOptions;
}

const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: 'png',
  jpegQuality: 0.8,
  ppi: 96,
};

const EXPORT_FORMATS: ReadonlySet<string> = new Set(['png', 'jpeg']);

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

function normalizedFormat(format: unknown): string {
  const canonical = format === 'jpg' ? 'jpeg' : format;
  return EXPORT_FORMATS.has(canonical as string)
    ? (canonical as string)
    : DEFAULT_EXPORT_OPTIONS.format;
}

function zIndexOf(item: unknown): number {
  const record = (item ?? {}) as Record<string, unknown>;
  const zIndex = Number(record.zIndex);
  return Number.isFinite(zIndex) ? zIndex : 0;
}

function visibleInZOrder(items: unknown): unknown[] {
  if (!Array.isArray(items)) return [];

  return items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => ((item ?? {}) as Record<string, unknown>).visible !== false)
    .sort((left, right) => zIndexOf(left.item) - zIndexOf(right.item) || left.index - right.index)
    .map(({ item }) => item);
}

function deepClone<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

export function normalizeExportOptions(exportState: unknown = {}): ExportOptions {
  const source = asRecord(exportState);
  return {
    format: normalizedFormat(source.format),
    jpegQuality: boundedNumber(source.jpegQuality, DEFAULT_EXPORT_OPTIONS.jpegQuality, 0.1, 1),
    ppi: boundedNumber(source.ppi, DEFAULT_EXPORT_OPTIONS.ppi, 72, 600, true),
  };
}

export function mimeTypeForFormat(format: unknown): string {
  return normalizedFormat(format) === 'jpeg' ? 'image/jpeg' : 'image/png';
}

export function extensionForFormat(format: unknown): string {
  return normalizedFormat(format) === 'jpeg' ? 'jpg' : 'png';
}

export function createRenderPlan(project: unknown = {}): RenderPlan {
  const source = deserializeProject(serializeProject(project));
  return deepClone({
    canvas: asRecord(source.canvas),
    layers: visibleInZOrder(source.layers),
    blocks: visibleInZOrder(source.blocks),
    redactionBoxes: Array.isArray(source.redactionBoxes) ? source.redactionBoxes : [],
    export: normalizeExportOptions(source.export),
  });
}

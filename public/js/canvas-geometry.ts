export interface Dimensions {
  width: number;
  height: number;
}

export interface Rect extends Dimensions {
  x: number;
  y: number;
}

const CANVAS_WIDTH_MIN = 100;
const CANVAS_WIDTH_MAX = 7680;
const CANVAS_HEIGHT_MIN = 100;
const CANVAS_HEIGHT_MAX = 4320;
const DEFAULT_CANVAS_WIDTH = 600;
const DEFAULT_CANVAS_HEIGHT = 600;
const ROUNDING_FACTOR = 1_000_000;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number): number {
  const rounded = Math.round(value * ROUNDING_FACTOR) / ROUNDING_FACTOR;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function finiteOrDefault(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function assertPositiveDimensions(size: unknown, label: string): asserts size is Dimensions {
  const record = (size ?? {}) as Partial<Dimensions>;
  const width: unknown = record.width;
  const height: unknown = record.height;
  if (
    typeof width !== 'number' ||
    !Number.isFinite(width) ||
    typeof height !== 'number' ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new TypeError(`${label} dimensions must be positive finite numbers`);
  }
}

export function normalizeCanvasSize(size: unknown = {}): Dimensions {
  const record = size as { width?: unknown; height?: unknown };
  return {
    width: round(
      clamp(finiteOrDefault(record.width, DEFAULT_CANVAS_WIDTH), CANVAS_WIDTH_MIN, CANVAS_WIDTH_MAX)
    ),
    height: round(
      clamp(
        finiteOrDefault(record.height, DEFAULT_CANVAS_HEIGHT),
        CANVAS_HEIGHT_MIN,
        CANVAS_HEIGHT_MAX
      )
    ),
  };
}

export function calculateFitRect(source: unknown, destination: unknown, mode: unknown): Rect {
  assertPositiveDimensions(source, 'Source');
  assertPositiveDimensions(destination, 'Destination');

  if (mode === 'stretch') {
    return {
      x: 0,
      y: 0,
      width: round(destination.width),
      height: round(destination.height),
    };
  }

  const horizontalScale = destination.width / source.width;
  const verticalScale = destination.height / source.height;
  const scale =
    mode === 'fill'
      ? Math.max(horizontalScale, verticalScale)
      : Math.min(horizontalScale, verticalScale);
  const width = source.width * scale;
  const height = source.height * scale;

  return {
    x: round((destination.width - width) / 2),
    y: round((destination.height - height) / 2),
    width: round(width),
    height: round(height),
  };
}

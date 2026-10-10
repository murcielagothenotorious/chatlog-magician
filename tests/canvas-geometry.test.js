import { describe, expect, it } from 'vitest';
import { calculateFitRect, normalizeCanvasSize } from '../public/js/canvas-geometry.ts';

describe('calculateFitRect', () => {
  it('letterboxes fit mode', () => {
    expect(
      calculateFitRect({ width: 100, height: 100 }, { width: 200, height: 100 }, 'fit')
    ).toEqual({ x: 50, y: 0, width: 100, height: 100 });
  });

  it('crops fill mode around the centre', () => {
    expect(
      calculateFitRect({ width: 100, height: 100 }, { width: 200, height: 100 }, 'fill')
    ).toEqual({ x: 0, y: -50, width: 200, height: 200 });
  });

  it('stretches exactly to destination', () => {
    expect(
      calculateFitRect({ width: 100, height: 50 }, { width: 300, height: 200 }, 'stretch')
    ).toEqual({ x: 0, y: 0, width: 300, height: 200 });
  });

  it('rounds proportional rectangles to six decimal places', () => {
    expect(calculateFitRect({ width: 3, height: 2 }, { width: 10, height: 10 }, 'fit')).toEqual({
      x: 0,
      y: 1.666667,
      width: 10,
      height: 6.666667,
    });
  });

  it.each([
    [{ width: Number.POSITIVE_INFINITY, height: 100 }],
    [{ width: 100, height: Number.NaN }],
    [{ width: 0, height: 100 }],
    [{ width: 100, height: -1 }],
  ])('rejects invalid source dimensions', (source) => {
    expect(() => calculateFitRect(source, { width: 200, height: 100 }, 'fit')).toThrow(/source/i);
  });

  it.each([
    [{ width: Number.POSITIVE_INFINITY, height: 100 }],
    [{ width: 100, height: Number.NaN }],
    [{ width: 0, height: 100 }],
    [{ width: 100, height: -1 }],
  ])('rejects invalid destination dimensions', (destination) => {
    expect(() => calculateFitRect({ width: 100, height: 50 }, destination, 'fit')).toThrow(
      /destination/i
    );
  });
});

describe('normalizeCanvasSize', () => {
  it('uses finite defaults for missing and non-finite dimensions', () => {
    expect(normalizeCanvasSize()).toEqual({ width: 600, height: 600 });
    expect(normalizeCanvasSize({ width: Number.NaN, height: Number.POSITIVE_INFINITY })).toEqual({
      width: 600,
      height: 600,
    });
    expect(normalizeCanvasSize({ width: 640 })).toEqual({ width: 640, height: 600 });
  });

  it('clamps dimensions to the canvas bounds', () => {
    expect(normalizeCanvasSize({ width: 2, height: 9000 })).toEqual({
      width: 100,
      height: 4320,
    });
  });

  it('preserves dimensions inside the canvas bounds', () => {
    expect(normalizeCanvasSize({ width: 3840, height: 2160 })).toEqual({
      width: 3840,
      height: 2160,
    });
  });

  it('clamps width and height independently at both extremes', () => {
    expect(normalizeCanvasSize({ width: 8000, height: 50 })).toEqual({
      width: 7680,
      height: 100,
    });
  });
});

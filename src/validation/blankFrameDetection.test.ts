import { describe, expect, test } from 'vitest';
import { isProbablyBlankFrame } from './blankFrameDetection';

function makeRgba(width: number, height: number, fn: (x: number, y: number) => [number, number, number, number]): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = fn(x, y);
      const i = (y * width + x) * 4;
      out[i + 0] = r;
      out[i + 1] = g;
      out[i + 2] = b;
      out[i + 3] = a;
    }
  }
  return out;
}

describe('isProbablyBlankFrame', () => {
  test('treats fully transparent frames as blank', () => {
    const rgba = makeRgba(8, 8, () => [0, 0, 0, 0]);
    expect(isProbablyBlankFrame(rgba)).toBe(true);
  });

  test('treats uniform near-black frames as blank', () => {
    const rgba = makeRgba(8, 8, () => [0, 0, 0, 255]);
    expect(isProbablyBlankFrame(rgba)).toBe(true);
  });

  test('does not treat dark but non-uniform frames as blank', () => {
    const rgba = makeRgba(8, 8, (x, y) => {
      const v = (x + y) % 2 === 0 ? 0 : 7;
      return [v, v, v, 255];
    });
    expect(isProbablyBlankFrame(rgba)).toBe(false);
  });

  test('does not treat clearly non-black frames as blank', () => {
    const rgba = makeRgba(8, 8, (x, y) => [x * 20, y * 20, 30, 255]);
    expect(isProbablyBlankFrame(rgba)).toBe(false);
  });
});


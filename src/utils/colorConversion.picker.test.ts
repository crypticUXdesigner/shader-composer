import { describe, expect, it } from 'vitest';
import {
  hsvSrgbToOklch,
  hsvToSrgb,
  oklchToCssRgb,
  oklchToHsvForPicker,
  oklchToLinearRgb,
  linearToSrgb,
  srgbToHsv,
} from './colorConversion';

/** arrangement-notes playhead defaults */
const PLAYHEAD = { l: 0.9212694441951411, c: 0.07333640227297007, h: 92.75176335649348 };

/** arrangement-notes background defaults */
const BACKGROUND = { l: 0.3427020622266527, c: 0.03431487471655648, h: 266.50628048763645 };

function oklchToSrgbTriplet(l: number, c: number, h: number) {
  const rgb = oklchToLinearRgb(l, c, h);
  return {
    r: linearToSrgb(rgb.r),
    g: linearToSrgb(rgb.g),
    b: linearToSrgb(rgb.b),
  };
}

describe('colorConversion sRGB HSV picker round-trip', () => {
  it('srgbToHsv and hsvToSrgb are inverses on channel space', () => {
    const samples = [
      { r: 0.5, g: 0.5, b: 0.5 },
      { r: 0.19, g: 0.22, b: 0.29 },
      { r: 0.96, g: 0.9, b: 0.68 },
    ];
    for (const srgb of samples) {
      const hsv = srgbToHsv(srgb.r, srgb.g, srgb.b);
      const back = hsvToSrgb(hsv.h, hsv.s, hsv.v);
      expect(back.r).toBeCloseTo(srgb.r, 5);
      expect(back.g).toBeCloseTo(srgb.g, 5);
      expect(back.b).toBeCloseTo(srgb.b, 5);
    }
  });

  it('oklchToHsvForPicker + hsvToSrgb reproduces node swatch sRGB', () => {
    for (const { l, c, h } of [PLAYHEAD, BACKGROUND]) {
      const expected = oklchToSrgbTriplet(l, c, h);
      const hsv = oklchToHsvForPicker(l, c, h);
      const picked = hsvToSrgb(hsv.h, hsv.s, hsv.v);
      expect(picked.r).toBeCloseTo(expected.r, 5);
      expect(picked.g).toBeCloseTo(expected.g, 5);
      expect(picked.b).toBeCloseTo(expected.b, 5);
    }
  });

  it('picker apply preserves CSS rgb for arrangement-notes colors', () => {
    for (const { l, c, h } of [PLAYHEAD, BACKGROUND]) {
      const before = oklchToCssRgb(l, c, h);
      const hsv = oklchToHsvForPicker(l, c, h);
      const applied = hsvSrgbToOklch(hsv.h, hsv.s, hsv.v);
      const after = oklchToCssRgb(applied.l, applied.c, applied.h);
      expect(after).toBe(before);
    }
  });

  it('re-applying unchanged HSV does not shift CSS rgb (first click on pad)', () => {
    for (const { l, c, h } of [PLAYHEAD, BACKGROUND]) {
      const before = oklchToCssRgb(l, c, h);
      const hsv = oklchToHsvForPicker(l, c, h);
      const applied = hsvSrgbToOklch(hsv.h, hsv.s, hsv.v);
      const after = oklchToCssRgb(applied.l, applied.c, applied.h);
      expect(after).toBe(before);
    }
  });
});

import { describe, it, expect } from 'vitest';
import {
  getLutPresetCount,
  getLutPresetLabel,
  getLutPresetRgbFlat,
  LUT_RGB_FLOATS_PER_PRESET,
} from './lutPresets';
import { applyLutT, applyIntensity, sampleLut } from './lutSampling';
import {
  sampleThreeStopOklch,
  DEFAULT_COLOR_GRADIENT_STOPS,
  type OklchStop,
} from './threeStopOklch';
import { applyColorGradientValue } from './colorGradientValue';
import { emitLutGlslFunctions, emitThreeStopGlslFunctions } from './emitGlsl';
import { emitLutWgslFunctions, emitThreeStopWgslFunctions } from './emitWgsl';
import { oklchToRgb } from './oklchToRgb';

describe('lutPresets', () => {
  it('registers 60 presets with stable ids', () => {
    expect(getLutPresetCount()).toBe(60);
    expect(getLutPresetLabel(0)).toBe('Viridis');
    expect(getLutPresetLabel('turbo')).toBe('Turbo');
    expect(getLutPresetLabel('night')).toBe('Night');
    expect(getLutPresetLabel('era-80s-synth')).toBe('80s Synthwave');
    expect(getLutPresetLabel('teal-orange')).toBe('Teal & Orange');
  });

  it('each preset table has 256×3 floats in [0,1]', () => {
    for (let i = 0; i < getLutPresetCount(); i++) {
      const table = getLutPresetRgbFlat(i);
      expect(table.length).toBe(LUT_RGB_FLOATS_PER_PRESET);
      for (const v of table) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
        expect(Number.isNaN(v)).toBe(false);
      }
    }
  });
});

describe('lutSampling', () => {
  it('applyLutT reverses and applies contrast around pivot 0.5', () => {
    expect(applyLutT(0.5, 0, 1, 1)).toBeCloseTo(0.5, 5);
    expect(applyLutT(0.25, 1, 1, 1)).toBeCloseTo(0.75, 5);
    expect(applyLutT(0.5, 0, 1, 2)).toBeCloseTo(0.5, 5);
    expect(applyLutT(0.75, 0, 1, 2)).toBeGreaterThan(0.75);
  });

  it('applyIntensity scales and clamps RGB', () => {
    expect(applyIntensity([0.5, 0.5, 0.5], 2)).toEqual([1, 1, 1]);
    expect(applyIntensity([0.4, 0.2, 0.1], 0.5)).toEqual([0.2, 0.1, 0.05]);
  });

  it('sampleLut returns finite RGB for random t', () => {
    for (let n = 0; n < 50; n++) {
      const t = Math.random();
      const preset = Math.floor(Math.random() * getLutPresetCount());
      const [r, g, b] = sampleLut(preset, t);
      expect(Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)).toBe(true);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(1);
    }
  });
});

describe('colorGradientValue', () => {
  it('passthrough preserves soft masks when softness is zero', () => {
    const mask = [0, 0.01, 0.1, 0.25, 0.5, 0.75, 1];
    for (const m of mask) {
      expect(applyColorGradientValue(m, 1, 1, 0)).toBeCloseTo(m, 5);
    }
  });

  it('does not flatten mid-range values like the old smoothstep remap', () => {
    const oldStyle = (v: number) => {
      const edge = 0.02;
      const t = Math.max(0, Math.min(1, (v - 0) / (edge - 0)));
      const knee = t * t * (3 - 2 * t);
      return knee;
    };
    expect(applyColorGradientValue(0.5, 1, 1, 0.02)).toBeCloseTo(0.5, 3);
    expect(oldStyle(0.5)).toBeCloseTo(1, 3);
  });

  it('softness only eases the black end', () => {
    expect(applyColorGradientValue(0.01, 1, 1, 0.02)).toBeLessThan(0.01);
    expect(applyColorGradientValue(0.5, 1, 1, 0.02)).toBeCloseTo(0.5, 3);
    expect(applyColorGradientValue(1, 1, 1, 0.02)).toBeCloseTo(1, 5);
  });
});

describe('threeStopOklch', () => {
  const stops: [OklchStop, OklchStop, OklchStop] = [
    { l: 0.1, c: 0.05, h: 0, t: 0 },
    { l: 0.5, c: 0.1, h: 120, t: 0.5 },
    { l: 0.9, c: 0.05, h: 240, t: 1 },
  ];

  it('hits stop endpoints at t0 and t2', () => {
    const at0 = sampleThreeStopOklch(stops, 0);
    const at2 = sampleThreeStopOklch(stops, 1);
    expect(at0).toEqual(oklchToRgb(0.1, 0.05, 0));
    expect(at2).toEqual(oklchToRgb(0.9, 0.05, 240));
  });

  it('is near middle stop at t1', () => {
    const mid = sampleThreeStopOklch(stops, 0.5);
    expect(mid).toEqual(oklchToRgb(0.5, 0.1, 120));
  });

  it('is monotonic in L when stops increase in L', () => {
    const mono: [OklchStop, OklchStop, OklchStop] = [
      { l: 0.1, c: 0.05, h: 200, t: 0 },
      { l: 0.4, c: 0.08, h: 210, t: 0.45 },
      { l: 0.85, c: 0.06, h: 220, t: 1 },
    ];
    let prevL = -1;
    for (let i = 0; i <= 32; i++) {
      const t = i / 32;
      const [l] = sampleThreeStopOklch(mono, t);
      expect(l).toBeGreaterThanOrEqual(prevL - 1e-4);
      prevL = l;
    }
  });

  it('default gradient stops are ordered', () => {
    const [a, b, c] = DEFAULT_COLOR_GRADIENT_STOPS;
    expect(a.t).toBeLessThanOrEqual(b.t);
    expect(b.t).toBeLessThanOrEqual(c.t);
  });
});

describe('shader emitters', () => {
  it('GLSL LUT emitter includes merged atlas and preset dispatcher', () => {
    const glsl = emitLutGlslFunctions();
    expect(glsl).toContain('vec3 cr_sample_lut(int preset, float t)');
    expect(glsl).toContain('cr_apply_lut_t');
    expect(glsl).toContain('0.266667'); // viridis first sample
    expect(glsl).toContain(`const float cr_lut_tables[${getLutPresetCount() * LUT_RGB_FLOATS_PER_PRESET}]`);
    const turboStart = getLutPresetRgbFlat(5)[0];
    expect(glsl).toContain(turboStart.toFixed(6));
  });

  it('WGSL LUT emitter includes merged atlas and preset dispatcher', () => {
    const wgsl = emitLutWgslFunctions();
    expect(wgsl).toContain('fn cr_sample_lut(preset: i32, t: f32)');
    expect(wgsl).toContain(
      `const cr_lut_tables: array<f32, ${getLutPresetCount() * LUT_RGB_FLOATS_PER_PRESET}>`
    );
    const turboStart = getLutPresetRgbFlat(5)[0];
    expect(wgsl).toContain(turboStart.toFixed(6));
  });

  it('single-preset GLSL emitter bakes one table', () => {
    const glsl = emitLutGlslFunctions(0);
    expect(glsl).toContain('vec3 cr_sample_lut_p0(float t)');
    expect(glsl).toContain('const float cr_lut_tables_p0[768]');
    expect(glsl).not.toContain('cr_sample_lut(int preset');
  });

  it('3-stop emitters include oklch conversion', () => {
    const glsl = emitThreeStopGlslFunctions();
    const wgsl = emitThreeStopWgslFunctions();
    expect(glsl).toContain('cr_sample_three_stop_oklch');
    expect(wgsl).toContain('fn cr_sample_three_stop_oklch');
    expect(glsl).toContain('cr_apply_color_gradient_value');
    expect(wgsl).toContain('fn cr_apply_color_gradient_value');
    expect(glsl).toContain('3963377774');
    expect(wgsl).toContain('3963377774');
  });
});

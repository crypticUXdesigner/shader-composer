import { describe, expect, it } from 'vitest';
import { BLUR_GAUSSIAN_SEPARABLE_BLUR_WGSL, BLUR_GAUSSIAN_SEPARABLE_PRESENT_WGSL } from '../../shaders/compilation/blurGaussianSeparableV1Wgsl';

describe('blur.gaussian-separable.v1 WGSL constants', () => {
  it('exposes both blur entry points (horizontal + vertical) and a present fs entry point', () => {
    expect(BLUR_GAUSSIAN_SEPARABLE_BLUR_WGSL).toContain('fn fsBlurH(');
    expect(BLUR_GAUSSIAN_SEPARABLE_BLUR_WGSL).toContain('fn fsBlurV(');
    expect(BLUR_GAUSSIAN_SEPARABLE_PRESENT_WGSL).toContain('fn fs(');
  });

  it('declares the four blur bindings: globals, params, texture, sampler', () => {
    const w = BLUR_GAUSSIAN_SEPARABLE_BLUR_WGSL;
    expect(w).toContain('@group(0) @binding(0) var<uniform> globals');
    expect(w).toContain('@group(0) @binding(1) var<storage, read> params');
    expect(w).toContain('@group(0) @binding(2) var blurInputTex');
    expect(w).toContain('@group(0) @binding(3) var blurInputSamp');
  });

  it('declares the two present bindings (texture + sampler)', () => {
    const w = BLUR_GAUSSIAN_SEPARABLE_PRESENT_WGSL;
    expect(w).toContain('@group(0) @binding(0) var presentTex');
    expect(w).toContain('@group(0) @binding(1) var presentSamp');
  });

  it('uses a bounded loop tap count to keep WGSL portable', () => {
    expect(BLUR_GAUSSIAN_SEPARABLE_BLUR_WGSL).toMatch(/MAX_TAPS/);
  });

  it('declares a third globals vec4 for radial center params', () => {
    expect(BLUR_GAUSSIAN_SEPARABLE_BLUR_WGSL).toContain('v2 : vec4<f32>');
  });
});

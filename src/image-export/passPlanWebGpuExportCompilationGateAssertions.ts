/**
 * Compile-time preconditions for WebGPU **pass-plan** export (still + video): matches the early
 * `CompilationResult` checks in `renderWebGpuExportRgba8` / `createWebGpuVideoExportRenderPath` after
 * compile (no metadata errors, `backend==='webgpu'`, `supported`) plus structural guarantees on
 * `webgpuPassPlan` that pass-plan export runtimes rely on — without requiring a GPU in CI.
 *
 * Contrasts with {@link assertFullscreenExportWebGpuCompileGate}, which asserts single-pass fullscreen
 * WGSL (`webgpuPassPlan` absent).
 */
import { expect } from 'vitest';
import type { CompilationResult } from '../runtime/types';

const AUDIO_REMAP_LAYOUT_KEY = 'remap-mvp-stetra-audio-scale.out' as const;

export function assertAudioBokehPassPlanWebGpuExportCompilationGate(compilation: CompilationResult, label: string): void {
  expect(compilation.metadata.errors, `${label}: compiler errors`).toEqual([]);
  expect(compilation.backend, `${label}: backend`).toBe('webgpu');
  expect(compilation.supported, `${label}: supported`).toBe(true);
  expect(compilation.metadata.previewDependencies?.usesAudioUniforms, `${label}: audio uniforms`).toBe(true);

  const plan = compilation.webgpuPassPlan;
  if (!plan || plan.kind !== 'pass.bokeh.v1') {
    expect(plan?.kind, `${label}: pass plan kind`).toBe('pass.bokeh.v1');
    return;
  }

  expect(plan.nodeId, `${label}: pass-plan node`).toBe('n-bokeh-stbk');
  expect(compilation.code.length, `${label}: upstream WGSL body`).toBeGreaterThan(0);
  expect(compilation.code, `${label}: upstream @vertex`).toContain('@vertex');
  expect(compilation.code, `${label}: upstream @fragment`).toContain('@fragment');

  expect(plan.inputWgsl, `${label}`).toContain('@fragment');
  expect(plan.inputWgsl, `${label}`).toContain('fn fs(');
  expect(plan.thresholdWgsl, `${label}`).toContain('sourceTex');
  expect(plan.blurWgsl, `${label}`).toContain('apertureScale');
  expect(plan.combineWgsl, `${label}`).toContain('blurTex');
  expect(plan.intermediateTexture.format).toBe('rgba8unorm');

  expect(compilation.paramLayout[AUDIO_REMAP_LAYOUT_KEY]).toBeTypeOf('number');
  expect(compilation.paramLayout['n-bokeh-stbk.bokehThreshold']).toBe(plan.paramSlots.threshold);
  expect(compilation.paramLayout['n-bokeh-stbk.bokehIntensity']).toBe(plan.paramSlots.intensity);
  expect(compilation.paramLayout['n-bokeh-stbk.bokehRadius']).toBe(plan.paramSlots.radius);
  expect(compilation.paramLayout['n-bokeh-stbk.bokehStrength']).toBe(plan.paramSlots.strength);
  expect(compilation.paramLayout['n-bokeh-stbk.bokehBlades']).toBe(plan.paramSlots.blades);
  expect(compilation.paramLayout['n-bokeh-stbk.bokehRotation']).toBe(plan.paramSlots.rotation);
}

export function assertAudioBlurPassPlanWebGpuExportCompilationGate(compilation: CompilationResult, label: string): void {
  expect(compilation.metadata.errors, `${label}: compiler errors`).toEqual([]);
  expect(compilation.backend, `${label}: backend`).toBe('webgpu');
  expect(compilation.supported, `${label}: supported`).toBe(true);
  expect(compilation.metadata.previewDependencies?.usesAudioUniforms, `${label}: audio uniforms`).toBe(true);

  const plan = compilation.webgpuPassPlan;
  if (!plan || plan.kind !== 'pass.blur.gaussian-separable.v1') {
    expect(plan?.kind, `${label}: pass plan kind`).toBe('pass.blur.gaussian-separable.v1');
    return;
  }

  expect(plan.nodeId, `${label}: pass-plan node`).toBe('n-blur-stab');
  expect(compilation.code.length, `${label}: upstream WGSL body`).toBeGreaterThan(0);
  expect(compilation.code, `${label}: upstream @vertex`).toContain('@vertex');
  expect(compilation.code, `${label}: upstream @fragment`).toContain('@fragment');

  expect(plan.inputWgsl, `${label}`).toContain('@fragment');
  expect(plan.inputWgsl, `${label}`).toContain('fn fs(');
  expect(plan.blurWgsl, `${label}`).toContain('fsBlurH');
  expect(plan.blurWgsl, `${label}`).toContain('fsBlurV');
  expect(plan.presentWgsl, `${label}`).toContain('fn fs(');
  expect(plan.intermediateTexture.format).toBe('rgba8unorm');

  expect(compilation.paramLayout[AUDIO_REMAP_LAYOUT_KEY]).toBeTypeOf('number');
  expect(compilation.paramLayout['n-blur-stab.blurAmount']).toBe(plan.paramSlots.amount);
  expect(compilation.paramLayout['n-blur-stab.blurRadius']).toBe(plan.paramSlots.radius);
  expect(compilation.paramLayout['n-blur-stab.blurType']).toBe(plan.paramSlots.type);
  expect(compilation.paramLayout['n-blur-stab.blurDirection']).toBe(plan.paramSlots.direction);
  expect(compilation.paramLayout['n-blur-stab.blurCenterX']).toBe(plan.paramSlots.centerX);
  expect(compilation.paramLayout['n-blur-stab.blurCenterY']).toBe(plan.paramSlots.centerY);
}

export function assertAudioGlowBloomPassPlanWebGpuExportCompilationGate(
  compilation: CompilationResult,
  label: string
): void {
  expect(compilation.metadata.errors, `${label}: compiler errors`).toEqual([]);
  expect(compilation.backend, `${label}: backend`).toBe('webgpu');
  expect(compilation.supported, `${label}: supported`).toBe(true);
  expect(compilation.metadata.previewDependencies?.usesAudioUniforms, `${label}: audio uniforms`).toBe(true);

  const plan = compilation.webgpuPassPlan;
  if (!plan || plan.kind !== 'pass.glow-bloom.v1') {
    expect(plan?.kind, `${label}: pass plan kind`).toBe('pass.glow-bloom.v1');
    return;
  }

  expect(plan.nodeId, `${label}: pass-plan node`).toBe('n-glow-stgb');
  expect(compilation.code.length, `${label}: upstream WGSL body`).toBeGreaterThan(0);
  expect(compilation.code, `${label}: upstream @vertex`).toContain('@vertex');
  expect(compilation.code, `${label}: upstream @fragment`).toContain('@fragment');

  expect(plan.inputWgsl, `${label}`).toContain('@fragment');
  expect(plan.inputWgsl, `${label}`).toContain('fn fs(');
  expect(plan.thresholdWgsl, `${label}`).toContain('sourceTex');
  expect(plan.blurWgsl, `${label}`).toContain('fsBlurH');
  expect(plan.blurWgsl, `${label}`).toContain('fsBlurV');
  expect(plan.combineWgsl, `${label}`).toContain('bloomTex');
  expect(plan.intermediateTexture.format).toBe('rgba8unorm');

  expect(compilation.paramLayout[AUDIO_REMAP_LAYOUT_KEY]).toBeTypeOf('number');
  expect(compilation.paramLayout['n-glow-stgb.glowThreshold']).toBe(plan.paramSlots.threshold);
  expect(compilation.paramLayout['n-glow-stgb.glowIntensity']).toBe(plan.paramSlots.intensity);
  expect(compilation.paramLayout['n-glow-stgb.glowRadius']).toBe(plan.paramSlots.radius);
  expect(compilation.paramLayout['n-glow-stgb.glowStrength']).toBe(plan.paramSlots.strength);
}

export function assertAudioCrepuscularRaysPassPlanWebGpuExportCompilationGate(
  compilation: CompilationResult,
  label: string
): void {
  expect(compilation.metadata.errors, `${label}: compiler errors`).toEqual([]);
  expect(compilation.backend, `${label}: backend`).toBe('webgpu');
  expect(compilation.supported, `${label}: supported`).toBe(true);
  expect(compilation.metadata.previewDependencies?.usesAudioUniforms, `${label}: audio uniforms`).toBe(true);

  const plan = compilation.webgpuPassPlan;
  if (!plan || plan.kind !== 'pass.crepuscular-rays.v1') {
    expect(plan?.kind, `${label}: pass plan kind`).toBe('pass.crepuscular-rays.v1');
    return;
  }

  expect(plan.nodeId, `${label}: pass-plan node`).toBe('n-crep-stcr');
  expect(compilation.code.length, `${label}: upstream WGSL body`).toBeGreaterThan(0);
  expect(compilation.code, `${label}: upstream @vertex`).toContain('@vertex');
  expect(compilation.code, `${label}: upstream @fragment`).toContain('@fragment');

  expect(plan.inputWgsl, `${label}`).toContain('@fragment');
  expect(plan.inputWgsl, `${label}`).toContain('fn fs(');
  expect(plan.occluderWgsl, `${label}`).toContain('rayStripes');
  expect(plan.sweepWgsl, `${label}`).toContain('SAMPLES');
  expect(plan.combineWgsl, `${label}`).toContain('raysTex');
  expect(plan.intermediateTexture.format).toBe('rgba8unorm');

  expect(compilation.paramLayout[AUDIO_REMAP_LAYOUT_KEY]).toBeTypeOf('number');
  expect(compilation.paramLayout['n-crep-stcr.sourceX']).toBe(plan.paramSlots.sourceX);
  expect(compilation.paramLayout['n-crep-stcr.sourceY']).toBe(plan.paramSlots.sourceY);
  expect(compilation.paramLayout['n-crep-stcr.distanceFalloff']).toBe(plan.paramSlots.distanceFalloff);
  expect(compilation.paramLayout['n-crep-stcr.intensity']).toBe(plan.paramSlots.intensity);
  expect(compilation.paramLayout['n-crep-stcr.rayCount']).toBe(plan.paramSlots.rayCount);
  expect(compilation.paramLayout['n-crep-stcr.spread']).toBe(plan.paramSlots.spread);
  expect(compilation.paramLayout['n-crep-stcr.width']).toBe(plan.paramSlots.width);
  expect(compilation.paramLayout['n-crep-stcr.rotationSpeed']).toBe(plan.paramSlots.rotationSpeed);
  expect(compilation.paramLayout['n-crep-stcr.rotationOffset']).toBe(plan.paramSlots.rotationOffset);
}

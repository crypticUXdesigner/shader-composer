/**
 * Preconditions for WebGPU fullscreen-triangle export (still + video): before `webgpuPassPlan` branches,
 * orchestration requires a clean WGSL fullscreen compile (see `renderWebGpuExportRgba8` and
 * `createWebGpuVideoExportRenderPath` early exits).
 */
import { expect } from 'vitest';
import type { CompilationResult } from '../runtime/types';

export function assertFullscreenExportWebGpuCompileGate(compilation: CompilationResult, label: string): void {
  expect(compilation.metadata.errors, `${label}: compiler errors`).toEqual([]);
  expect(compilation.backend, `${label}: backend`).toBe('webgpu');
  expect(compilation.supported, `${label}: supported`).toBe(true);
  expect(
    compilation.webgpuPassPlan,
    `${label}: expected fullscreen WGSL (no multipass export plan)`
  ).toBeUndefined();
  expect(compilation.code.length, `${label}: WGSL body`).toBeGreaterThan(0);
  expect(compilation.code, `${label}`).toContain('@vertex');
  expect(compilation.code, `${label}`).toContain('@fragment');
  expect(compilation.metadata.finalOutputNodeId, `${label}: output`).not.toBeNull();
}

/** Bundled presets that rely on bounded `generic-raymarcher` WebGPU fullscreen path. */
export const GENERIC_RAYMARCHER_FULLSCREEN_WEBGPU_EXPORT_PRESETS = [
  'fractal-julia-slab.json',
  'fractal-mandelbox.json',
  'fractal-mandelbulb.json',
  'fractal-menger-sponge.json',
  'fractal-sierpinski-tetra.json',
  'sdf-raymarcher-ether-audio.json',
  'sdf-raymarcher-hex-audio.json',
] as const;

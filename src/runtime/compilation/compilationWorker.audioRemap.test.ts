/**
 * Mirrors the compilation worker entrypoint in `compilationWorker.ts`:
 * `compiler.compile(graph, audioSetup ?? undefined, { backend: targetBackend })`.
 * Verifies `paramLayout` retains virtual audio remap slots after compile and after
 * structuredClone (same shape as postMessage from worker → main).
 */

import { describe, it, expect } from 'vitest';
import { NodeShaderCompiler } from '../../shaders/NodeShaderCompiler';
import { nodeSystemSpecs } from '../../shaders/nodes';
import type { NodeSpec } from '../../types/nodeSpec';
import {
  mvpAudioBlurPassPlanGraph,
  mvpAudioBokehPassPlanGraph,
  mvpAudioCrepuscularRaysPassPlanGraph,
  mvpAudioGlowBloomPassPlanGraph,
  mvpGenericRaymarcherSierpinskiTetraScaleAudioSetup,
} from '../../validation/webgpuMvpFixtures';

const AUDIO_REMAP_LAYOUT_KEY = 'remap-mvp-stetra-audio-scale.out';

function buildNodeSpecsMap(): Map<string, NodeSpec> {
  return new Map(nodeSystemSpecs.map((s) => [s.id, s]));
}

describe('compilation worker path (compiler.compile parity)', () => {
  it('WebGPU audio blur fixture: paramLayout audio remap slot survives structuredClone', () => {
    const compiler = new NodeShaderCompiler(buildNodeSpecsMap());
    const graph = mvpAudioBlurPassPlanGraph();
    const audioSetup = mvpGenericRaymarcherSierpinskiTetraScaleAudioSetup();
    const result = compiler.compile(graph, audioSetup, { backend: 'webgpu' });

    expect(result.metadata.errors).toHaveLength(0);
    expect(result.supported).toBe(true);
    const idx = result.paramLayout[AUDIO_REMAP_LAYOUT_KEY];
    expect(idx).toBeTypeOf('number');

    const cloned = structuredClone(result);
    expect(cloned.paramLayout[AUDIO_REMAP_LAYOUT_KEY]).toBe(idx);
  });

  it('WebGPU audio glow-bloom fixture: paramLayout audio remap slot survives structuredClone', () => {
    const compiler = new NodeShaderCompiler(buildNodeSpecsMap());
    const graph = mvpAudioGlowBloomPassPlanGraph();
    const audioSetup = mvpGenericRaymarcherSierpinskiTetraScaleAudioSetup();
    const result = compiler.compile(graph, audioSetup, { backend: 'webgpu' });

    expect(result.metadata.errors).toHaveLength(0);
    expect(result.supported).toBe(true);
    const idx = result.paramLayout[AUDIO_REMAP_LAYOUT_KEY];
    expect(idx).toBeTypeOf('number');

    const cloned = structuredClone(result);
    expect(cloned.paramLayout[AUDIO_REMAP_LAYOUT_KEY]).toBe(idx);
  });

  it('WebGPU audio bokeh fixture: paramLayout audio remap slot survives structuredClone', () => {
    const compiler = new NodeShaderCompiler(buildNodeSpecsMap());
    const graph = mvpAudioBokehPassPlanGraph();
    const audioSetup = mvpGenericRaymarcherSierpinskiTetraScaleAudioSetup();
    const result = compiler.compile(graph, audioSetup, { backend: 'webgpu' });

    expect(result.metadata.errors).toHaveLength(0);
    expect(result.supported).toBe(true);
    const idx = result.paramLayout[AUDIO_REMAP_LAYOUT_KEY];
    expect(idx).toBeTypeOf('number');

    const cloned = structuredClone(result);
    expect(cloned.paramLayout[AUDIO_REMAP_LAYOUT_KEY]).toBe(idx);
  });

  it('WebGPU audio crepuscular-rays fixture: paramLayout audio remap slot survives structuredClone', () => {
    const compiler = new NodeShaderCompiler(buildNodeSpecsMap());
    const graph = mvpAudioCrepuscularRaysPassPlanGraph();
    const audioSetup = mvpGenericRaymarcherSierpinskiTetraScaleAudioSetup();
    const result = compiler.compile(graph, audioSetup, { backend: 'webgpu' });

    expect(result.metadata.errors).toHaveLength(0);
    expect(result.supported).toBe(true);
    const idx = result.paramLayout[AUDIO_REMAP_LAYOUT_KEY];
    expect(idx).toBeTypeOf('number');

    const cloned = structuredClone(result);
    expect(cloned.paramLayout[AUDIO_REMAP_LAYOUT_KEY]).toBe(idx);
  });
});

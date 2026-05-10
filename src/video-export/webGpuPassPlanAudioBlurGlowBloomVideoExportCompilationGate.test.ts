/**
 * Mirrors `createWebGpuVideoExportRenderPath` WebGPU compile prerequisites for audio-driven blur /
 * glow-bloom pass-plan graphs (same compile call as still export:
 * `webGpuPassPlanAudioBlurGlowBloomExportCompilationGate.test.ts`).
 */
import { describe, it } from 'vitest';
import { NodeShaderCompiler } from '../shaders/NodeShaderCompiler';
import { nodeSystemSpecs } from '../shaders/nodes';
import type { NodeSpec } from '../types/nodeSpec';
import {
  mvpAudioBlurPassPlanGraph,
  mvpAudioBlurPassPlanNonzeroBlurGraph,
  mvpAudioGlowBloomPassPlanGraph,
  mvpGenericRaymarcherSierpinskiTetraScaleAudioSetup,
} from '../validation/webgpuMvpFixtures';
import {
  assertAudioBlurPassPlanWebGpuExportCompilationGate,
  assertAudioGlowBloomPassPlanWebGpuExportCompilationGate,
} from '../image-export/passPlanWebGpuExportCompilationGateAssertions';

function buildNodeSpecsMap(): Map<string, NodeSpec> {
  return new Map(nodeSystemSpecs.map((s) => [s.id, s]));
}

describe('WebGPU pass-plan video export compilation gate (audio blur + glow-bloom)', () => {
  it('mvpAudioBlurPassPlanGraph matches video export compiler preconditions', () => {
    const compiler = new NodeShaderCompiler(buildNodeSpecsMap());
    const audioSetup = mvpGenericRaymarcherSierpinskiTetraScaleAudioSetup();
    const compilation = compiler.compile(mvpAudioBlurPassPlanGraph(), audioSetup, { backend: 'webgpu' });
    assertAudioBlurPassPlanWebGpuExportCompilationGate(compilation, 'mvpAudioBlurPassPlanGraph (video)');
  });

  it('mvpAudioBlurPassPlanNonzeroBlurGraph matches video export compiler preconditions', () => {
    const compiler = new NodeShaderCompiler(buildNodeSpecsMap());
    const audioSetup = mvpGenericRaymarcherSierpinskiTetraScaleAudioSetup();
    const compilation = compiler.compile(mvpAudioBlurPassPlanNonzeroBlurGraph(), audioSetup, { backend: 'webgpu' });
    assertAudioBlurPassPlanWebGpuExportCompilationGate(compilation, 'mvpAudioBlurPassPlanNonzeroBlurGraph (video)');
  });

  it('mvpAudioGlowBloomPassPlanGraph matches video export compiler preconditions', () => {
    const compiler = new NodeShaderCompiler(buildNodeSpecsMap());
    const audioSetup = mvpGenericRaymarcherSierpinskiTetraScaleAudioSetup();
    const compilation = compiler.compile(mvpAudioGlowBloomPassPlanGraph(), audioSetup, { backend: 'webgpu' });
    assertAudioGlowBloomPassPlanWebGpuExportCompilationGate(compilation, 'mvpAudioGlowBloomPassPlanGraph (video)');
  });
});

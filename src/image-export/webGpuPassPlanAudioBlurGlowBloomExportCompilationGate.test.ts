/**
 * Ensures audio-driven blur / glow-bloom pass-plan graphs satisfy the same compiler gates as
 * `renderWebGpuExportRgba8` uses before GPU work, including a populated `webgpuPassPlan` with WGSL the
 * export pass runtimes validate (mirrors bokeh/crepuscular gates:
 * `webGpuPassPlanAudioBokehCrepuscularExportCompilationGate.test.ts`).
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
} from './passPlanWebGpuExportCompilationGateAssertions';

function buildNodeSpecsMap(): Map<string, NodeSpec> {
  return new Map(nodeSystemSpecs.map((s) => [s.id, s]));
}

describe('WebGPU pass-plan image export compilation gate (audio blur + glow-bloom)', () => {
  it('mvpAudioBlurPassPlanGraph matches export compiler preconditions', () => {
    const compiler = new NodeShaderCompiler(buildNodeSpecsMap());
    const audioSetup = mvpGenericRaymarcherSierpinskiTetraScaleAudioSetup();
    const compilation = compiler.compile(mvpAudioBlurPassPlanGraph(), audioSetup, { backend: 'webgpu' });
    assertAudioBlurPassPlanWebGpuExportCompilationGate(compilation, 'mvpAudioBlurPassPlanGraph');
  });

  it('mvpAudioBlurPassPlanNonzeroBlurGraph matches export compiler preconditions', () => {
    const compiler = new NodeShaderCompiler(buildNodeSpecsMap());
    const audioSetup = mvpGenericRaymarcherSierpinskiTetraScaleAudioSetup();
    const compilation = compiler.compile(mvpAudioBlurPassPlanNonzeroBlurGraph(), audioSetup, { backend: 'webgpu' });
    assertAudioBlurPassPlanWebGpuExportCompilationGate(compilation, 'mvpAudioBlurPassPlanNonzeroBlurGraph');
  });

  it('mvpAudioGlowBloomPassPlanGraph matches export compiler preconditions', () => {
    const compiler = new NodeShaderCompiler(buildNodeSpecsMap());
    const audioSetup = mvpGenericRaymarcherSierpinskiTetraScaleAudioSetup();
    const compilation = compiler.compile(mvpAudioGlowBloomPassPlanGraph(), audioSetup, { backend: 'webgpu' });
    assertAudioGlowBloomPassPlanWebGpuExportCompilationGate(compilation, 'mvpAudioGlowBloomPassPlanGraph');
  });
});

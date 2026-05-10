/**
 * Mirrors `createWebGpuVideoExportRenderPath` WebGPU compile prerequisites for audio-driven pass-plan
 * graphs (identical compile call to still export:
 * `webGpuPassPlanAudioBokehCrepuscularExportCompilationGate.test.ts`).
 */
import { describe, it } from 'vitest';
import { NodeShaderCompiler } from '../shaders/NodeShaderCompiler';
import { nodeSystemSpecs } from '../shaders/nodes';
import type { NodeSpec } from '../types/nodeSpec';
import {
  mvpAudioBokehPassPlanGraph,
  mvpAudioCrepuscularRaysPassPlanGraph,
  mvpGenericRaymarcherSierpinskiTetraScaleAudioSetup,
} from '../validation/webgpuMvpFixtures';
import {
  assertAudioBokehPassPlanWebGpuExportCompilationGate,
  assertAudioCrepuscularRaysPassPlanWebGpuExportCompilationGate,
} from '../image-export/passPlanWebGpuExportCompilationGateAssertions';

function buildNodeSpecsMap(): Map<string, NodeSpec> {
  return new Map(nodeSystemSpecs.map((s) => [s.id, s]));
}

describe('WebGPU pass-plan video export compilation gate (audio bokeh + crepuscular)', () => {
  it('mvpAudioBokehPassPlanGraph matches video export compiler preconditions', () => {
    const compiler = new NodeShaderCompiler(buildNodeSpecsMap());
    const audioSetup = mvpGenericRaymarcherSierpinskiTetraScaleAudioSetup();
    const compilation = compiler.compile(mvpAudioBokehPassPlanGraph(), audioSetup, { backend: 'webgpu' });
    assertAudioBokehPassPlanWebGpuExportCompilationGate(compilation, 'mvpAudioBokehPassPlanGraph (video)');
  });

  it('mvpAudioCrepuscularRaysPassPlanGraph matches video export compiler preconditions', () => {
    const compiler = new NodeShaderCompiler(buildNodeSpecsMap());
    const audioSetup = mvpGenericRaymarcherSierpinskiTetraScaleAudioSetup();
    const compilation = compiler.compile(mvpAudioCrepuscularRaysPassPlanGraph(), audioSetup, { backend: 'webgpu' });
    assertAudioCrepuscularRaysPassPlanWebGpuExportCompilationGate(compilation, 'mvpAudioCrepuscularRaysPassPlanGraph (video)');
  });
});

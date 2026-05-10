/**
 * Ensures audio-driven bokeh / crepuscular-ray pass-plan graphs satisfy the same compiler gates as
 * `renderWebGpuExportRgba8` uses before GPU work (see compile early exits in `WebGpuExportRenderPath.ts`),
 * including a populated `webgpuPassPlan` with WGSL the export pass runtimes validate.
 *
 * Matches export orchestration: `compiler.compile(graph, audioSetup, { backend: 'webgpu' })` with the
 * bundled MVP audio setup from {@link mvpGenericRaymarcherSierpinskiTetraScaleAudioSetup}.
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
} from './passPlanWebGpuExportCompilationGateAssertions';

function buildNodeSpecsMap(): Map<string, NodeSpec> {
  return new Map(nodeSystemSpecs.map((s) => [s.id, s]));
}

describe('WebGPU pass-plan image export compilation gate (audio bokeh + crepuscular)', () => {
  it('mvpAudioBokehPassPlanGraph matches export compiler preconditions', () => {
    const compiler = new NodeShaderCompiler(buildNodeSpecsMap());
    const audioSetup = mvpGenericRaymarcherSierpinskiTetraScaleAudioSetup();
    const compilation = compiler.compile(mvpAudioBokehPassPlanGraph(), audioSetup, { backend: 'webgpu' });
    assertAudioBokehPassPlanWebGpuExportCompilationGate(compilation, 'mvpAudioBokehPassPlanGraph');
  });

  it('mvpAudioCrepuscularRaysPassPlanGraph matches export compiler preconditions', () => {
    const compiler = new NodeShaderCompiler(buildNodeSpecsMap());
    const audioSetup = mvpGenericRaymarcherSierpinskiTetraScaleAudioSetup();
    const compilation = compiler.compile(mvpAudioCrepuscularRaysPassPlanGraph(), audioSetup, { backend: 'webgpu' });
    assertAudioCrepuscularRaysPassPlanWebGpuExportCompilationGate(compilation, 'mvpAudioCrepuscularRaysPassPlanGraph');
  });
});

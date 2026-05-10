/**
 * Deterministic WGSL MVP compile snapshots (CI-safe, no GPU).
 * Snapshots: emitted WGSL, paramLayout, previewDependencies.
 */
import { describe, it, expect } from 'vitest';
import { NodeShaderCompiler } from './NodeShaderCompiler';
import { nodeSystemSpecs } from './nodes/index';
import type { NodeSpec } from '../types/nodeSpec';
import {
  WEBGPU_MVP_FIXTURE_IDS,
  getWebgpuMvpFixtureGraph,
  getWebgpuMvpFixtureAudioSetup,
  type WebgpuMvpFixtureId
} from '../validation/webgpuMvpFixtures';

function buildNodeSpecsMap(): Map<string, NodeSpec> {
  return new Map(nodeSystemSpecs.map((s) => [s.id, s]));
}

describe('WGSL MVP compile snapshots', () => {
  const compiler = new NodeShaderCompiler(buildNodeSpecsMap());

  it.each(WEBGPU_MVP_FIXTURE_IDS)('matches snapshot for %s', (fixtureId: WebgpuMvpFixtureId) => {
    const graph = getWebgpuMvpFixtureGraph(fixtureId);
    const audioSetup = getWebgpuMvpFixtureAudioSetup(fixtureId);
    const result = compiler.compile(graph, audioSetup, { backend: 'webgpu' });

    expect(result.metadata.errors).toHaveLength(0);
    expect(result.supported).toBe(true);
    expect(result.backend).toBe('webgpu');

    const snap = {
      fixtureId,
      code: result.code,
      paramLayout: result.paramLayout,
      previewDependencies: result.metadata.previewDependencies
    };
    expect(snap).toMatchSnapshot();
  });
});

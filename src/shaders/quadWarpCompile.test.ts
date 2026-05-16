/**
 * Quad Warp uses aspect-corrected screen space (p) at ports; corners on [0,1]².
 */
import { describe, it, expect } from 'vitest';
import { NodeShaderCompiler } from './NodeShaderCompiler';
import { nodeSystemSpecs } from './nodes/index';
import { mvpDistortBatchGraph } from '../validation/webgpuMvpFixtures';
import type { NodeGraph } from '../data-model/types';
import type { NodeSpec } from '../types/nodeSpec';

function buildNodeSpecsMap(): Map<string, NodeSpec> {
  return new Map(nodeSystemSpecs.map((s) => [s.id, s]));
}

function buildQuadWarpGraph(): NodeGraph {
  return {
    id: 'graph-quad-warp-screen',
    name: 'Quad warp screen space',
    version: '2.0',
    nodes: [
      { id: 'n-uv', type: 'uv-coordinates', position: { x: 0, y: 0 }, parameters: {} },
      { id: 'n-qw', type: 'quad-warp', position: { x: 0, y: 0 }, parameters: {} },
      { id: 'n-out', type: 'final-output', position: { x: 0, y: 0 }, parameters: {} },
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'n-uv', sourcePort: 'out', targetNodeId: 'n-qw', targetPort: 'in' },
      { id: 'c2', sourceNodeId: 'n-qw', sourcePort: 'out', targetNodeId: 'n-out', targetPort: 'in' },
    ],
  };
}

const compiler = new NodeShaderCompiler(buildNodeSpecsMap());

describe('quad-warp screen space compile', () => {
  it('GLSL converts p ↔ unit square around bilinear warp', () => {
    const result = compiler.compile(buildQuadWarpGraph());
    expect(result.metadata.errors).toHaveLength(0);

    const code = result.shaderCode;
    expect(code).toContain('quadWarpScreenToUnit');
    expect(code).toContain('quadWarpUnitToScreen');
    expect(code).toContain('quadWarpBilinear');
    expect(code).toContain('float aspect = uResolution.x / max(uResolution.y, 1.0)');
    expect(code).toContain('quadWarpScreenToUnit(node_n_uv_out, aspect)');
    expect(code).toContain('quadWarpUnitToScreen(uvOut, aspect)');
  });

  it('WGSL converts p ↔ unit square around bilinear warp', () => {
    const graph = mvpDistortBatchGraph();

    const result = compiler.compile(graph, null, { backend: 'webgpu' });
    expect(result.metadata.errors).toHaveLength(0);
    expect(result.supported).toBe(true);

    const code = result.code;
    expect(code).toContain('.x / (2.0 * (globals.v0.z / max(1.0, globals.v0.w))) + 0.5');
    expect(code).toContain('* 2.0 - vec2<f32>(1.0, 1.0)) * vec2<f32>((globals.v0.z / max(1.0, globals.v0.w)), 1.0)');
  });
});

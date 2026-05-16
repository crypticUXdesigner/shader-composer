/**
 * Plane Project: ray–plane UV mapping in GLSL and WGSL MVP paths.
 */
import { describe, it, expect } from 'vitest';
import { NodeShaderCompiler } from './NodeShaderCompiler';
import { nodeSystemSpecs } from './nodes/index';
import type { NodeGraph } from '../data-model/types';
import type { NodeSpec } from '../types/nodeSpec';

function buildNodeSpecsMap(): Map<string, NodeSpec> {
  return new Map(nodeSystemSpecs.map((s) => [s.id, s]));
}

function buildPlaneProjectGraph(): NodeGraph {
  return {
    id: 'graph-plane-project',
    name: 'Plane project',
    version: '2.0',
    nodes: [
      { id: 'n-uv', type: 'uv-coordinates', position: { x: 0, y: 0 }, parameters: {} },
      { id: 'n-pp', type: 'plane-project', position: { x: 0, y: 0 }, parameters: {} },
      { id: 'n-noise', type: 'noise', position: { x: 0, y: 0 }, parameters: {} },
      { id: 'n-out', type: 'final-output', position: { x: 0, y: 0 }, parameters: {} },
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'n-uv', sourcePort: 'out', targetNodeId: 'n-pp', targetPort: 'in' },
      { id: 'c2', sourceNodeId: 'n-pp', sourcePort: 'uv', targetNodeId: 'n-noise', targetPort: 'in' },
      { id: 'c3', sourceNodeId: 'n-noise', sourcePort: 'out', targetNodeId: 'n-out', targetPort: 'in' },
    ],
  };
}

const compiler = new NodeShaderCompiler(buildNodeSpecsMap());

describe('plane-project compile', () => {
  it('GLSL emits ray–plane helpers and uv/hit outputs', () => {
    const result = compiler.compile(buildPlaneProjectGraph());
    expect(result.metadata.errors).toHaveLength(0);

    const code = result.shaderCode;
    expect(code).toContain('planeProjectLookAtRays');
    expect(code).toContain('planeProjectFrame');
    expect(code).toContain('PLANE_PROJECT_GRAZING_EPS');
    expect(code).toContain('node_n_pp_uv');
    expect(code).toContain('node_n_pp_hit');
  });

  it('WGSL MVP emits plane-project helpers and outputs', () => {
    const result = compiler.compile(buildPlaneProjectGraph(), null, { backend: 'webgpu' });
    expect(result.metadata.errors).toHaveLength(0);
    expect(result.supported).toBe(true);

    const code = result.code;
    expect(code).toContain('ppLookAtRays');
    expect(code).toContain('ppPlaneFrame');
    expect(code).toContain('params[25].x'); // clipRect param slot wired in MVP path
  });
});

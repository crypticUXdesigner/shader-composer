import { describe, it, expect } from 'vitest';
import { migrateKaleidoscopeSmooth } from './kaleidoscopeMergeMigration';
import type { NodeGraph } from './types';

describe('migrateKaleidoscopeSmooth', () => {
  it('rewrites kaleidoscope-smooth to kaleidoscope and maps parameters', () => {
    const graph: NodeGraph = {
      id: 'g1',
      name: 'T',
      version: '2.0',
      nodes: [
        {
          id: 'k1',
          type: 'kaleidoscope-smooth',
          position: { x: 0, y: 0 },
          parameters: {
            kaleidSmoothCenterX: 0.1,
            kaleidSmoothCenterY: -0.2,
            kaleidSmoothSegments: 8,
            kaleidSmoothRotation: 1.5,
            kaleidSmoothEdge: 0.12,
          },
          parameterInputModes: {
            kaleidSmoothSegments: 'override',
          },
        },
      ],
      connections: [],
    };

    const out = migrateKaleidoscopeSmooth(graph);
    const n = out.nodes[0];
    expect(n.type).toBe('kaleidoscope');
    expect(n.parameters.kaleidCenterX).toBe(0.1);
    expect(n.parameters.kaleidCenterY).toBe(-0.2);
    expect(n.parameters.kaleidSegments).toBe(8);
    expect(n.parameters.kaleidRotation).toBe(1.5);
    expect(n.parameters.kaleidEdgeSmooth).toBe(0.12);
    expect(n.parameterInputModes?.kaleidSegments).toBe('override');
    expect(n.parameterInputModes?.kaleidSmoothSegments).toBeUndefined();
  });

  it('rewrites parameter connections and automation lanes', () => {
    const graph: NodeGraph = {
      id: 'g1',
      name: 'T',
      version: '2.0',
      nodes: [{ id: 'k1', type: 'kaleidoscope-smooth', position: { x: 0, y: 0 }, parameters: {} }],
      connections: [
        {
          id: 'c1',
          sourceNodeId: 'src',
          sourcePort: 'out',
          targetNodeId: 'k1',
          targetParameter: 'kaleidSmoothRotation',
        },
      ],
      automation: {
        bpm: 120,
        durationSeconds: 60,
        lanes: [{ id: 'l1', nodeId: 'k1', paramName: 'kaleidSmoothRotation', regions: [] }],
      },
    };

    const out = migrateKaleidoscopeSmooth(graph);
    expect(out.connections[0].targetParameter).toBe('kaleidRotation');
    expect(out.automation!.lanes[0].paramName).toBe('kaleidRotation');
  });
});

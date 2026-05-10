import { describe, it, expect } from 'vitest';
import { migrateRemoveSpiralNodes } from './spiralNodeRemovalMigration';
import type { NodeGraph } from './types';

describe('migrateRemoveSpiralNodes', () => {
  it('drops spiral nodes and incident connections', () => {
    const graph: NodeGraph = {
      id: 'g',
      name: 't',
      version: '2.0',
      nodes: [
        { id: 'u', type: 'uv-coordinates', position: { x: 0, y: 0 }, parameters: {} },
        {
          id: 's',
          type: 'spiral',
          position: { x: 0, y: 0 },
          parameters: { spiralCenterX: 0, spiralCenterY: 0, spiralDensity: 1, spiralRotation: 0 },
          parameterInputModes: {}
        },
        { id: 'o', type: 'final-output', position: { x: 0, y: 0 }, parameters: {} }
      ],
      connections: [
        { id: 'c1', sourceNodeId: 'u', sourcePort: 'out', targetNodeId: 's', targetPort: 'in' },
        { id: 'c2', sourceNodeId: 's', sourcePort: 'out', targetNodeId: 'o', targetPort: 'in' }
      ]
    };
    const g = migrateRemoveSpiralNodes(graph);
    expect(g.nodes.map((n) => n.id).sort()).toEqual(['o', 'u']);
    expect(g.connections.length).toBe(0);
  });

  it('removes spiral automation lanes', () => {
    const graph: NodeGraph = {
      id: 'g',
      name: 't',
      version: '2.0',
      nodes: [
        {
          id: 's',
          type: 'spiral',
          position: { x: 0, y: 0 },
          parameters: {},
          parameterInputModes: {}
        }
      ],
      connections: [],
      automation: {
        bpm: 120,
        durationSeconds: 4,
        lanes: [
          {
            id: 'lane1',
            nodeId: 's',
            paramName: 'spiralDensity',
            regions: []
          }
        ]
      }
    };
    const g = migrateRemoveSpiralNodes(graph);
    expect(g.nodes.length).toBe(0);
    expect(g.automation?.lanes ?? []).toHaveLength(0);
  });
});

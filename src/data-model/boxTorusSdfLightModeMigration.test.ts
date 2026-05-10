import { describe, expect, it } from 'vitest';
import type { NodeGraph } from './types';
import { migrateBoxTorusSdfLightMode } from './boxTorusSdfLightModeMigration';

describe('migrateBoxTorusSdfLightMode', () => {
  it('renames lightType to mode on parameters', () => {
    const graph: NodeGraph = {
      id: 'g',
      name: 't',
      version: '2.0',
      nodes: [
        {
          id: 'bt1',
          type: 'box-torus-sdf',
          position: { x: 0, y: 0 },
          parameters: { lightType: 1, lightIntensity: 1 },
        },
      ],
      connections: [],
      metadata: {},
      viewState: { zoom: 1, panX: 0, panY: 0, selectedNodeIds: [] },
    };

    const out = migrateBoxTorusSdfLightMode(graph);
    const n = out.nodes.find((x) => x.id === 'bt1')!;
    expect(n.parameters.mode).toBe(1);
    expect(n.parameters).not.toHaveProperty('lightType');
  });

  it('rewires connections and automation from lightType to mode', () => {
    const graph: NodeGraph = {
      id: 'g',
      name: 't',
      version: '2.0',
      nodes: [
        { id: 'src', type: 'constant-float', position: { x: 0, y: 0 }, parameters: { value: 0 } },
        { id: 'bt1', type: 'box-torus-sdf', position: { x: 0, y: 0 }, parameters: {} },
      ],
      connections: [
        {
          id: 'c1',
          sourceNodeId: 'src',
          sourcePort: 'out',
          targetNodeId: 'bt1',
          targetParameter: 'lightType',
        },
      ],
      automation: {
        bpm: 120,
        durationSeconds: 4,
        lanes: [{ id: 'l1', nodeId: 'bt1', paramName: 'lightType', regions: [] }],
      },
      metadata: {},
      viewState: { zoom: 1, panX: 0, panY: 0, selectedNodeIds: [] },
    };

    const out = migrateBoxTorusSdfLightMode(graph);
    expect(out.connections[0].targetParameter).toBe('mode');
    expect(out.automation?.lanes[0].paramName).toBe('mode');
  });
});

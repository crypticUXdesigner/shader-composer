import { describe, expect, it } from 'vitest';
import type { Connection, NodeGraph } from './types';
import { migrateIridescentTunnelColors } from './iridescentTunnelColorsMigration';
import { linearRgbToOklch } from '../utils/colorConversion';

function conn(id: string, from: string, to: string, targetParameter: string): Connection {
  return {
    id,
    sourceNodeId: from,
    sourcePort: 'out',
    targetNodeId: to,
    targetParameter,
  };
}

describe('migrateIridescentTunnelColors', () => {
  it('rewrites iridescent-tunnel RGB params to OKLCH and updates RGB channel connections', () => {
    const graph: NodeGraph = {
      id: 'g1',
      name: 'Test',
      version: '2.0',
      nodes: [
        {
          id: 't1',
          type: 'iridescent-tunnel',
          position: { x: 0, y: 0 },
          parameters: {
            iridescentColorAR: 0.2,
            iridescentColorAG: 0.4,
            iridescentColorAB: 0.9,
            iridescentColorBR: 0.9,
            iridescentColorBG: 0.3,
            iridescentColorBB: 0.5,
          },
        },
        { id: 'n1', type: 'multiply', position: { x: 100, y: 0 }, parameters: {} },
      ],
      connections: [
        conn('c1', 'n1', 't1', 'iridescentColorAR'),
        conn('c2', 'n1', 't1', 'iridescentColorBB'),
      ],
      metadata: {},
      viewState: { zoom: 1, panX: 0, panY: 0, selectedNodeIds: [] },
    };

    const out = migrateIridescentTunnelColors(graph);
    const outNode = out.nodes.find((n) => n.id === 't1')!;

    expect(outNode.parameters).not.toHaveProperty('iridescentColorAR');
    expect(outNode.parameters).not.toHaveProperty('iridescentColorAG');
    expect(outNode.parameters).not.toHaveProperty('iridescentColorAB');
    expect(outNode.parameters).not.toHaveProperty('iridescentColorBR');
    expect(outNode.parameters).not.toHaveProperty('iridescentColorBG');
    expect(outNode.parameters).not.toHaveProperty('iridescentColorBB');

    const expectedA = linearRgbToOklch(0.2, 0.4, 0.9);
    expect(outNode.parameters.colorAL as number).toBeCloseTo(expectedA.l, 5);
    expect(outNode.parameters.colorAC as number).toBeCloseTo(expectedA.c, 5);
    expect(outNode.parameters.colorAH as number).toBeCloseTo(expectedA.h, 5);

    const expectedB = linearRgbToOklch(0.9, 0.3, 0.5);
    expect(outNode.parameters.colorBL as number).toBeCloseTo(expectedB.l, 5);
    expect(outNode.parameters.colorBC as number).toBeCloseTo(expectedB.c, 5);
    expect(outNode.parameters.colorBH as number).toBeCloseTo(expectedB.h, 5);

    const c1 = out.connections.find((c) => c.id === 'c1')!;
    expect(c1.targetParameter).toBe('colorAL');
    const c2 = out.connections.find((c) => c.id === 'c2')!;
    expect(c2.targetParameter).toBe('colorBH');
  });
});


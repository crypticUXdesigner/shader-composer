import { describe, it, expect } from 'vitest';
import { migrateDisplace2dUnify } from './displace2dUnifyMigration';
import type { NodeGraph } from './types';

describe('migrateDisplace2dUnify', () => {
  it('migrates translate to displace with vector mode', () => {
    const graph: NodeGraph = {
      id: 'g1',
      name: 'T',
      version: '2.0',
      nodes: [
        {
          id: 't1',
          type: 'translate',
          position: { x: 0, y: 0 },
          parameters: { x: 0.3, y: -0.4 },
          parameterInputModes: { x: 'multiply', y: 'add' },
        },
      ],
      connections: [
        {
          id: 'c1',
          sourceNodeId: 'src',
          sourcePort: 'out',
          targetNodeId: 't1',
          targetParameter: 'y',
        },
      ],
      automation: {
        bpm: 120,
        durationSeconds: 60,
        lanes: [{ id: 'l1', nodeId: 't1', paramName: 'x', regions: [] }],
      },
    };

    const out = migrateDisplace2dUnify(graph);
    const n = out.nodes[0];
    expect(n.type).toBe('displace');
    expect(n.parameters.displaceMode).toBe(0);
    expect(n.parameters.displaceScale).toBe(1.0);
    expect(n.parameters.offsetX).toBe(0.3);
    expect(n.parameters.offsetY).toBe(-0.4);
    expect(n.parameterInputModes?.offsetX).toBe('multiply');
    expect(n.parameterInputModes?.offsetY).toBe('add');
    expect(out.connections[0].targetParameter).toBe('offsetY');
    expect(out.automation!.lanes[0].paramName).toBe('offsetX');
  });

  it('migrates directional-displace to displace with directional mode', () => {
    const graph: NodeGraph = {
      id: 'g1',
      name: 'T',
      version: '2.0',
      nodes: [
        {
          id: 'd1',
          type: 'directional-displace',
          position: { x: 0, y: 0 },
          parameters: {
            directionalDisplaceAngle: 1.2,
            directionalDisplaceScale: 2.5,
            amount: -0.5,
          },
          parameterInputModes: {
            directionalDisplaceScale: 'multiply',
          },
        },
      ],
      connections: [
        {
          id: 'c1',
          sourceNodeId: 'src',
          sourcePort: 'out',
          targetNodeId: 'd1',
          targetParameter: 'directionalDisplaceScale',
        },
      ],
      automation: {
        bpm: 120,
        durationSeconds: 60,
        lanes: [{ id: 'l1', nodeId: 'd1', paramName: 'directionalDisplaceScale', regions: [] }],
      },
    };

    const out = migrateDisplace2dUnify(graph);
    const n = out.nodes[0];
    expect(n.type).toBe('displace');
    expect(n.parameters.displaceMode).toBe(1);
    expect(n.parameters.displaceScale).toBe(2.5);
    expect(n.parameters.directionalDisplaceAngle).toBe(1.2);
    expect(n.parameters.amount).toBe(-0.5);
    expect(n.parameterInputModes?.displaceScale).toBe('multiply');
    expect(out.connections[0].targetParameter).toBe('displaceScale');
    expect(out.automation!.lanes[0].paramName).toBe('displaceScale');
  });
});

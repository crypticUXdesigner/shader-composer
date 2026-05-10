import { describe, it, expect } from 'vitest';
import { migrateRingsNode } from './ringsNodeMigration';
import type { NodeGraph } from './types';

const TAU = 2 * Math.PI;

describe('migrateRingsNode', () => {
  it('converts legacy ringFrequency to ringSpacing (peak distance)', () => {
    const graph: NodeGraph = {
      id: 'g',
      name: 't',
      version: '2.0',
      nodes: [
        {
          id: 'n1',
          type: 'rings',
          position: { x: 0, y: 0 },
          parameters: { ringFrequency: 10 },
          parameterInputModes: {}
        }
      ],
      connections: []
    };
    const g = migrateRingsNode(graph);
    expect(g.nodes[0].parameters.ringFrequency).toBeUndefined();
    expect(g.nodes[0].parameters.ringSpacing).toBeCloseTo(TAU / 10, 6);
  });

  it('drops parameter connections targeting ringFrequency', () => {
    const graph: NodeGraph = {
      id: 'g',
      name: 't',
      version: '2.0',
      nodes: [
        {
          id: 'n1',
          type: 'rings',
          position: { x: 0, y: 0 },
          parameters: {},
          parameterInputModes: {}
        },
        { id: 'c', type: 'constant-float', position: { x: 0, y: 0 }, parameters: { value: 5 }, parameterInputModes: {} }
      ],
      connections: [
        {
          id: 'w',
          sourceNodeId: 'c',
          sourcePort: 'out',
          targetNodeId: 'n1',
          targetParameter: 'ringFrequency'
        }
      ]
    };
    const g = migrateRingsNode(graph);
    expect(g.connections.length).toBe(0);
  });

  it('merges ringAmplitude and ringIntensity into ringLevel', () => {
    const graph: NodeGraph = {
      id: 'g',
      name: 't',
      version: '2.0',
      nodes: [
        {
          id: 'n1',
          type: 'rings',
          position: { x: 0, y: 0 },
          parameters: { ringAmplitude: 2, ringIntensity: 0.5 },
          parameterInputModes: {}
        }
      ],
      connections: []
    };
    const g = migrateRingsNode(graph);
    expect(g.nodes[0].parameters.ringLevel).toBe(1);
    expect(g.nodes[0].parameters.ringAmplitude).toBeUndefined();
    expect(g.nodes[0].parameters.ringIntensity).toBeUndefined();
  });

  it('sets ringLineMode from legacy positive ringWidth', () => {
    const graph: NodeGraph = {
      id: 'g',
      name: 't',
      version: '2.0',
      nodes: [
        {
          id: 'n1',
          type: 'rings',
          position: { x: 0, y: 0 },
          parameters: { ringWidth: 0.2 },
          parameterInputModes: {}
        }
      ],
      connections: []
    };
    const g = migrateRingsNode(graph);
    expect(g.nodes[0].parameters.ringLineMode).toBe(1);
  });

  it('maps parameter connection to ringLevel', () => {
    const graph: NodeGraph = {
      id: 'g',
      name: 't',
      version: '2.0',
      nodes: [
        {
          id: 'n1',
          type: 'rings',
          position: { x: 0, y: 0 },
          parameters: {},
          parameterInputModes: {}
        },
        { id: 'c', type: 'constant-float', position: { x: 0, y: 0 }, parameters: { value: 1 }, parameterInputModes: {} }
      ],
      connections: [
        {
          id: 'w',
          sourceNodeId: 'c',
          sourcePort: 'out',
          targetNodeId: 'n1',
          targetParameter: 'ringAmplitude'
        }
      ]
    };
    const g = migrateRingsNode(graph);
    expect(g.connections[0].targetParameter).toBe('ringLevel');
  });

  it('drops duplicate ringLevel parameter connections after remap', () => {
    const graph: NodeGraph = {
      id: 'g',
      name: 't',
      version: '2.0',
      nodes: [
        {
          id: 'n1',
          type: 'rings',
          position: { x: 0, y: 0 },
          parameters: {},
          parameterInputModes: {}
        },
        { id: 'a', type: 'constant-float', position: { x: 0, y: 0 }, parameters: { value: 1 }, parameterInputModes: {} },
        { id: 'b', type: 'constant-float', position: { x: 0, y: 0 }, parameters: { value: 0.5 }, parameterInputModes: {} }
      ],
      connections: [
        {
          id: 'w1',
          sourceNodeId: 'a',
          sourcePort: 'out',
          targetNodeId: 'n1',
          targetParameter: 'ringAmplitude'
        },
        {
          id: 'w2',
          sourceNodeId: 'b',
          sourcePort: 'out',
          targetNodeId: 'n1',
          targetParameter: 'ringIntensity'
        }
      ]
    };
    const g = migrateRingsNode(graph);
    expect(g.connections.length).toBe(1);
    expect(g.connections[0].targetParameter).toBe('ringLevel');
  });

  it('migrates automation lanes to ringLevel and dedupes', () => {
    const graph: NodeGraph = {
      id: 'g',
      name: 't',
      version: '2.0',
      nodes: [
        {
          id: 'n1',
          type: 'rings',
          position: { x: 0, y: 0 },
          parameters: {},
          parameterInputModes: {}
        }
      ],
      connections: [],
      automation: {
        bpm: 120,
        durationSeconds: 10,
        lanes: [
          {
            id: 'l1',
            nodeId: 'n1',
            paramName: 'ringAmplitude',
            regions: []
          },
          {
            id: 'l2',
            nodeId: 'n1',
            paramName: 'ringIntensity',
            regions: []
          }
        ]
      }
    };
    const g = migrateRingsNode(graph);
    expect(g.automation?.lanes.length).toBe(1);
    expect(g.automation?.lanes[0].paramName).toBe('ringLevel');
  });
});

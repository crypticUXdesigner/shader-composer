import { describe, it } from 'vitest';
import type { NodeGraph } from './types';
import type { NodeSpecification } from './validationTypes';
import { removeNode } from './immutableUpdates';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(
      `${message || 'Values not equal'}\n  Expected: ${expected}\n  Actual: ${actual}`
    );
  }
}

const bridgeSpecs: NodeSpecification[] = [
  {
    id: 'vec2-source',
    outputs: [{ name: 'out', type: 'vec2' }],
    parameters: {},
  },
  {
    id: 'vec2-through',
    inputs: [{ name: 'in', type: 'vec2' }],
    outputs: [{ name: 'out', type: 'vec2' }],
    parameters: {},
  },
  {
    id: 'vec2-sink',
    inputs: [{ name: 'in', type: 'vec2' }],
    parameters: {},
  },
  {
    id: 'vec2-to-float',
    inputs: [{ name: 'in', type: 'vec2' }],
    outputs: [{ name: 'out', type: 'float' }],
    parameters: {},
  },
  {
    id: 'float-sink',
    inputs: [{ name: 'in', type: 'float' }],
    parameters: {},
  },
];

describe('removeNode bridging', () => {
  it('reconnects upstream to downstream when passthrough types match', () => {
    const graph: NodeGraph = {
      id: 'g',
      name: 't',
      version: '2.0',
      nodes: [
        { id: 'src', type: 'vec2-source', position: { x: 0, y: 0 }, parameters: {} },
        { id: 'mid', type: 'vec2-through', position: { x: 1, y: 0 }, parameters: {} },
        { id: 'sink', type: 'vec2-sink', position: { x: 2, y: 0 }, parameters: {} },
      ],
      connections: [
        {
          id: 'c1',
          sourceNodeId: 'src',
          sourcePort: 'out',
          targetNodeId: 'mid',
          targetPort: 'in',
        },
        {
          id: 'c2',
          sourceNodeId: 'mid',
          sourcePort: 'out',
          targetNodeId: 'sink',
          targetPort: 'in',
        },
      ],
    };

    const next = removeNode(graph, 'mid', { nodeSpecs: bridgeSpecs });
    assertEqual(next.nodes.length, 2, 'mid removed');
    assertEqual(next.connections.length, 1, 'single bridged wire');
    const b = next.connections[0];
    assertEqual(b.sourceNodeId, 'src', 'source');
    assertEqual(b.targetNodeId, 'sink', 'sink');
    assertEqual(b.sourcePort, 'out', 'source port');
    assertEqual(b.targetPort, 'in', 'target port');
  });

  it('does not bridge when middle node changes wire type', () => {
    const graph: NodeGraph = {
      id: 'g',
      name: 't',
      version: '2.0',
      nodes: [
        { id: 'src', type: 'vec2-source', position: { x: 0, y: 0 }, parameters: {} },
        { id: 'mid', type: 'vec2-to-float', position: { x: 1, y: 0 }, parameters: {} },
        { id: 'sink', type: 'float-sink', position: { x: 2, y: 0 }, parameters: {} },
      ],
      connections: [
        {
          id: 'c1',
          sourceNodeId: 'src',
          sourcePort: 'out',
          targetNodeId: 'mid',
          targetPort: 'in',
        },
        {
          id: 'c2',
          sourceNodeId: 'mid',
          sourcePort: 'out',
          targetNodeId: 'sink',
          targetPort: 'in',
        },
      ],
    };

    const next = removeNode(graph, 'mid', { nodeSpecs: bridgeSpecs });
    assertEqual(next.connections.length, 0, 'no bridge when vec2 !== float out');
  });

  it('does not bridge with multiple outgoing wires', () => {
    const graph: NodeGraph = {
      id: 'g',
      name: 't',
      version: '2.0',
      nodes: [
        { id: 'src', type: 'vec2-source', position: { x: 0, y: 0 }, parameters: {} },
        { id: 'mid', type: 'vec2-through', position: { x: 1, y: 0 }, parameters: {} },
        { id: 'sink', type: 'vec2-sink', position: { x: 2, y: 0 }, parameters: {} },
        { id: 'sink2', type: 'vec2-sink', position: { x: 2, y: 1 }, parameters: {} },
      ],
      connections: [
        {
          id: 'c1',
          sourceNodeId: 'src',
          sourcePort: 'out',
          targetNodeId: 'mid',
          targetPort: 'in',
        },
        {
          id: 'c2',
          sourceNodeId: 'mid',
          sourcePort: 'out',
          targetNodeId: 'sink',
          targetPort: 'in',
        },
        {
          id: 'c3',
          sourceNodeId: 'mid',
          sourcePort: 'out',
          targetNodeId: 'sink2',
          targetPort: 'in',
        },
      ],
    };

    const next = removeNode(graph, 'mid', { nodeSpecs: bridgeSpecs });
    assertEqual(next.connections.length, 0, 'fan-out: no bridge');
  });

  it('matches legacy behavior without nodeSpecs', () => {
    const graph: NodeGraph = {
      id: 'g',
      name: 't',
      version: '2.0',
      nodes: [
        { id: 'src', type: 'vec2-source', position: { x: 0, y: 0 }, parameters: {} },
        { id: 'mid', type: 'vec2-through', position: { x: 1, y: 0 }, parameters: {} },
        { id: 'sink', type: 'vec2-sink', position: { x: 2, y: 0 }, parameters: {} },
      ],
      connections: [
        {
          id: 'c1',
          sourceNodeId: 'src',
          sourcePort: 'out',
          targetNodeId: 'mid',
          targetPort: 'in',
        },
        {
          id: 'c2',
          sourceNodeId: 'mid',
          sourcePort: 'out',
          targetNodeId: 'sink',
          targetPort: 'in',
        },
      ],
    };

    const next = removeNode(graph, 'mid');
    assertEqual(next.connections.length, 0, 'no specs → no bridge');
  });
});

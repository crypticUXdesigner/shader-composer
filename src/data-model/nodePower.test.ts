/**
 * Node Power (bypassed) — data model + serialization tests.
 */

import { describe, expect, it } from 'vitest';
import type { NodeGraph, NodeInstance } from './types';
import type { NodeSpecification } from './validationTypes';
import {
  validateGraph,
  serializeGraph,
  deserializeGraph,
  createEmptyGraph,
  addNode,
  findNode,
} from './index';
import { setNodeBypassed } from './immutableUpdates';
import { UndoRedoManager } from '../ui/editor/UndoRedoManager';

const mockSpecs: NodeSpecification[] = [
  {
    id: 'uv-coordinates',
    outputs: [{ name: 'out', type: 'vec2' }],
    parameters: {},
  },
  {
    id: 'noise',
    inputs: [{ name: 'in', type: 'vec2' }],
    outputs: [{ name: 'out', type: 'float' }],
    parameters: {
      noiseScale: { type: 'float', default: 2, min: 0.1, max: 10 },
      noiseOctaves: { type: 'int', default: 4, min: 1, max: 8 },
      noiseIntensity: { type: 'float', default: 0.5, min: 0, max: 1 },
    },
  },
];

function minimalNode(partial: Omit<NodeInstance, 'id' | 'position' | 'parameters'> & Partial<NodeInstance>): NodeInstance {
  return {
    id: 'n1',
    position: { x: 0, y: 0 },
    parameters: {},
    ...partial,
  } as NodeInstance;
}

describe('node power (bypassed)', () => {
  it('setNodeBypassed: toggling true updates graph + node refs; other nodes stay reference-equal', () => {
    const uv = minimalNode({ id: 'uv', type: 'uv-coordinates', parameters: {} });
    const noise = minimalNode({
      id: 'noise',
      type: 'noise',
      parameters: { noiseScale: 2, noiseOctaves: 4, noiseIntensity: 0.5 },
    });
    let graph: NodeGraph = createEmptyGraph('t');
    graph = addNode(graph, uv);
    graph = addNode(graph, noise);

    const before = graph;
    const uvBefore = findNode(before, 'uv')!;
    const noiseBefore = findNode(before, 'noise')!;

    const after = setNodeBypassed(before, 'noise', true);
    expect(after).not.toBe(before);
    expect(findNode(after, 'noise')).not.toBe(noiseBefore);
    expect(findNode(after, 'noise')?.bypassed).toBe(true);
    expect(findNode(after, 'uv')).toBe(uvBefore);
  });

  it('setNodeBypassed: false removes field (not stored as false)', () => {
    let graph: NodeGraph = createEmptyGraph('t');
    const noise = minimalNode({
      id: 'noise',
      type: 'noise',
      parameters: { noiseScale: 2, noiseOctaves: 4, noiseIntensity: 0.5 },
      bypassed: true,
    });
    graph = addNode(graph, noise);

    const after = setNodeBypassed(graph, 'noise', false);
    expect(findNode(after, 'noise')?.bypassed).toBeUndefined();
  });

  it('setNodeBypassed: unknown node id returns same graph reference', () => {
    const graph: NodeGraph = createEmptyGraph('t');
    const after = setNodeBypassed(graph, 'missing', true);
    expect(after).toBe(graph);
  });

  it('serialize → deserialize → serialize is byte-stable with bypassed: true', () => {
    let graph: NodeGraph = createEmptyGraph('t');
    graph = addNode(
      graph,
      minimalNode({
        id: 'noise',
        type: 'noise',
        parameters: { noiseScale: 2, noiseOctaves: 4, noiseIntensity: 0.5 },
        bypassed: true,
      })
    );

    const json1 = serializeGraph(graph, false, undefined);
    const r = deserializeGraph(json1, mockSpecs);
    expect(r.errors).toEqual([]);
    expect(r.graph).not.toBeNull();
    const json2 = serializeGraph(r.graph!, false, undefined);
    expect(json2).toBe(json1);
  });

  it('legacy graph JSON without bypassed loads clean and reserializes without introducing bypassed', () => {
    const legacy = JSON.stringify({
      format: 'shadernoice-node-graph',
      formatVersion: '2.0',
      graph: {
        id: 'g1',
        name: 'Legacy',
        version: '2.0',
        nodes: [
          {
            id: 'noise',
            type: 'noise',
            position: { x: 0, y: 0 },
            parameters: {
              noiseScale: 2,
              noiseOctaves: 4,
              noiseIntensity: 0.5,
            },
          },
        ],
        connections: [],
      },
    });

    const first = deserializeGraph(legacy, mockSpecs);
    expect(first.errors).toEqual([]);
    expect(first.warnings).toEqual([]);
    expect(findNode(first.graph!, 'noise')?.bypassed).toBeUndefined();

    const out = serializeGraph(first.graph!, false, undefined);
    expect(out.includes('"bypassed"')).toBe(false);
  });

  it('validateGraph rejects non-boolean bypassed', () => {
    const bad = {
      ...createEmptyGraph('bad'),
      nodes: [
        minimalNode({
          id: 'noise',
          type: 'noise',
          parameters: { noiseScale: 2, noiseOctaves: 4, noiseIntensity: 0.5 },
          bypassed: 'yes' as unknown as boolean,
        }),
      ],
    };
    const r = validateGraph(bad, mockSpecs);
    expect(r.errors.some((e) => e.includes('invalid bypassed'))).toBe(true);
  });

  it('undo restores bypassed state via UndoRedoManager snapshots', () => {
    let graph: NodeGraph = createEmptyGraph('t');
    graph = addNode(
      graph,
      minimalNode({
        id: 'noise',
        type: 'noise',
        parameters: { noiseScale: 2, noiseOctaves: 4, noiseIntensity: 0.5 },
      })
    );

    const edited = setNodeBypassed(graph, 'noise', true);
    const undo = new UndoRedoManager();
    undo.clear();
    undo.pushState(graph);
    undo.pushState(edited);
    const restored = undo.undo();
    expect(restored).not.toBeNull();
    expect(findNode(restored!, 'noise')?.bypassed).toBeUndefined();
  });
});

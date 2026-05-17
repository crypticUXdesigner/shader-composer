import { describe, expect, it } from 'vitest';
import type { NodeGraph } from '../data-model/types';
import { compareNodeSpec, selectNodeSpec } from '../shaders/nodes/masking-nodes';
import { resolveSelectActiveBranchPort } from './selectActiveBranch';

function makeSelectGraph(condition: number): NodeGraph {
  return {
    nodes: [
      {
        id: 'sel',
        type: 'select',
        position: { x: 0, y: 0 },
        parameters: { condition },
      },
    ],
    connections: [],
    viewState: { zoom: 1, panX: 0, panY: 0, selectedNodeIds: [] },
  };
}

describe('resolveSelectActiveBranchPort', () => {
  const specs = new Map([['select', selectNodeSpec]]);

  it('returns falseValue when condition is at or below 0.5', () => {
    const graph = makeSelectGraph(0.5);
    const node = graph.nodes[0]!;
    expect(
      resolveSelectActiveBranchPort(node, selectNodeSpec, graph, specs, undefined, 0)
    ).toBe('falseValue');
  });

  it('returns trueValue when condition is above 0.5', () => {
    const graph = makeSelectGraph(0.51);
    const node = graph.nodes[0]!;
    expect(
      resolveSelectActiveBranchPort(node, selectNodeSpec, graph, specs, undefined, 0)
    ).toBe('trueValue');
  });

  it('returns null when spec is not select', () => {
    const graph = makeSelectGraph(1);
    const node = graph.nodes[0]!;
    expect(
      resolveSelectActiveBranchPort(node, compareNodeSpec, graph, specs, undefined, 0)
    ).toBe(null);
  });
});

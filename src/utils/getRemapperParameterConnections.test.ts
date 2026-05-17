import { describe, it, expect } from 'vitest';
import { getRemapperParameterConnections } from './getRemapperParameterConnections';
import { getVirtualNodeId } from './virtualNodes';
import type { NodeGraph } from '../data-model/types';
import type { NodeSpec } from '../types/nodeSpec';

describe('getRemapperParameterConnections', () => {
  it('returns sorted labels as Param (Node)', () => {
    const graph: NodeGraph = {
      id: 'g1',
      name: 'Test',
      version: '2.0',
      nodes: [
        { id: 'n-sphere', type: 'sphere', position: { x: 0, y: 0 }, parameters: {} },
        { id: 'n-box', type: 'box', position: { x: 0, y: 0 }, parameters: {} },
      ],
      connections: [
        {
          id: 'c1',
          sourceNodeId: getVirtualNodeId('remap-r1'),
          sourcePort: 'out',
          targetNodeId: 'n-sphere',
          targetParameter: 'radius',
        },
        {
          id: 'c2',
          sourceNodeId: getVirtualNodeId('remap-r1'),
          sourcePort: 'out',
          targetNodeId: 'n-box',
          targetParameter: 'size',
        },
      ],
      metadata: {},
      viewState: { zoom: 1, panX: 0, panY: 0, selectedNodeIds: [] },
    };
    const nodeSpecs = new Map<string, NodeSpec>([
      [
        'sphere',
        {
          id: 'sphere',
          displayName: 'Sphere',
          category: 'shape',
          parameters: { radius: { type: 'float', label: 'Radius', default: 1 } },
        } as NodeSpec,
      ],
      [
        'box',
        {
          id: 'box',
          displayName: 'Box',
          category: 'shape',
          parameters: { size: { type: 'float', label: 'Size', default: 1 } },
        } as NodeSpec,
      ],
    ]);

    const targets = getRemapperParameterConnections(graph, 'r1', nodeSpecs);
    expect(targets.map((t) => t.label)).toEqual(['Radius (Sphere)', 'Size (Box)']);
  });
});

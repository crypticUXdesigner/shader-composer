import { describe, expect, it } from 'vitest';
import { migrateInfiniteZoom } from './infiniteZoomMigration';
import type { NodeGraph, NodeInstance } from './types';

function minimalGraph(nodes: NodeInstance[]): NodeGraph {
  return {
    id: 'g',
    name: 't',
    version: '2.0',
    nodes,
    connections: []
  };
}

describe('migrateInfiniteZoom', () => {
  it('maps legacy scale + merges period / time speed into cycle length', () => {
    const graph = minimalGraph([
      {
        id: 'z',
        type: 'infinite-zoom',
        position: { x: 0, y: 0 },
        parameters: {
          infiniteZoomCenterX: 0,
          infiniteZoomCenterY: 0,
          infiniteZoomScale: 4,
          infiniteZoomTimeSpeed: 0.5,
          infiniteZoomLoopPeriod: 10
        }
      }
    ]);
    const g = migrateInfiniteZoom(graph);
    const p = g.nodes[0].parameters;
    expect(p.infiniteZoomScale).toBeUndefined();
    expect(p.infiniteZoomTimeSpeed).toBeUndefined();
    expect(typeof p.infiniteZoomStep).toBe('number');
    expect(typeof p.infiniteZoomDepth).toBe('number');
    expect(p.infiniteZoomLoopPeriod).toBeCloseTo(20, 5);
  });

  it('fills defaults when no legacy scale key', () => {
    const graph = minimalGraph([
      {
        id: 'z',
        type: 'infinite-zoom',
        position: { x: 0, y: 0 },
        parameters: {
          infiniteZoomLoopPeriod: 8,
          infiniteZoomStep: 1.07,
          infiniteZoomDepth: 0.5
        }
      }
    ]);
    const g = migrateInfiniteZoom(graph);
    expect(g.nodes[0].parameters.infiniteZoomStep).toBe(1.07);
  });
});

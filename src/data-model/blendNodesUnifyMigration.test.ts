import { describe, expect, it } from 'vitest';
import { migrateBlendNodesUnify, hasLegacyBlendNodes } from './blendNodesUnifyMigration';
import type { NodeGraph } from './types';

function minimalGraph(nodes: NodeGraph['nodes']): NodeGraph {
  return {
    nodes,
    connections: [],
    viewState: { panX: 0, panY: 0, zoom: 1 }
  };
}

describe('migrateBlendNodesUnify', () => {
  it('maps blend-mode to blend with alphaMode default', () => {
    const graph = minimalGraph([
      {
        id: 'b1',
        type: 'blend-mode',
        position: { x: 0, y: 0 },
        parameters: { mode: 3, opacity: 0.5 }
      }
    ]);
    expect(hasLegacyBlendNodes(graph)).toBe(true);
    const migrated = migrateBlendNodesUnify(graph);
    expect(migrated.nodes[0].type).toBe('blend');
    expect(migrated.nodes[0].parameters?.alphaMode).toBe(0);
    expect(migrated.nodes[0].parameters?.mode).toBe(3);
  });

  it('maps blend-color to blend preserving parameters', () => {
    const graph = minimalGraph([
      {
        id: 'b1',
        type: 'blend-color',
        position: { x: 0, y: 0 },
        parameters: { mode: 1, opacity: 1.0 }
      }
    ]);
    const migrated = migrateBlendNodesUnify(graph);
    expect(migrated.nodes[0].type).toBe('blend');
    expect(migrated.nodes[0].parameters?.alphaMode).toBe(0);
  });

  it('is idempotent', () => {
    const graph = minimalGraph([
      {
        id: 'b1',
        type: 'blend-mode',
        position: { x: 0, y: 0 },
        parameters: { mode: 0, opacity: 1, alphaMode: 0 }
      }
    ]);
    const once = migrateBlendNodesUnify(graph);
    const twice = migrateBlendNodesUnify(once);
    expect(twice).toEqual(once);
  });
});

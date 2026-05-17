import { describe, expect, it } from 'vitest';
import {
  LEGACY_OKLCH_COLOR_MAP_BEZIER,
  LEGACY_OKLCH_COLOR_MAP_THRESHOLD,
  OKLCH_COLOR_MAP_NODE_TYPE,
  migrateOklchColorMapUnify,
} from './oklchColorMapUnifyMigration';
import type { NodeGraph } from './types';

describe('migrateOklchColorMapUnify', () => {
  it('migrates bezier nodes to smooth mapMode and strips legacy port connections', () => {
    const graph: NodeGraph = {
      nodes: [
        {
          id: 'n-map',
          type: LEGACY_OKLCH_COLOR_MAP_BEZIER,
          position: { x: 0, y: 0 },
          parameters: { startColorL: 0.2 },
        },
      ],
      connections: [
        {
          id: 'c1',
          sourceNodeId: 'a',
          sourcePort: 'out',
          targetNodeId: 'n-map',
          targetPort: 'startColor',
        },
        {
          id: 'c2',
          sourceNodeId: 'b',
          sourcePort: 'out',
          targetNodeId: 'n-map',
          targetPort: 'in',
        },
      ],
    };

    const out = migrateOklchColorMapUnify(graph);
    expect(out.nodes[0].type).toBe(OKLCH_COLOR_MAP_NODE_TYPE);
    expect(out.nodes[0].parameters?.mapMode).toBe(0);
    expect(out.connections).toHaveLength(1);
    expect(out.connections[0].targetPort).toBe('in');
  });

  it('migrates threshold nodes to stepped mapMode', () => {
    const graph: NodeGraph = {
      nodes: [
        {
          id: 'n-map',
          type: LEGACY_OKLCH_COLOR_MAP_THRESHOLD,
          position: { x: 0, y: 0 },
          parameters: { stops: 8 },
        },
      ],
      connections: [],
    };

    const out = migrateOklchColorMapUnify(graph);
    expect(out.nodes[0].type).toBe(OKLCH_COLOR_MAP_NODE_TYPE);
    expect(out.nodes[0].parameters?.mapMode).toBe(1);
    expect(out.nodes[0].parameters?.stops).toBe(8);
  });

  it('is a no-op when no legacy nodes exist', () => {
    const graph: NodeGraph = {
      nodes: [
        {
          id: 'n-map',
          type: OKLCH_COLOR_MAP_NODE_TYPE,
          position: { x: 0, y: 0 },
          parameters: { mapMode: 0 },
        },
      ],
      connections: [],
    };
    expect(migrateOklchColorMapUnify(graph)).toBe(graph);
  });

  it('strips removed ports from unified oklch-color-map nodes', () => {
    const graph: NodeGraph = {
      nodes: [
        {
          id: 'n-map',
          type: OKLCH_COLOR_MAP_NODE_TYPE,
          position: { x: 0, y: 0 },
          parameters: { mapMode: 0 },
        },
      ],
      connections: [
        {
          id: 'c1',
          sourceNodeId: 'a',
          sourcePort: 'out',
          targetNodeId: 'n-map',
          targetPort: 'fragCoord',
        },
        {
          id: 'c2',
          sourceNodeId: 'b',
          sourcePort: 'out',
          targetNodeId: 'n-map',
          targetPort: 'in',
        },
      ],
    };

    const out = migrateOklchColorMapUnify(graph);
    expect(out.connections).toHaveLength(1);
    expect(out.connections[0].targetPort).toBe('in');
  });
});

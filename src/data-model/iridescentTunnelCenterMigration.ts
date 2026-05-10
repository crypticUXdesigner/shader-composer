/**
 * Iridescent Tunnel center migration
 *
 * Legacy specs used center defaults (0.5, 0.5) and [0..1] semantics while the dominant
 * `uv-coordinates` input is symmetric (~[-1..1]). Remap untouched legacy defaults to (0, 0).
 */

import type { NodeGraph, NodeInstance } from './types';

const NODE_TYPE = 'iridescent-tunnel';

const LEGACY_CENTER = 0.5;
const EPS = 1e-3;

export function migrateIridescentTunnelCenter(graph: NodeGraph): NodeGraph {
  return {
    ...graph,
    nodes: graph.nodes.map(migrateNode),
  };
}

function migrateNode(node: NodeInstance): NodeInstance {
  if (node.type !== NODE_TYPE) return node;
  const cx = node.parameters.centerX;
  const cy = node.parameters.centerY;
  if (
    typeof cx !== 'number' ||
    typeof cy !== 'number' ||
    !Number.isFinite(cx) ||
    !Number.isFinite(cy)
  ) {
    return node;
  }
  if (Math.abs(cx - LEGACY_CENTER) > EPS || Math.abs(cy - LEGACY_CENTER) > EPS) {
    return node;
  }
  return {
    ...node,
    parameters: {
      ...node.parameters,
      centerX: 0,
      centerY: 0,
    },
  };
}

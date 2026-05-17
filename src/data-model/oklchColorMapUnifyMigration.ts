/**
 * Unifies legacy `oklch-color-map-bezier` and `oklch-color-map-threshold` into `oklch-color-map`.
 */

import type { NodeGraph, NodeInstance } from './types';

export const LEGACY_OKLCH_COLOR_MAP_BEZIER = 'oklch-color-map-bezier';
export const LEGACY_OKLCH_COLOR_MAP_THRESHOLD = 'oklch-color-map-threshold';
export const OKLCH_COLOR_MAP_NODE_TYPE = 'oklch-color-map';

const MAP_MODE_SMOOTH = 0;
const MAP_MODE_STEPPED = 1;

const REMOVED_TARGET_PORTS = new Set([
  'startColor',
  'endColor',
  'lCurve',
  'cCurve',
  'hCurve',
  'fragCoord',
  'resolution',
]);

export function hasLegacyOklchColorMapNodes(graph: NodeGraph): boolean {
  return graph.nodes.some(
    (n) => n.type === LEGACY_OKLCH_COLOR_MAP_BEZIER || n.type === LEGACY_OKLCH_COLOR_MAP_THRESHOLD
  );
}

function migrateNode(node: NodeInstance): NodeInstance {
  const params = { ...(node.parameters ?? {}) };
  if (typeof params.mapMode !== 'number') {
    params.mapMode =
      node.type === LEGACY_OKLCH_COLOR_MAP_THRESHOLD ? MAP_MODE_STEPPED : MAP_MODE_SMOOTH;
  }
  return {
    ...node,
    type: OKLCH_COLOR_MAP_NODE_TYPE,
    parameters: params as NodeInstance['parameters'],
  };
}

function isOklchColorMapNodeType(type: string): boolean {
  return (
    type === OKLCH_COLOR_MAP_NODE_TYPE ||
    type === LEGACY_OKLCH_COLOR_MAP_BEZIER ||
    type === LEGACY_OKLCH_COLOR_MAP_THRESHOLD
  );
}

export function migrateOklchColorMapUnify(graph: NodeGraph): NodeGraph {
  const mapNodeIds = new Set(
    graph.nodes.filter((n) => isOklchColorMapNodeType(n.type)).map((n) => n.id)
  );
  const hasLegacy = hasLegacyOklchColorMapNodes(graph);
  const hasStaleConnections = graph.connections.some(
    (c) =>
      mapNodeIds.has(c.targetNodeId) &&
      c.targetPort != null &&
      REMOVED_TARGET_PORTS.has(c.targetPort)
  );

  if (!hasLegacy && !hasStaleConnections) return graph;

  const nodes = graph.nodes.map((n) =>
    n.type === LEGACY_OKLCH_COLOR_MAP_BEZIER || n.type === LEGACY_OKLCH_COLOR_MAP_THRESHOLD
      ? migrateNode(n)
      : n
  );

  const connections = graph.connections.filter((c) => {
    if (!mapNodeIds.has(c.targetNodeId)) return true;
    if (c.targetPort != null && REMOVED_TARGET_PORTS.has(c.targetPort)) return false;
    return true;
  });

  if (nodes === graph.nodes && connections.length === graph.connections.length) {
    return graph;
  }

  return { ...graph, nodes, connections };
}

import type { NodeGraph, NodeInstance } from './types';

const ARRANGEMENT_TRACK_FILTER_NODE_TYPES = new Set(['arrangement-lanes', 'arrangement-notes']);

function sanitizeArrangementLanesNode(node: NodeInstance): NodeInstance {
  if (!ARRANGEMENT_TRACK_FILTER_NODE_TYPES.has(node.type)) return node;
  const trackFilterList = node.parameters.trackFilterList;
  if (trackFilterList === undefined || typeof trackFilterList === 'string') {
    return node;
  }
  return {
    ...node,
    parameters: {
      ...node.parameters,
      trackFilterList: trackFilterList === 0 ? '' : String(trackFilterList),
    },
  };
}

/** Fix string parameters on arrangement nodes that were corrupted by knob UI (stored as number). */
export function migrateArrangementLanesParameters(graph: NodeGraph): NodeGraph {
  let changed = false;
  const nodes = graph.nodes.map((node) => {
    const next = sanitizeArrangementLanesNode(node);
    if (next !== node) changed = true;
    return next;
  });
  return changed ? { ...graph, nodes } : graph;
}

import { defaultArrangementNotesTrackFilter } from '../audiotool/arrangement/arrangementTrackFilter';
import type { ArrangementSnapshot } from '../audiotool/arrangement/types';
import type { NodeGraph, NodeInstance } from './types';

const NOTES_NODE_TYPE = 'arrangement-notes';

/** True when the node still uses “all tracks” or an empty subset filter. */
export function arrangementNotesNeedsDefaultTrackFilter(node: NodeInstance): boolean {
  if (node.type !== NOTES_NODE_TYPE) return false;
  const mode = Number(node.parameters.trackFilterMode ?? 0);
  if (mode !== 1) return true;
  const list =
    typeof node.parameters.trackFilterList === 'string'
      ? node.parameters.trackFilterList
      : '';
  return list.trim() === '';
}

export function applyArrangementNotesDefaultTrackFilterToNode(
  node: NodeInstance,
  snapshot: ArrangementSnapshot | undefined
): NodeInstance {
  if (!arrangementNotesNeedsDefaultTrackFilter(node)) return node;
  const defaults = defaultArrangementNotesTrackFilter(snapshot);
  return {
    ...node,
    parameters: {
      ...node.parameters,
      ...defaults,
    },
  };
}

export function applyArrangementNotesDefaultTrackFilterToGraph(
  graph: NodeGraph,
  snapshot: ArrangementSnapshot | undefined
): NodeGraph {
  let changed = false;
  const nodes = graph.nodes.map((node) => {
    const next = applyArrangementNotesDefaultTrackFilterToNode(node, snapshot);
    if (next !== node) changed = true;
    return next;
  });
  return changed ? { ...graph, nodes } : graph;
}

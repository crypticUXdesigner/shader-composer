/**
 * Removes retired `spiral` pattern nodes from saved graphs so legacy projects still load.
 */

import type { Connection, NodeGraph, NodeInstance } from './types';

export function migrateRemoveSpiralNodes(graph: NodeGraph): NodeGraph {
  const spiralIds = new Set(graph.nodes.filter((n) => n.type === 'spiral').map((n) => n.id));
  if (spiralIds.size === 0) return graph;

  const nodes: NodeInstance[] = graph.nodes.filter((n) => n.type !== 'spiral');
  const connections: Connection[] = graph.connections.filter(
    (c) => !spiralIds.has(c.sourceNodeId) && !spiralIds.has(c.targetNodeId)
  );

  let automation = graph.automation;
  if (automation) {
    const lanes = automation.lanes.filter((l) => !spiralIds.has(l.nodeId));
    if (lanes.length !== automation.lanes.length) {
      automation = { ...automation, lanes };
    }
  }

  let viewState = graph.viewState;
  if (viewState?.selectedNodeIds?.length) {
    const nextSel = viewState.selectedNodeIds.filter((id) => !spiralIds.has(id));
    if (nextSel.length !== viewState.selectedNodeIds.length) {
      viewState = {
        ...viewState,
        ...(nextSel.length > 0 ? { selectedNodeIds: nextSel } : { selectedNodeIds: undefined })
      };
    }
  }

  return {
    ...graph,
    nodes,
    connections,
    ...(automation !== undefined ? { automation } : {}),
    ...(viewState !== undefined ? { viewState } : {})
  };
}

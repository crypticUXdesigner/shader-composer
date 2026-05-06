/**
 * Migrates legacy `kaleidoscope-smooth` nodes into unified `kaleidoscope` with `kaleidEdgeSmooth`.
 */

import type { ParameterInputMode } from '../types/nodeSpec';
import type { Connection, NodeGraph, NodeInstance } from './types';

const LEGACY_TYPE = 'kaleidoscope-smooth';
const TARGET_TYPE = 'kaleidoscope';

/** Old kaleidoscope-smooth param -> kaleidoscope param */
const PARAM_MAP: Record<string, string> = {
  kaleidSmoothCenterX: 'kaleidCenterX',
  kaleidSmoothCenterY: 'kaleidCenterY',
  kaleidSmoothSegments: 'kaleidSegments',
  kaleidSmoothRotation: 'kaleidRotation',
  kaleidSmoothEdge: 'kaleidEdgeSmooth',
};

function migrateNode(node: NodeInstance): NodeInstance {
  if (node.type !== LEGACY_TYPE) return node;

  const nextParams: Record<string, unknown> = {};
  const oldParams = node.parameters ?? {};

  for (const [k, v] of Object.entries(oldParams)) {
    const nk = PARAM_MAP[k];
    if (nk) nextParams[nk] = v;
    else nextParams[k] = v;
  }

  const nextInputModes: Record<string, ParameterInputMode> | undefined = node.parameterInputModes
    ? { ...node.parameterInputModes }
    : undefined;
  if (nextInputModes) {
    for (const [from, to] of Object.entries(PARAM_MAP)) {
      if (from in nextInputModes && !(to in nextInputModes)) {
        nextInputModes[to] = nextInputModes[from];
      }
      delete nextInputModes[from];
    }
  }

  return {
    ...node,
    type: TARGET_TYPE,
    parameters: nextParams as NodeInstance['parameters'],
    ...(nextInputModes && Object.keys(nextInputModes).length > 0
      ? { parameterInputModes: nextInputModes }
      : {}),
  };
}

export function hasLegacyKaleidoscopeSmoothNodes(graph: NodeGraph): boolean {
  return graph.nodes.some((n) => n.type === LEGACY_TYPE);
}

export function migrateKaleidoscopeSmooth(graph: NodeGraph): NodeGraph {
  if (!hasLegacyKaleidoscopeSmoothNodes(graph)) return graph;

  const legacyIds = new Set(
    graph.nodes.filter((n) => n.type === LEGACY_TYPE).map((n) => n.id)
  );

  const nodes = graph.nodes.map((n) => migrateNode(n));

  const connections: Connection[] = graph.connections.map((c) => {
    if (!legacyIds.has(c.targetNodeId) || !c.targetParameter) return c;
    const mapped = PARAM_MAP[c.targetParameter];
    if (!mapped) return c;
    return { ...c, targetParameter: mapped };
  });

  const automation =
    graph.automation == null
      ? undefined
      : {
          ...graph.automation,
          lanes: graph.automation.lanes.map((lane) => {
            if (!legacyIds.has(lane.nodeId)) return lane;
            const mapped = PARAM_MAP[lane.paramName];
            if (!mapped) return lane;
            return { ...lane, paramName: mapped };
          }),
        };

  return { ...graph, nodes, connections, ...(automation !== undefined && { automation }) };
}

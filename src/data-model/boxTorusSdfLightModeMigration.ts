/**
 * box-torus-sdf: legacy `lightType` (int toggle) → `mode` (dropdown parity with lighting-shading labels).
 */

import type { ParameterInputMode } from '../types/nodeSpec';
import type { AutomationLane, Connection, NodeGraph, NodeInstance } from './types';

const NODE_TYPE = 'box-torus-sdf';
const LEGACY = 'lightType' as const;
const NEXT = 'mode' as const;

function migrateNode(node: NodeInstance): NodeInstance {
  if (node.type !== NODE_TYPE) return node;

  const params: Record<string, unknown> = node.parameters ? { ...node.parameters } : {};

  if (Object.prototype.hasOwnProperty.call(params, LEGACY) && !Object.prototype.hasOwnProperty.call(params, NEXT)) {
    params[NEXT] = params[LEGACY];
  }
  delete params[LEGACY];

  let parameterInputModes: Record<string, ParameterInputMode> | undefined = node.parameterInputModes
    ? { ...node.parameterInputModes }
    : undefined;
  if (parameterInputModes) {
    if (
      Object.prototype.hasOwnProperty.call(parameterInputModes, LEGACY) &&
      !Object.prototype.hasOwnProperty.call(parameterInputModes, NEXT)
    ) {
      parameterInputModes[NEXT] = parameterInputModes[LEGACY];
    }
    delete parameterInputModes[LEGACY];
    if (Object.keys(parameterInputModes).length === 0) {
      parameterInputModes = undefined;
    }
  }

  const next: NodeInstance = { ...node, parameters: params as NodeInstance['parameters'] };
  if (parameterInputModes !== undefined) {
    next.parameterInputModes = parameterInputModes;
  } else if (node.parameterInputModes !== undefined) {
    delete next.parameterInputModes;
  }
  return next;
}

export function migrateBoxTorusSdfLightMode(graph: NodeGraph): NodeGraph {
  const ids = new Set(graph.nodes.filter((n) => n.type === NODE_TYPE).map((n) => n.id));
  if (ids.size === 0) return graph;

  const nodes = graph.nodes.map(migrateNode);

  const connections: Connection[] = graph.connections.map((c) => {
    if (!c.targetParameter || !ids.has(c.targetNodeId)) return c;
    if (c.targetParameter === LEGACY) return { ...c, targetParameter: NEXT };
    return c;
  });

  let automation = graph.automation;
  if (automation) {
    const lanes: AutomationLane[] = automation.lanes.map((lane) => {
      if (!ids.has(lane.nodeId)) return lane;
      if (lane.paramName === LEGACY) return { ...lane, paramName: NEXT };
      return lane;
    });
    automation = { ...automation, lanes };
  }

  return { ...graph, nodes, connections, ...(automation !== undefined && { automation }) };
}

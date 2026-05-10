/**
 * Speckle-grain node: fold legacy UV `particleScale` into `particleCellSize` so one spacing control
 * matches shader math (`floor(uv / cell)` — spacing sets density; spot radius is separate).
 */

import type { ParameterInputMode } from '../types/nodeSpec';
import type { AutomationLane, Connection, NodeGraph, NodeInstance } from './types';

const LEGACY_DEFAULT_SCALE = 2.0;
const LEGACY_DEFAULT_CELL = 0.5;

function migrateNode(node: NodeInstance): NodeInstance {
  if (node.type !== 'particle-system') return node;

  const params: Record<string, unknown> = node.parameters ? { ...node.parameters } : {};
  if (!Object.prototype.hasOwnProperty.call(params, 'particleScale')) {
    return node;
  }

  const scaleRaw = params.particleScale;
  const scale =
    typeof scaleRaw === 'number' && Number.isFinite(scaleRaw) && scaleRaw > 0
      ? scaleRaw
      : LEGACY_DEFAULT_SCALE;

  const cellRaw = params.particleCellSize;
  const cell =
    typeof cellRaw === 'number' && Number.isFinite(cellRaw) && cellRaw > 0
      ? cellRaw
      : LEGACY_DEFAULT_CELL;

  params.particleCellSize = cell / scale;
  delete params.particleScale;

  let parameterInputModes: Record<string, ParameterInputMode> | undefined = node.parameterInputModes
    ? { ...node.parameterInputModes }
    : undefined;
  if (parameterInputModes && Object.prototype.hasOwnProperty.call(parameterInputModes, 'particleScale')) {
    delete parameterInputModes.particleScale;
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

export function migrateParticleSystemFoldScale(graph: NodeGraph): NodeGraph {
  const psIds = new Set(graph.nodes.filter((n) => n.type === 'particle-system').map((n) => n.id));
  if (psIds.size === 0) return graph;

  const nodes = graph.nodes.map(migrateNode);

  const connections: Connection[] = graph.connections.filter((c) => {
    if (!c.targetParameter || !psIds.has(c.targetNodeId)) return true;
    return c.targetParameter !== 'particleScale';
  });

  let automation = graph.automation;
  if (automation) {
    const lanes: AutomationLane[] = automation.lanes.filter((lane) => {
      if (!psIds.has(lane.nodeId)) return true;
      return lane.paramName !== 'particleScale';
    });
    automation = { ...automation, lanes };
  }

  return { ...graph, nodes, connections, ...(automation !== undefined && { automation }) };
}

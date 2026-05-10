/**
 * Migrates legacy `streak` nodes from `streakAngle` (radians) to `streakAngleDeg` (degrees, 0–360).
 */

import type { ParameterInputMode } from '../types/nodeSpec';
import type { AutomationLane, Connection, NodeGraph, NodeInstance } from './types';

const RAD_TO_DEG = 180 / Math.PI;

function migrateParameters(node: NodeInstance): NodeInstance['parameters'] {
  if (node.type !== 'streak') return node.parameters;

  const params: Record<string, unknown> = node.parameters ? { ...node.parameters } : {};

  const hasLegacy = Object.prototype.hasOwnProperty.call(params, 'streakAngle');
  const hasNew = Object.prototype.hasOwnProperty.call(params, 'streakAngleDeg');

  if (hasLegacy && !hasNew) {
    const raw = params.streakAngle;
    const rad = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
    params.streakAngleDeg = rad * RAD_TO_DEG;
  }
  if (hasLegacy) {
    delete params.streakAngle;
  }

  return params as NodeInstance['parameters'];
}

function migrateInputModes(
  node: NodeInstance
): Record<string, ParameterInputMode> | undefined {
  if (node.type !== 'streak' || !node.parameterInputModes) return undefined;

  const modes: Record<string, ParameterInputMode> = { ...node.parameterInputModes };
  if (
    Object.prototype.hasOwnProperty.call(modes, 'streakAngle') &&
    !Object.prototype.hasOwnProperty.call(modes, 'streakAngleDeg')
  ) {
    modes.streakAngleDeg = modes.streakAngle;
  }
  delete modes.streakAngle;
  return Object.keys(modes).length > 0 ? modes : undefined;
}

function migrateNode(node: NodeInstance): NodeInstance {
  if (node.type !== 'streak') return node;

  const parameters = migrateParameters(node);
  const parameterInputModes = migrateInputModes({
    ...node,
    parameters
  });

  const next: NodeInstance = { ...node, parameters };
  if (parameterInputModes !== undefined) {
    next.parameterInputModes = parameterInputModes;
  } else if (node.parameterInputModes !== undefined) {
    delete next.parameterInputModes;
  }
  return next;
}

function migrateStreakAutomationLaneRadiansToDegrees(lane: AutomationLane): AutomationLane {
  if (lane.paramName !== 'streakAngle') return lane;
  return {
    ...lane,
    paramName: 'streakAngleDeg',
    regions: lane.regions.map((region) => ({
      ...region,
      curve: {
        ...region.curve,
        keyframes: region.curve.keyframes.map((kf) => ({
          ...kf,
          value:
            typeof kf.value === 'number' && Number.isFinite(kf.value) ? kf.value * RAD_TO_DEG : kf.value
        }))
      }
    }))
  };
}

export function migrateStreakNodeAngleToDegrees(graph: NodeGraph): NodeGraph {
  const streakIds = new Set(graph.nodes.filter((n) => n.type === 'streak').map((n) => n.id));
  if (streakIds.size === 0) return graph;

  const nodes = graph.nodes.map(migrateNode);

  const connections: Connection[] = graph.connections.map((c) => {
    if (!c.targetParameter || !streakIds.has(c.targetNodeId)) return c;
    if (c.targetParameter === 'streakAngle') {
      return { ...c, targetParameter: 'streakAngleDeg' };
    }
    return c;
  });

  let automation = graph.automation;
  if (automation) {
    const lanes: AutomationLane[] = automation.lanes.map((lane) => {
      if (!streakIds.has(lane.nodeId)) return lane;
      return migrateStreakAutomationLaneRadiansToDegrees(lane);
    });
    automation = { ...automation, lanes };
  }

  return { ...graph, nodes, connections, ...(automation !== undefined && { automation }) };
}

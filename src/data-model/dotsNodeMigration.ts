/**
 * Dots node legacy graph migration:
 * - `dotsFalloff` → `dotsFeather`
 * - `dotsSpacing` (lattice period, pre–gap semantics) → `dotsGap` (edge-to-edge) + cell-feather → UV-feather
 */

import type { ParameterInputMode } from '../types/nodeSpec';
import type { AutomationLane, Connection, NodeGraph, NodeInstance } from './types';

const MIN_GAP = 1e-4;
const DEFAULT_DOT_SIZE = 0.03;

function migrateNode(node: NodeInstance): NodeInstance {
  if (node.type !== 'dots') return node;

  const params: Record<string, unknown> = node.parameters ? { ...node.parameters } : {};

  if (
    Object.prototype.hasOwnProperty.call(params, 'dotsFalloff') &&
    !Object.prototype.hasOwnProperty.call(params, 'dotsFeather')
  ) {
    params.dotsFeather = params.dotsFalloff;
  }
  delete params.dotsFalloff;

  const hadLegacyPeriod =
    Object.prototype.hasOwnProperty.call(params, 'dotsSpacing') &&
    !Object.prototype.hasOwnProperty.call(params, 'dotsGap');

  if (hadLegacyPeriod) {
    const period = typeof params.dotsSpacing === 'number' ? params.dotsSpacing : DEFAULT_DOT_SIZE * 3;
    const r =
      typeof params.dotsSize === 'number' && Number.isFinite(params.dotsSize)
        ? params.dotsSize
        : DEFAULT_DOT_SIZE;

    params.dotsGap = Math.max(MIN_GAP, period - 2.0 * r);

    if (typeof params.dotsFeather === 'number' && Number.isFinite(params.dotsFeather)) {
      params.dotsFeather = params.dotsFeather * period;
    }
    delete params.dotsSpacing;
  } else if (Object.prototype.hasOwnProperty.call(params, 'dotsSpacing')) {
    delete params.dotsSpacing;
  }

  let parameterInputModes: Record<string, ParameterInputMode> | undefined = node.parameterInputModes
    ? { ...node.parameterInputModes }
    : undefined;
  if (parameterInputModes) {
    if (
      Object.prototype.hasOwnProperty.call(parameterInputModes, 'dotsFalloff') &&
      !Object.prototype.hasOwnProperty.call(parameterInputModes, 'dotsFeather')
    ) {
      parameterInputModes.dotsFeather = parameterInputModes.dotsFalloff;
    }
    delete parameterInputModes.dotsFalloff;

    if (
      Object.prototype.hasOwnProperty.call(parameterInputModes, 'dotsSpacing') &&
      !Object.prototype.hasOwnProperty.call(parameterInputModes, 'dotsGap')
    ) {
      parameterInputModes.dotsGap = parameterInputModes.dotsSpacing;
    }
    delete parameterInputModes.dotsSpacing;
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

export function migrateDotsNodeParameterNames(graph: NodeGraph): NodeGraph {
  const dotsIds = new Set(graph.nodes.filter((n) => n.type === 'dots').map((n) => n.id));
  if (dotsIds.size === 0) return graph;

  const nodes = graph.nodes.map(migrateNode);

  const connections: Connection[] = graph.connections.map((c) => {
    if (!c.targetParameter || !dotsIds.has(c.targetNodeId)) return c;
    if (c.targetParameter === 'dotsFalloff') return { ...c, targetParameter: 'dotsFeather' };
    if (c.targetParameter === 'dotsSpacing') return { ...c, targetParameter: 'dotsGap' };
    return c;
  });

  let automation = graph.automation;
  if (automation) {
    const lanes: AutomationLane[] = automation.lanes.map((lane) => {
      if (!dotsIds.has(lane.nodeId)) return lane;
      if (lane.paramName === 'dotsFalloff') return { ...lane, paramName: 'dotsFeather' };
      if (lane.paramName === 'dotsSpacing') return { ...lane, paramName: 'dotsGap' };
      return lane;
    });
    automation = { ...automation, lanes };
  }

  return { ...graph, nodes, connections, ...(automation !== undefined && { automation }) };
}

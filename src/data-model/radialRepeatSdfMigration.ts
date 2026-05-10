/**
 * radial-repeat-sdf: legacy `period` + `halfPeriod` → `shellSpacing` + `ringPhase`
 * (normalized offset in [0, 1]; shader uses halfOffset = ringPhase * shellSpacing).
 */

import type { ParameterInputMode } from '../types/nodeSpec';
import type { AutomationLane, Connection, NodeGraph, NodeInstance } from './types';

const NODE_TYPE = 'radial-repeat-sdf' as const;

const LEGACY_PERIOD = 'period' as const;
const LEGACY_HALF = 'halfPeriod' as const;
const SPACING = 'shellSpacing' as const;
const PHASE = 'ringPhase' as const;

const MIN_SPACING = 1e-6;

function clampPhase(half: number, spacing: number): number {
  const s = Math.max(spacing, MIN_SPACING);
  return Math.min(1, Math.max(0, half / s));
}

function migrateNodeParameters(node: NodeInstance): NodeInstance {
  if (node.type !== NODE_TYPE) return node;

  const src = node.parameters ?? {};
  const hasLegacy =
    Object.prototype.hasOwnProperty.call(src, LEGACY_PERIOD) ||
    Object.prototype.hasOwnProperty.call(src, LEGACY_HALF);

  if (!hasLegacy) {
    return node;
  }

  const periodVal = typeof src[LEGACY_PERIOD] === 'number' ? src[LEGACY_PERIOD] : 1.0;
  const spacing = periodVal;
  const halfVal = typeof src[LEGACY_HALF] === 'number' ? src[LEGACY_HALF] : 0.5;

  const params: Record<string, unknown> = { ...src };
  params[SPACING] = spacing;
  params[PHASE] = clampPhase(halfVal, spacing);
  delete params[LEGACY_PERIOD];
  delete params[LEGACY_HALF];

  let parameterInputModes: Record<string, ParameterInputMode> | undefined = node.parameterInputModes
    ? { ...node.parameterInputModes }
    : undefined;
  if (parameterInputModes) {
    if (
      Object.prototype.hasOwnProperty.call(parameterInputModes, LEGACY_PERIOD) &&
      !Object.prototype.hasOwnProperty.call(parameterInputModes, SPACING)
    ) {
      parameterInputModes[SPACING] = parameterInputModes[LEGACY_PERIOD];
    }
    delete parameterInputModes[LEGACY_PERIOD];

    if (
      Object.prototype.hasOwnProperty.call(parameterInputModes, LEGACY_HALF) &&
      !Object.prototype.hasOwnProperty.call(parameterInputModes, PHASE)
    ) {
      parameterInputModes[PHASE] = parameterInputModes[LEGACY_HALF];
    }
    delete parameterInputModes[LEGACY_HALF];

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

function migrateHalfPeriodAutomationLane(lane: AutomationLane, divisor: number): AutomationLane {
  if (lane.paramName !== LEGACY_HALF) return lane;
  const d = Math.max(divisor, MIN_SPACING);
  return {
    ...lane,
    paramName: PHASE,
    regions: lane.regions.map((region) => ({
      ...region,
      curve: {
        ...region.curve,
        keyframes: region.curve.keyframes.map((kf) => ({
          ...kf,
          value: clampPhase(kf.value, d),
        })),
      },
    })),
  };
}

function migratePeriodAutomationLane(lane: AutomationLane): AutomationLane {
  if (lane.paramName !== LEGACY_PERIOD) return lane;
  return { ...lane, paramName: SPACING };
}

export function migrateRadialRepeatSdfParameters(graph: NodeGraph): NodeGraph {
  const targetIds = new Set(graph.nodes.filter((n) => n.type === NODE_TYPE).map((n) => n.id));
  if (targetIds.size === 0) return graph;

  const nodes = graph.nodes.map(migrateNodeParameters);

  const spacingByNodeId = new Map<string, number>();
  for (const n of nodes) {
    if (n.type !== NODE_TYPE) continue;
    const raw = n.parameters?.[SPACING];
    const spacing = typeof raw === 'number' ? raw : 1.0;
    spacingByNodeId.set(n.id, Math.max(spacing, MIN_SPACING));
  }

  const connections: Connection[] = graph.connections.map((c) => {
    if (!c.targetParameter || !targetIds.has(c.targetNodeId)) return c;
    if (c.targetParameter === LEGACY_PERIOD) return { ...c, targetParameter: SPACING };
    if (c.targetParameter === LEGACY_HALF) return { ...c, targetParameter: PHASE };
    return c;
  });

  let automation = graph.automation;
  if (automation) {
    const lanes: AutomationLane[] = automation.lanes.map((lane) => {
      if (!targetIds.has(lane.nodeId)) return lane;
      let work = lane;
      if (lane.paramName === LEGACY_PERIOD) work = migratePeriodAutomationLane(work);
      if (work.paramName === LEGACY_HALF) {
        const divisor = spacingByNodeId.get(lane.nodeId) ?? 1.0;
        work = migrateHalfPeriodAutomationLane(work, divisor);
      }
      return work;
    });
    automation = { ...automation, lanes };
  }

  return { ...graph, nodes, connections, ...(automation !== undefined && { automation }) };
}

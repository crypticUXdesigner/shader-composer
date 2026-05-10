/**
 * Migrates `infinite-zoom` nodes to the current parameter model:
 * - `infiniteZoomScale` / `infiniteZoomTimeSpeed` removed → `infiniteZoomStep`, `infiniteZoomDepth`, merged cycle length
 */

import type { ParameterInputMode } from '../types/nodeSpec';
import type { AutomationLane, NodeGraph, NodeInstance } from './types';

const REMOVED = new Set(['infiniteZoomScale', 'infiniteZoomTimeSpeed']);

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

/** Map legacy exponential base (1.01–20) to gentle step + depth. */
function mapLegacyScale(scale: number): { step: number; depth: number } {
  const u = clamp(scale, 1.01, 20);
  const t = Math.log(u) / Math.log(20);
  const step = clamp(1.015 + t * 0.165, 1.015, 1.18);
  const depth = clamp(0.25 + t * 0.65, 0.15, 1.0);
  return { step, depth };
}

function migrateNode(node: NodeInstance): NodeInstance {
  if (node.type !== 'infinite-zoom') return node;

  const params: Record<string, unknown> = node.parameters ? { ...node.parameters } : {};

  if (Object.prototype.hasOwnProperty.call(params, 'infiniteZoomScale')) {
    const raw = params.infiniteZoomScale;
    const legacyScale = typeof raw === 'number' && Number.isFinite(raw) ? raw : 4.0;
    const mapped = mapLegacyScale(legacyScale);
    if (!Object.prototype.hasOwnProperty.call(params, 'infiniteZoomStep')) {
      params.infiniteZoomStep = mapped.step;
    }
    if (!Object.prototype.hasOwnProperty.call(params, 'infiniteZoomDepth')) {
      params.infiniteZoomDepth = mapped.depth;
    }
    delete params.infiniteZoomScale;
  } else {
    if (!Object.prototype.hasOwnProperty.call(params, 'infiniteZoomStep')) {
      params.infiniteZoomStep = 1.06;
    }
    if (!Object.prototype.hasOwnProperty.call(params, 'infiniteZoomDepth')) {
      params.infiniteZoomDepth = 0.65;
    }
  }

  let loop =
    typeof params.infiniteZoomLoopPeriod === 'number' && Number.isFinite(params.infiniteZoomLoopPeriod)
      ? params.infiniteZoomLoopPeriod
      : 8.0;

  if (Object.prototype.hasOwnProperty.call(params, 'infiniteZoomTimeSpeed')) {
    const tsRaw = params.infiniteZoomTimeSpeed;
    const ts = typeof tsRaw === 'number' && Number.isFinite(tsRaw) ? Math.max(tsRaw, 1e-6) : 1.0;
    loop = loop / ts;
    delete params.infiniteZoomTimeSpeed;
  }

  params.infiniteZoomLoopPeriod = clamp(loop, 0.05, 120.0);

  let parameterInputModes: Record<string, ParameterInputMode> | undefined = node.parameterInputModes
    ? { ...node.parameterInputModes }
    : undefined;
  if (parameterInputModes) {
    for (const name of REMOVED) {
      delete parameterInputModes[name];
    }
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

export function migrateInfiniteZoom(graph: NodeGraph): NodeGraph {
  if (!graph.nodes.some((n) => n.type === 'infinite-zoom')) return graph;

  const ids = new Set(graph.nodes.filter((n) => n.type === 'infinite-zoom').map((n) => n.id));
  const nodes = graph.nodes.map(migrateNode);

  let connections = graph.connections.filter((c) => {
    if (!c.targetParameter || !ids.has(c.targetNodeId)) return true;
    return !REMOVED.has(c.targetParameter);
  });

  let automation = graph.automation;
  if (automation) {
    const lanes = automation.lanes.filter((lane: AutomationLane) => {
      if (!ids.has(lane.nodeId)) return true;
      return !REMOVED.has(lane.paramName);
    });
    automation = { ...automation, lanes };
  }

  return { ...graph, nodes, connections, ...(automation !== undefined && { automation }) };
}

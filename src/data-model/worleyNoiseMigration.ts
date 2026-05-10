/**
 * Migrates removed `worley-noise` nodes to `voronoi-noise` (UI: Cells) with parameters
 * chosen so drift animation matches the legacy Worley UV scroll (0.1, 0.15) × time.
 */

import type { ParameterInputMode } from '../types/nodeSpec';
import type { AutomationLane, Connection, NodeGraph, NodeInstance, ParameterValue } from './types';

const LEGACY_SCROLL_X = 0.1;
const LEGACY_SCROLL_Y = 0.15;
/** Degrees: direction of vec2(0.1, 0.15). */
export const LEGACY_WORLEY_DRIFT_DIRECTION_DEG =
  (Math.atan2(LEGACY_SCROLL_Y, LEGACY_SCROLL_X) * 180) / Math.PI;
/** Domain units per second along drift dir, matching legacy |vec2(0.1,0.15)|. */
export const LEGACY_WORLEY_DRIFT_AMOUNT = Math.hypot(LEGACY_SCROLL_X, LEGACY_SCROLL_Y);

const PARAM_REMAP: Record<string, string> = {
  worleyScale: 'voronoiScale',
  worleyJitter: 'voronoiJitter',
  worleyDistanceMetric: 'voronoiDistanceMetric',
  worleyOutputMode: 'voronoiOutputMode',
  worleyTimeSpeed: 'voronoiTimeSpeed',
  worleyTimeOffset: 'voronoiTimeOffset',
  worleyIntensity: 'voronoiIntensity'
};

function num(old: Record<string, ParameterValue>, key: string, fallback: number): number {
  const v = old[key];
  return typeof v === 'number' ? v : fallback;
}

function migrateWorleyNode(node: NodeInstance): NodeInstance {
  if (node.type !== 'worley-noise') return node;

  const old = node.parameters ?? {};
  const parameters: Record<string, ParameterValue> = {
    voronoiScale: num(old, 'worleyScale', 2.0),
    voronoiJitter: num(old, 'worleyJitter', 1.0),
    voronoiDistanceMetric: num(old, 'worleyDistanceMetric', 0),
    voronoiDriftDirection: LEGACY_WORLEY_DRIFT_DIRECTION_DEG,
    voronoiDriftAmount: LEGACY_WORLEY_DRIFT_AMOUNT,
    voronoiAnimationMode: 0,
    voronoiRotationSpeed: 30.0,
    voronoiTimeSpeed: num(old, 'worleyTimeSpeed', 0.5),
    voronoiIntensity: num(old, 'worleyIntensity', 0.5),
    voronoiTimeOffset: num(old, 'worleyTimeOffset', 0.0),
    voronoiOutputMode: num(old, 'worleyOutputMode', 0)
  };

  let parameterInputModes: Record<string, ParameterInputMode> | undefined;
  if (node.parameterInputModes) {
    parameterInputModes = {};
    for (const [k, mode] of Object.entries(node.parameterInputModes)) {
      const nk = PARAM_REMAP[k];
      if (nk) parameterInputModes[nk] = mode;
    }
    if (Object.keys(parameterInputModes).length === 0) {
      parameterInputModes = undefined;
    }
  }

  return {
    ...node,
    type: 'voronoi-noise',
    parameters,
    ...(parameterInputModes !== undefined ? { parameterInputModes } : {})
  };
}

export function migrateWorleyNoiseToVoronoi(graph: NodeGraph): NodeGraph {
  const worleyIds = new Set(graph.nodes.filter((n) => n.type === 'worley-noise').map((n) => n.id));
  if (worleyIds.size === 0) return graph;

  const nodes = graph.nodes.map(migrateWorleyNode);

  let connections: Connection[] = graph.connections.map((c) => {
    if (!c.targetParameter || !worleyIds.has(c.targetNodeId)) return c;
    const mapped = PARAM_REMAP[c.targetParameter];
    if (!mapped) return c;
    return { ...c, targetParameter: mapped };
  });

  let automation = graph.automation;
  if (automation) {
    const lanes: AutomationLane[] = [];
    const seenLaneKeys = new Set<string>();
    for (const lane of automation.lanes) {
      if (!worleyIds.has(lane.nodeId)) {
        lanes.push(lane);
        continue;
      }
      const paramName = PARAM_REMAP[lane.paramName] ?? lane.paramName;
      const key = `${lane.nodeId}:${paramName}`;
      if (seenLaneKeys.has(key)) continue;
      seenLaneKeys.add(key);
      lanes.push({ ...lane, paramName });
    }
    automation = { ...automation, lanes };
  }

  return { ...graph, nodes, connections, ...(automation !== undefined && { automation }) };
}

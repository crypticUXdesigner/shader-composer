/**
 * Path Drive: Ellipse preset removed — Orbit uses Aspect; presets 2–5 reindex to 1–4.
 */

import type { AutomationLane, NodeGraph, NodeInstance } from './types';

const NODE_TYPE = 'path-drive';

/** Legacy pathPreset (0–5) → current (0–4). */
export function migratePathDrivePresetValue(preset: number): number {
  const p = Math.round(preset);
  if (p <= 0) return 0;
  if (p === 1) return 0;
  return Math.min(4, Math.max(0, p - 1));
}

function migrateNode(node: NodeInstance): NodeInstance {
  if (node.type !== NODE_TYPE) return node;
  const raw = node.parameters.pathPreset;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return node;
  const next = migratePathDrivePresetValue(raw);
  if (next === Math.round(raw)) return node;
  return {
    ...node,
    parameters: { ...node.parameters, pathPreset: next },
  };
}

function migratePathPresetAutomationLane(lane: AutomationLane): AutomationLane {
  return {
    ...lane,
    regions: lane.regions.map((region) => ({
      ...region,
      curve: {
        ...region.curve,
        keyframes: region.curve.keyframes.map((kf) => ({
          ...kf,
          value:
            typeof kf.value === 'number' && Number.isFinite(kf.value)
              ? migratePathDrivePresetValue(kf.value)
              : kf.value,
        })),
      },
    })),
  };
}

export function migratePathDriveRemoveEllipse(graph: NodeGraph): NodeGraph {
  const pathDriveIds = new Set(graph.nodes.filter((n) => n.type === NODE_TYPE).map((n) => n.id));
  if (pathDriveIds.size === 0) return graph;

  const nodes = graph.nodes.map(migrateNode);

  let automation = graph.automation;
  if (automation) {
    const lanes = automation.lanes.map((lane) => {
      if (!pathDriveIds.has(lane.nodeId) || lane.paramName !== 'pathPreset') return lane;
      return migratePathPresetAutomationLane(lane);
    });
    automation = { ...automation, lanes };
  }

  return { ...graph, nodes, ...(automation !== undefined && { automation }) };
}

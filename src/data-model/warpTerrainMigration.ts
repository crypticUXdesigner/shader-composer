/**
 * Migrates legacy `warp-terrain` nodes: removes stale output/elevation/vignette
 * parameters and fills active shading parameters for older saved graphs.
 */

import type { ParameterInputMode } from '../types/nodeSpec';
import type { AutomationLane, Connection, NodeGraph, NodeInstance } from './types';

const REMOVED_WARP_TERRAIN_PARAMS = new Set([
  'warpVignetteStrength',
  'warpTerrainOutputMode',
  'warpTerrainElevationContrast'
]);

function migrateParameters(node: NodeInstance): {
  parameters: NodeInstance['parameters'];
  parameterInputModes?: Record<string, ParameterInputMode> | 'omit';
} {
  if (node.type !== 'warp-terrain') {
    return { parameters: node.parameters };
  }

  const old = node.parameters ?? {};
  const p: Record<string, unknown> = { ...old };
  for (const paramName of REMOVED_WARP_TERRAIN_PARAMS) {
    delete p[paramName];
  }

  if (typeof p.warpTerrainRidge !== 'number') {
    p.warpTerrainRidge = 1.0;
  }
  if (typeof p.warpTerrainBump !== 'number') {
    p.warpTerrainBump = 1.0;
  }

  let nextModes: Record<string, ParameterInputMode> | undefined = node.parameterInputModes
    ? { ...node.parameterInputModes }
    : undefined;
  if (nextModes) {
    for (const paramName of REMOVED_WARP_TERRAIN_PARAMS) {
      delete nextModes[paramName];
    }
    if (Object.keys(nextModes).length === 0) {
      nextModes = undefined;
    }
  }

  return {
    parameters: p as NodeInstance['parameters'],
    ...(nextModes !== undefined
      ? { parameterInputModes: nextModes }
      : node.parameterInputModes !== undefined
        ? { parameterInputModes: 'omit' as const }
        : {})
  };
}

function migrateNode(node: NodeInstance): NodeInstance {
  if (node.type !== 'warp-terrain') return node;
  const migrated = migrateParameters(node);
  const next: NodeInstance = { ...node, parameters: migrated.parameters };
  if ('parameterInputModes' in migrated) {
    const im = migrated.parameterInputModes;
    if (im === 'omit') {
      delete next.parameterInputModes;
    } else if (im !== undefined) {
      next.parameterInputModes = im;
    }
  }
  return next;
}

export function migrateWarpTerrain(graph: NodeGraph): NodeGraph {
  const has = graph.nodes.some((n) => n.type === 'warp-terrain');
  if (!has) return graph;

  const wtIds = new Set(graph.nodes.filter((n) => n.type === 'warp-terrain').map((n) => n.id));
  const nodes = graph.nodes.map(migrateNode);

  let connections: Connection[] = graph.connections.filter((c) => {
    if (!c.targetParameter || !wtIds.has(c.targetNodeId)) return true;
    return !REMOVED_WARP_TERRAIN_PARAMS.has(c.targetParameter);
  });

  let automation = graph.automation;
  if (automation) {
    const lanes: AutomationLane[] = automation.lanes.filter((lane) => {
      if (!wtIds.has(lane.nodeId)) return true;
      return !REMOVED_WARP_TERRAIN_PARAMS.has(lane.paramName);
    });
    automation = { ...automation, lanes };
  }

  return { ...graph, nodes, connections, ...(automation !== undefined && { automation }) };
}

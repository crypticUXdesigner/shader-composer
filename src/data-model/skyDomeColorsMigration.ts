/**
 * Sky Dome Colors Migration
 *
 * Migrates legacy `sky-dome` zenith/horizon RGB params (zenithR/G/B, horizonR/G/B)
 * to OKLCH (`zenithL/C/H`, `horizonL/C/H`) so the node can use the shared OKLCH
 * color picker UI.
 *
 * RGB channel parameter connections are remapped onto the corresponding OKLCH
 * channel (R→L, G→C, B→H) so existing graphs still load without hard validation
 * errors. The mapping isn't a true color-space conversion of the connected
 * signal — it preserves only continuity at load time and keeps the graph valid.
 */

import type { NodeGraph, NodeInstance, Connection } from './types';
import { linearRgbToOklch } from '../utils/colorConversion';
import type { ParameterInputMode } from '../types/nodeSpec';

const NODE_TYPE = 'sky-dome';

const CONNECTION_PARAM_MAP: Record<string, string> = {
  zenithR: 'zenithL',
  zenithG: 'zenithC',
  zenithB: 'zenithH',
  horizonR: 'horizonL',
  horizonG: 'horizonC',
  horizonB: 'horizonH',
};

function asNumber(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function migrateNode(node: NodeInstance): NodeInstance {
  if (node.type !== NODE_TYPE) return node;

  const params = node.parameters ?? {};
  const zR = asNumber(params.zenithR);
  const zG = asNumber(params.zenithG);
  const zB = asNumber(params.zenithB);

  const hR = asNumber(params.horizonR);
  const hG = asNumber(params.horizonG);
  const hB = asNumber(params.horizonB);

  const nextParams: Record<string, unknown> = { ...params };

  const hasZenithOklch = 'zenithL' in nextParams && 'zenithC' in nextParams && 'zenithH' in nextParams;
  const hasHorizonOklch = 'horizonL' in nextParams && 'horizonC' in nextParams && 'horizonH' in nextParams;

  if (!hasZenithOklch && zR != null && zG != null && zB != null) {
    const oklch = linearRgbToOklch(zR, zG, zB);
    nextParams.zenithL = oklch.l;
    nextParams.zenithC = oklch.c;
    nextParams.zenithH = oklch.h;
  }

  if (!hasHorizonOklch && hR != null && hG != null && hB != null) {
    const oklch = linearRgbToOklch(hR, hG, hB);
    nextParams.horizonL = oklch.l;
    nextParams.horizonC = oklch.c;
    nextParams.horizonH = oklch.h;
  }

  delete nextParams.zenithR;
  delete nextParams.zenithG;
  delete nextParams.zenithB;
  delete nextParams.horizonR;
  delete nextParams.horizonG;
  delete nextParams.horizonB;

  const nextInputModes: Record<string, ParameterInputMode> | undefined = node.parameterInputModes
    ? { ...node.parameterInputModes }
    : undefined;

  if (nextInputModes) {
    const channelMap: Array<[string, string]> = [
      ['zenithR', 'zenithL'],
      ['zenithG', 'zenithC'],
      ['zenithB', 'zenithH'],
      ['horizonR', 'horizonL'],
      ['horizonG', 'horizonC'],
      ['horizonB', 'horizonH'],
    ];
    for (const [from, to] of channelMap) {
      if (from in nextInputModes && !(to in nextInputModes)) {
        nextInputModes[to] = nextInputModes[from];
      }
      delete nextInputModes[from];
    }
  }

  return {
    ...node,
    parameters: nextParams as NodeInstance['parameters'],
    ...(nextInputModes && Object.keys(nextInputModes).length > 0
      ? { parameterInputModes: nextInputModes }
      : {}),
  };
}

/**
 * App-level migration for preset import / project load.
 * Idempotent: returns the same graph reference when no legacy sky-dome RGB
 * params or RGB-channel connections are present.
 */
export function migrateSkyDomeColors(graph: NodeGraph): NodeGraph {
  const skyDomeIds = new Set(graph.nodes.filter((n) => n.type === NODE_TYPE).map((n) => n.id));
  if (skyDomeIds.size === 0) return graph;

  const hasLegacyRgbParams = graph.nodes.some((n) => {
    if (n.type !== NODE_TYPE) return false;
    const p = n.parameters ?? {};
    return (
      'zenithR' in p ||
      'zenithG' in p ||
      'zenithB' in p ||
      'horizonR' in p ||
      'horizonG' in p ||
      'horizonB' in p
    );
  });

  const hasLegacyConnections = graph.connections.some((c) => {
    if (!skyDomeIds.has(c.targetNodeId)) return false;
    return c.targetParameter != null && c.targetParameter in CONNECTION_PARAM_MAP;
  });

  if (!hasLegacyRgbParams && !hasLegacyConnections) return graph;

  const nodes: NodeInstance[] = graph.nodes.map((n) => {
    if (!skyDomeIds.has(n.id)) return n;
    return migrateNode(n);
  });

  const connections: Connection[] = graph.connections.map((c) => {
    if (!skyDomeIds.has(c.targetNodeId)) return c;
    if (!c.targetParameter) return c;
    const mapped = CONNECTION_PARAM_MAP[c.targetParameter];
    if (!mapped) return c;
    return { ...c, targetParameter: mapped };
  });

  return {
    ...graph,
    nodes,
    connections,
  };
}

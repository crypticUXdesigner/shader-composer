/**
 * Iridescent Tunnel Colors Migration
 *
 * Migrates legacy `iridescent-tunnel` RGB params to OKLCH (`l/c/h`) params so the node
 * can use the shared OKLCH color picker UI (like Color Map Smooth).
 *
 * NOTE: Like other RGB→OKLCH migrations, RGB channel automation is not converted.
 */

import type { Connection, NodeGraph, NodeInstance } from './types';
import { linearRgbToOklch } from '../utils/colorConversion';
import type { ParameterInputMode } from '../types/nodeSpec';

const NODE_TYPE = 'iridescent-tunnel';

const CONNECTION_PARAM_MAP: Record<string, string> = {
  iridescentColorAR: 'colorAL',
  iridescentColorAG: 'colorAC',
  iridescentColorAB: 'colorAH',
  iridescentColorBR: 'colorBL',
  iridescentColorBG: 'colorBC',
  iridescentColorBB: 'colorBH',
};

function asNumber(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function migrateNode(node: NodeInstance): NodeInstance {
  if (node.type !== NODE_TYPE) return node;

  const params = node.parameters ?? {};
  const aR = asNumber(params.iridescentColorAR);
  const aG = asNumber(params.iridescentColorAG);
  const aB = asNumber(params.iridescentColorAB);
  const bR = asNumber(params.iridescentColorBR);
  const bG = asNumber(params.iridescentColorBG);
  const bB = asNumber(params.iridescentColorBB);

  const nextParams: Record<string, unknown> = { ...params };

  const hasA = 'colorAL' in nextParams && 'colorAC' in nextParams && 'colorAH' in nextParams;
  const hasB = 'colorBL' in nextParams && 'colorBC' in nextParams && 'colorBH' in nextParams;

  if (!hasA && aR != null && aG != null && aB != null) {
    const oklch = linearRgbToOklch(aR, aG, aB);
    nextParams.colorAL = oklch.l;
    nextParams.colorAC = oklch.c;
    nextParams.colorAH = oklch.h;
  }

  if (!hasB && bR != null && bG != null && bB != null) {
    const oklch = linearRgbToOklch(bR, bG, bB);
    nextParams.colorBL = oklch.l;
    nextParams.colorBC = oklch.c;
    nextParams.colorBH = oklch.h;
  }

  delete nextParams.iridescentColorAR;
  delete nextParams.iridescentColorAG;
  delete nextParams.iridescentColorAB;
  delete nextParams.iridescentColorBR;
  delete nextParams.iridescentColorBG;
  delete nextParams.iridescentColorBB;

  const nextInputModes: Record<string, ParameterInputMode> | undefined = node.parameterInputModes
    ? { ...node.parameterInputModes }
    : undefined;

  if (nextInputModes) {
    const channelMap: Array<[string, string]> = [
      ['iridescentColorAR', 'colorAL'],
      ['iridescentColorAG', 'colorAC'],
      ['iridescentColorAB', 'colorAH'],
      ['iridescentColorBR', 'colorBL'],
      ['iridescentColorBG', 'colorBC'],
      ['iridescentColorBB', 'colorBH'],
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
    ...(nextInputModes && Object.keys(nextInputModes).length > 0 ? { parameterInputModes: nextInputModes } : {}),
  };
}

export function migrateIridescentTunnelColors(graph: NodeGraph): NodeGraph {
  const nodeIds = new Set(graph.nodes.filter((n) => n.type === NODE_TYPE).map((n) => n.id));
  if (nodeIds.size === 0) return graph;

  const hasLegacyParams = graph.nodes.some((n) => {
    if (n.type !== NODE_TYPE) return false;
    const p = n.parameters ?? {};
    return (
      'iridescentColorAR' in p ||
      'iridescentColorAG' in p ||
      'iridescentColorAB' in p ||
      'iridescentColorBR' in p ||
      'iridescentColorBG' in p ||
      'iridescentColorBB' in p
    );
  });

  const hasLegacyConnections = graph.connections.some((c) => {
    if (!nodeIds.has(c.targetNodeId)) return false;
    return c.targetParameter != null && c.targetParameter in CONNECTION_PARAM_MAP;
  });

  if (!hasLegacyParams && !hasLegacyConnections) return graph;

  const nodes: NodeInstance[] = graph.nodes.map((n) => (nodeIds.has(n.id) ? migrateNode(n) : n));

  const connections: Connection[] = graph.connections.map((c) => {
    if (!nodeIds.has(c.targetNodeId)) return c;
    if (!c.targetParameter) return c;
    const mapped = CONNECTION_PARAM_MAP[c.targetParameter];
    if (!mapped) return c;
    return { ...c, targetParameter: mapped };
  });

  return { ...graph, nodes, connections };
}


/**
 * Inflated Icosahedron Background Colors Migration
 *
 * Migrates legacy `inflated-icosahedron` background RGB params
 * (`bgInnerR/G/B`, `bgOuterR/G/B`) to OKLCH (`bgInnerL/C/H`, `bgOuterL/C/H`)
 * so the node can use the shared OKLCH color picker UI.
 *
 * RGB channel parameter connections are remapped onto the corresponding OKLCH
 * channel (R→L, G→C, B→H) so existing graphs still load without hard
 * validation errors. The mapping isn't a true color-space conversion of the
 * connected signal — it preserves only continuity at load time and keeps the
 * graph valid.
 */

import type { NodeGraph, NodeInstance, Connection } from './types';
import { linearRgbToOklch } from '../utils/colorConversion';
import type { ParameterInputMode } from '../types/nodeSpec';

const NODE_TYPE = 'inflated-icosahedron';

const CONNECTION_PARAM_MAP: Record<string, string> = {
  bgInnerR: 'bgInnerL',
  bgInnerG: 'bgInnerC',
  bgInnerB: 'bgInnerH',
  bgOuterR: 'bgOuterL',
  bgOuterG: 'bgOuterC',
  bgOuterB: 'bgOuterH',
};

function asNumber(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function migrateNode(node: NodeInstance): NodeInstance {
  if (node.type !== NODE_TYPE) return node;

  const params = node.parameters ?? {};
  const inR = asNumber(params.bgInnerR);
  const inG = asNumber(params.bgInnerG);
  const inB = asNumber(params.bgInnerB);

  const outR = asNumber(params.bgOuterR);
  const outG = asNumber(params.bgOuterG);
  const outB = asNumber(params.bgOuterB);

  const nextParams: Record<string, unknown> = { ...params };

  const hasInnerOklch =
    'bgInnerL' in nextParams && 'bgInnerC' in nextParams && 'bgInnerH' in nextParams;
  const hasOuterOklch =
    'bgOuterL' in nextParams && 'bgOuterC' in nextParams && 'bgOuterH' in nextParams;

  if (!hasInnerOklch && inR != null && inG != null && inB != null) {
    const oklch = linearRgbToOklch(inR, inG, inB);
    nextParams.bgInnerL = oklch.l;
    nextParams.bgInnerC = oklch.c;
    nextParams.bgInnerH = oklch.h;
  }

  if (!hasOuterOklch && outR != null && outG != null && outB != null) {
    const oklch = linearRgbToOklch(outR, outG, outB);
    nextParams.bgOuterL = oklch.l;
    nextParams.bgOuterC = oklch.c;
    nextParams.bgOuterH = oklch.h;
  }

  delete nextParams.bgInnerR;
  delete nextParams.bgInnerG;
  delete nextParams.bgInnerB;
  delete nextParams.bgOuterR;
  delete nextParams.bgOuterG;
  delete nextParams.bgOuterB;

  const nextInputModes: Record<string, ParameterInputMode> | undefined = node.parameterInputModes
    ? { ...node.parameterInputModes }
    : undefined;

  if (nextInputModes) {
    const channelMap: Array<[string, string]> = [
      ['bgInnerR', 'bgInnerL'],
      ['bgInnerG', 'bgInnerC'],
      ['bgInnerB', 'bgInnerH'],
      ['bgOuterR', 'bgOuterL'],
      ['bgOuterG', 'bgOuterC'],
      ['bgOuterB', 'bgOuterH'],
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
 * Idempotent: returns the same graph reference when no legacy
 * inflated-icosahedron RGB background params or RGB-channel connections are
 * present.
 */
export function migrateInflatedIcosahedronColors(graph: NodeGraph): NodeGraph {
  const nodeIds = new Set(
    graph.nodes.filter((n) => n.type === NODE_TYPE).map((n) => n.id)
  );
  if (nodeIds.size === 0) return graph;

  const hasLegacyRgbParams = graph.nodes.some((n) => {
    if (n.type !== NODE_TYPE) return false;
    const p = n.parameters ?? {};
    return (
      'bgInnerR' in p ||
      'bgInnerG' in p ||
      'bgInnerB' in p ||
      'bgOuterR' in p ||
      'bgOuterG' in p ||
      'bgOuterB' in p
    );
  });

  const hasLegacyConnections = graph.connections.some((c) => {
    if (!nodeIds.has(c.targetNodeId)) return false;
    return c.targetParameter != null && c.targetParameter in CONNECTION_PARAM_MAP;
  });

  if (!hasLegacyRgbParams && !hasLegacyConnections) return graph;

  const nodes: NodeInstance[] = graph.nodes.map((n) => {
    if (!nodeIds.has(n.id)) return n;
    return migrateNode(n);
  });

  const connections: Connection[] = graph.connections.map((c) => {
    if (!nodeIds.has(c.targetNodeId)) return c;
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

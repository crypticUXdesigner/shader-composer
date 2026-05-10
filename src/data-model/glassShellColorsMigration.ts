/**
 * Glass Shell background / inner albedo RGB → OKLCH migration.
 *
 * Legacy parameters `innerColorR/G/B` and `bgR/G/B` become `innerL/C/H` and `bgL/C/H`.
 * Parameter wire targets are remapped R→L, G→C, B→H (continuity at load; not a color-space
 * transform of the signal).
 */

import type { NodeGraph, NodeInstance, Connection } from './types';
import { linearRgbToOklch } from '../utils/colorConversion';
import type { ParameterInputMode } from '../types/nodeSpec';

const NODE_TYPE = 'glass-shell';

const CONNECTION_PARAM_MAP: Record<string, string> = {
  innerColorR: 'innerL',
  innerColorG: 'innerC',
  innerColorB: 'innerH',
  bgR: 'bgL',
  bgG: 'bgC',
  bgB: 'bgH',
};

function asNumber(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function migrateNode(node: NodeInstance): NodeInstance {
  if (node.type !== NODE_TYPE) return node;

  const params = node.parameters ?? {};
  const innerR = asNumber(params.innerColorR);
  const innerG = asNumber(params.innerColorG);
  const innerB = asNumber(params.innerColorB);

  const bgR = asNumber(params.bgR);
  const bgG = asNumber(params.bgG);
  const bgB = asNumber(params.bgB);

  const nextParams: Record<string, unknown> = { ...params };

  const hasInnerOklch =
    'innerL' in nextParams && 'innerC' in nextParams && 'innerH' in nextParams;
  const hasBgOklch = 'bgL' in nextParams && 'bgC' in nextParams && 'bgH' in nextParams;

  if (!hasInnerOklch && innerR != null && innerG != null && innerB != null) {
    const oklch = linearRgbToOklch(innerR, innerG, innerB);
    nextParams.innerL = oklch.l;
    nextParams.innerC = oklch.c;
    nextParams.innerH = oklch.h;
  }

  if (!hasBgOklch && bgR != null && bgG != null && bgB != null) {
    const oklch = linearRgbToOklch(bgR, bgG, bgB);
    nextParams.bgL = oklch.l;
    nextParams.bgC = oklch.c;
    nextParams.bgH = oklch.h;
  }

  delete nextParams.innerColorR;
  delete nextParams.innerColorG;
  delete nextParams.innerColorB;
  delete nextParams.bgR;
  delete nextParams.bgG;
  delete nextParams.bgB;

  const nextInputModes: Record<string, ParameterInputMode> | undefined = node.parameterInputModes
    ? { ...node.parameterInputModes }
    : undefined;

  if (nextInputModes) {
    const channelMap: Array<[string, string]> = [
      ['innerColorR', 'innerL'],
      ['innerColorG', 'innerC'],
      ['innerColorB', 'innerH'],
      ['bgR', 'bgL'],
      ['bgG', 'bgC'],
      ['bgB', 'bgH'],
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

/** Preset/import: migrate legacy RGB; idempotent when no legacy keys remain. */
export function migrateGlassShellColors(graph: NodeGraph): NodeGraph {
  const nodeIds = new Set(graph.nodes.filter((n) => n.type === NODE_TYPE).map((n) => n.id));
  if (nodeIds.size === 0) return graph;

  const hasLegacyRgbParams = graph.nodes.some((n) => {
    if (n.type !== NODE_TYPE) return false;
    const p = n.parameters ?? {};
    return (
      'innerColorR' in p ||
      'innerColorG' in p ||
      'innerColorB' in p ||
      'bgR' in p ||
      'bgG' in p ||
      'bgB' in p
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

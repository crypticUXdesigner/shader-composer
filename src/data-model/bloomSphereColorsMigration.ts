/**
 * Bloom Sphere Colors Migration
 *
 * Migrates legacy `bloom-sphere` RGB params to OKLCH (`l/c/h`) params so the node
 * can use the shared OKLCH color picker UI.
 *
 * NOTE: RGB channel automation for `outerR/outerG/outerB` and `innerR/innerG/innerB`
 * is not converted (because it would require reconstituting an OKLCH triplet per time),
 * but the graph will still load without hard validation errors.
 */

import type { NodeGraph, NodeInstance, Connection } from './types';
import { linearRgbToOklch } from '../utils/colorConversion';
import type { ParameterInputMode } from '../types/nodeSpec';

const NODE_TYPE = 'bloom-sphere';

const CONNECTION_PARAM_MAP: Record<string, string> = {
  outerR: 'outerL',
  outerG: 'outerC',
  outerB: 'outerH',
  innerR: 'innerL',
  innerG: 'innerC',
  innerB: 'innerH',
  classicOuterGlowR: 'outerL',
  classicOuterGlowG: 'outerC',
  classicOuterGlowB: 'outerH',
  classicInnerGlowR: 'innerL',
  classicInnerGlowG: 'innerC',
  classicInnerGlowB: 'innerH',
};

function asNumber(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function migrateNode(node: NodeInstance): NodeInstance {
  if (node.type !== NODE_TYPE) return node;

  const params = node.parameters ?? {};
  const outR = asNumber(params.outerR);
  const outG = asNumber(params.outerG);
  const outB = asNumber(params.outerB);

  const inR = asNumber(params.innerR);
  const inG = asNumber(params.innerG);
  const inB = asNumber(params.innerB);

  const classicOutR = asNumber(params.classicOuterGlowR);
  const classicOutG = asNumber(params.classicOuterGlowG);
  const classicOutB = asNumber(params.classicOuterGlowB);

  const classicInR = asNumber(params.classicInnerGlowR);
  const classicInG = asNumber(params.classicInnerGlowG);
  const classicInB = asNumber(params.classicInnerGlowB);

  const nextParams: Record<string, unknown> = { ...params };

  // Only compute OKLCH defaults when the OKLCH params are missing.
  const hasOuterOklch = 'outerL' in nextParams && 'outerC' in nextParams && 'outerH' in nextParams;
  const hasInnerOklch = 'innerL' in nextParams && 'innerC' in nextParams && 'innerH' in nextParams;

  if (!hasOuterOklch && outR != null && outG != null && outB != null) {
    const oklch = linearRgbToOklch(outR, outG, outB);
    nextParams.outerL = oklch.l;
    nextParams.outerC = oklch.c;
    nextParams.outerH = oklch.h;
  }

  if (!hasInnerOklch && inR != null && inG != null && inB != null) {
    const oklch = linearRgbToOklch(inR, inG, inB);
    nextParams.innerL = oklch.l;
    nextParams.innerC = oklch.c;
    nextParams.innerH = oklch.h;
  }

  if (!hasOuterOklch && classicOutR != null && classicOutG != null && classicOutB != null) {
    const oklch = linearRgbToOklch(classicOutR, classicOutG, classicOutB);
    nextParams.outerL = oklch.l;
    nextParams.outerC = oklch.c;
    nextParams.outerH = oklch.h;
  }

  if (!hasInnerOklch && classicInR != null && classicInG != null && classicInB != null) {
    const oklch = linearRgbToOklch(classicInR, classicInG, classicInB);
    nextParams.innerL = oklch.l;
    nextParams.innerC = oklch.c;
    nextParams.innerH = oklch.h;
  }

  // Remove legacy RGB params to avoid graph validation warnings and to make OKLCH the source of truth.
  delete nextParams.outerR;
  delete nextParams.outerG;
  delete nextParams.outerB;
  delete nextParams.innerR;
  delete nextParams.innerG;
  delete nextParams.innerB;
  delete nextParams.classicOuterGlowR;
  delete nextParams.classicOuterGlowG;
  delete nextParams.classicOuterGlowB;
  delete nextParams.classicInnerGlowR;
  delete nextParams.classicInnerGlowG;
  delete nextParams.classicInnerGlowB;

  // If parameterInputModes existed for RGB channels, map them to the corresponding OKLCH channel params.
  const nextInputModes: Record<string, ParameterInputMode> | undefined = node.parameterInputModes
    ? { ...node.parameterInputModes }
    : undefined;

  if (nextInputModes) {
    const channelMap: Array<[string, string]> = [
      ['outerR', 'outerL'],
      ['outerG', 'outerC'],
      ['outerB', 'outerH'],
      ['innerR', 'innerL'],
      ['innerG', 'innerC'],
      ['innerB', 'innerH'],
      ['classicOuterGlowR', 'outerL'],
      ['classicOuterGlowG', 'outerC'],
      ['classicOuterGlowB', 'outerH'],
      ['classicInnerGlowR', 'innerL'],
      ['classicInnerGlowG', 'innerC'],
      ['classicInnerGlowB', 'innerH'],
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
 * App-level migration for preset import/load.
 */
export function migrateBloomSphereColors(graph: NodeGraph): NodeGraph {
  const bloomSphereNodeIds = new Set(graph.nodes.filter((n) => n.type === NODE_TYPE).map((n) => n.id));
  if (bloomSphereNodeIds.size === 0) return graph;

  const hasLegacyChannelParams = graph.nodes.some((n) => {
    if (n.type !== NODE_TYPE) return false;
    const p = n.parameters ?? {};
    return (
      'outerR' in p ||
      'outerG' in p ||
      'outerB' in p ||
      'innerR' in p ||
      'innerG' in p ||
      'innerB' in p ||
      'classicOuterGlowR' in p ||
      'classicOuterGlowG' in p ||
      'classicOuterGlowB' in p ||
      'classicInnerGlowR' in p ||
      'classicInnerGlowG' in p ||
      'classicInnerGlowB' in p
    );
  });

  const hasLegacyConnections = graph.connections.some((c) => {
    if (!bloomSphereNodeIds.has(c.targetNodeId)) return false;
    return c.targetParameter != null && c.targetParameter in CONNECTION_PARAM_MAP;
  });

  if (!hasLegacyChannelParams && !hasLegacyConnections) return graph;

  const nodes: NodeInstance[] = graph.nodes.map((n) => {
    if (!bloomSphereNodeIds.has(n.id)) return n;
    return migrateNode(n);
  });

  // Rewrite parameter connections that were targeting legacy RGB channel params.
  const connections: Connection[] = graph.connections.map((c) => {
    if (!bloomSphereNodeIds.has(c.targetNodeId)) return c;
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


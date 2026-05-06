import type { ParameterInputMode } from '../types/nodeSpec';
import type { Connection, NodeGraph, NodeInstance } from './types';
import type { ParameterValue } from './types';

const LEGACY_BLOOM_TYPE = 'bloom-sphere-effect';
const TARGET_BLOOM_TYPE = 'bloom-sphere';

const LEGACY_STAR_TYPE = 'star-2d';
const TARGET_STAR_TYPE = 'star-shape-2d';

const LEGACY_SUPERELLIPSE_TYPE = 'superellipse';
const TARGET_SUPERELLIPSE_TYPE = 'shapes-2d';

const BLOOM_PARAM_MAP: Record<string, string> = {
  latticeCount: 'spotCount',
  spotSharpness: 'classicSpotSharpness',
  outerGlowR: 'classicOuterGlowR',
  outerGlowG: 'classicOuterGlowG',
  outerGlowB: 'classicOuterGlowB',
  innerGlowR: 'classicInnerGlowR',
  innerGlowG: 'classicInnerGlowG',
  innerGlowB: 'classicInnerGlowB',
};

const SUPERELLIPSE_PARAM_MAP: Record<string, string> = {
  superCenterX: 'centerX',
  superCenterY: 'centerY',
  superRadiusX: 'sizeX',
  superRadiusY: 'sizeY',
  superPower: 'superPower',
  superSoftness: 'softness',
  superIntensity: 'intensity',
};

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function migrateBloomSphereEffectNode(node: NodeInstance): NodeInstance {
  const oldParams = node.parameters ?? {};
  const nextParams: Record<string, ParameterValue> = { ...oldParams };

  // Map legacy params to new names where needed (keep any already-mapped keys).
  for (const [from, to] of Object.entries(BLOOM_PARAM_MAP)) {
    if (from in nextParams && !(to in nextParams)) {
      nextParams[to] = nextParams[from] as ParameterValue;
    }
    if (from in nextParams) delete nextParams[from];
  }

  // Force classic mode for migrated nodes.
  nextParams.mode = 1;

  return {
    ...node,
    type: TARGET_BLOOM_TYPE,
    parameters: nextParams,
  };
}

function migrateStar2dNode(node: NodeInstance): NodeInstance {
  const oldParams = node.parameters ?? {};
  const nextParams: Record<string, ParameterValue> = { ...oldParams };

  // Style: 0 = shape, 1 = starburst (see node spec).
  nextParams.style = 1;

  // star-2d roundness was [0..0.5]; unified param uses [0..1] and scales internally.
  if ('starRoundness' in nextParams) {
    const r = num(nextParams.starRoundness, 0);
    nextParams.starRoundness = Math.max(0, Math.min(1, r * 2));
  }

  // star-2d had no rotation; set default explicitly so the value is stable.
  if (!('starRotation' in nextParams)) {
    nextParams.starRotation = 0;
  }

  return {
    ...node,
    type: TARGET_STAR_TYPE,
    parameters: nextParams,
  };
}

function migrateSuperellipseNode(node: NodeInstance): NodeInstance {
  const oldParams = node.parameters ?? {};

  const radiusX = num(oldParams.superRadiusX, 0.3);
  const radiusY = num(oldParams.superRadiusY, 0.25);

  const nextParams: Record<string, ParameterValue> = {
    shapeType: 2,
    sizeX: radiusX * 2,
    sizeY: radiusY * 2,
    centerX: num(oldParams.superCenterX, 0),
    centerY: num(oldParams.superCenterY, 0),
    roundness: 0,
    softness: num(oldParams.superSoftness, 0.02),
    intensity: num(oldParams.superIntensity, 1.0),
    superPower: num(oldParams.superPower, 2.5),
  };

  return {
    ...node,
    type: TARGET_SUPERELLIPSE_TYPE,
    parameters: nextParams,
  };
}

function migrateNode(node: NodeInstance): NodeInstance {
  if (node.type === LEGACY_BLOOM_TYPE) return migrateBloomSphereEffectNode(node);
  if (node.type === LEGACY_STAR_TYPE) return migrateStar2dNode(node);
  if (node.type === LEGACY_SUPERELLIPSE_TYPE) return migrateSuperellipseNode(node);
  return node;
}

function migrateInputModes(
  node: NodeInstance,
  nodeIdSets: { bloom: Set<string>; superellipse: Set<string> }
): NodeInstance {
  if (!node.parameterInputModes) return node;

  const modes = { ...node.parameterInputModes };

  if (nodeIdSets.bloom.has(node.id)) {
    for (const [from, to] of Object.entries(BLOOM_PARAM_MAP)) {
      if (from in modes && !(to in modes)) {
        modes[to] = modes[from] as ParameterInputMode;
      }
      delete modes[from];
    }
  }

  if (nodeIdSets.superellipse.has(node.id)) {
    for (const [from, to] of Object.entries(SUPERELLIPSE_PARAM_MAP)) {
      if (from in modes && !(to in modes)) {
        modes[to] = modes[from] as ParameterInputMode;
      }
      delete modes[from];
    }
  }

  return Object.keys(modes).length > 0 ? { ...node, parameterInputModes: modes } : { ...node, parameterInputModes: undefined };
}

function migrateConnections(connections: Connection[], nodeIdSets: { bloom: Set<string>; superellipse: Set<string> }): Connection[] {
  return connections.map((c) => {
    if (!c.targetParameter) return c;

    if (nodeIdSets.bloom.has(c.targetNodeId)) {
      const mapped = BLOOM_PARAM_MAP[c.targetParameter];
      if (mapped) return { ...c, targetParameter: mapped };
    }

    if (nodeIdSets.superellipse.has(c.targetNodeId)) {
      const mapped = SUPERELLIPSE_PARAM_MAP[c.targetParameter];
      if (mapped) return { ...c, targetParameter: mapped };
    }

    return c;
  });
}

export function migrateShapesNodeMerges(graph: NodeGraph): NodeGraph {
  const bloomNodeIds = new Set(graph.nodes.filter((n) => n.type === LEGACY_BLOOM_TYPE).map((n) => n.id));
  const superellipseNodeIds = new Set(graph.nodes.filter((n) => n.type === LEGACY_SUPERELLIPSE_TYPE).map((n) => n.id));

  if (bloomNodeIds.size === 0 && superellipseNodeIds.size === 0 && !graph.nodes.some((n) => n.type === LEGACY_STAR_TYPE)) {
    return graph;
  }

  const nodeIdSets = { bloom: bloomNodeIds, superellipse: superellipseNodeIds };

  const nodes = graph.nodes.map((n) => migrateInputModes(migrateNode(n), nodeIdSets));
  const connections = migrateConnections(graph.connections, nodeIdSets);

  const automation =
    graph.automation == null
      ? undefined
      : {
          ...graph.automation,
          lanes: graph.automation.lanes.map((lane) => {
            if (nodeIdSets.bloom.has(lane.nodeId)) {
              const mapped = BLOOM_PARAM_MAP[lane.paramName];
              if (mapped) return { ...lane, paramName: mapped };
            }
            if (nodeIdSets.superellipse.has(lane.nodeId)) {
              const mapped = SUPERELLIPSE_PARAM_MAP[lane.paramName];
              if (mapped) return { ...lane, paramName: mapped };
            }
            return lane;
          }),
        };

  return { ...graph, nodes, connections, ...(automation !== undefined && { automation }) };
}


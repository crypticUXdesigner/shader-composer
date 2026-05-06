/**
 * Migrates `translate` and `directional-displace` into unified `displace` (mode + shared scale).
 */

import type { ParameterInputMode } from '../types/nodeSpec';
import type { Connection, NodeGraph, NodeInstance } from './types';

const TRANSLATE_TYPE = 'translate';
const DIRECTIONAL_TYPE = 'directional-displace';
const TARGET_TYPE = 'displace';

const TRANSLATE_PARAM_MAP: Record<string, string> = {
  x: 'offsetX',
  y: 'offsetY',
};

export function hasLegacyDisplace2dNodes(graph: NodeGraph): boolean {
  return graph.nodes.some((n) => n.type === TRANSLATE_TYPE || n.type === DIRECTIONAL_TYPE);
}

function migrateTranslateNode(node: NodeInstance): NodeInstance {
  const params = node.parameters ?? {};
  const nextParams: Record<string, unknown> = {
    displaceMode: 0,
    displaceScale: 1.0,
    offsetX: typeof params.x === 'number' ? params.x : 0.0,
    offsetY: typeof params.y === 'number' ? params.y : 0.0,
    directionalDisplaceAngle: 0.0,
    amount: 1.0,
  };

  const nextInputModes: Record<string, ParameterInputMode> | undefined = node.parameterInputModes
    ? {}
    : undefined;
  if (node.parameterInputModes && nextInputModes) {
    for (const [k, modeVal] of Object.entries(node.parameterInputModes)) {
      const nk = TRANSLATE_PARAM_MAP[k];
      if (nk && (modeVal === 'override' || modeVal === 'add' || modeVal === 'subtract' || modeVal === 'multiply')) {
        nextInputModes[nk] = modeVal;
      }
    }
  }

  return {
    ...node,
    type: TARGET_TYPE,
    parameters: nextParams as NodeInstance['parameters'],
    ...(nextInputModes && Object.keys(nextInputModes).length > 0
      ? { parameterInputModes: nextInputModes }
      : {}),
  };
}

const DIRECTIONAL_SCALE_FROM = 'directionalDisplaceScale';
const DIRECTIONAL_SCALE_TO = 'displaceScale';

function migrateDirectionalNode(node: NodeInstance): NodeInstance {
  const params = node.parameters ?? {};
  const scale =
    typeof params[DIRECTIONAL_SCALE_FROM] === 'number'
      ? (params[DIRECTIONAL_SCALE_FROM] as number)
      : typeof params.displaceScale === 'number'
        ? (params.displaceScale as number)
        : 1.0;

  const nextParams: Record<string, unknown> = {
    displaceMode: 1,
    displaceScale: scale,
    offsetX: 0.0,
    offsetY: 0.0,
    directionalDisplaceAngle:
      typeof params.directionalDisplaceAngle === 'number' ? params.directionalDisplaceAngle : 0.0,
    amount: typeof params.amount === 'number' ? params.amount : 1.0,
  };

  const nextInputModes: Record<string, ParameterInputMode> | undefined = node.parameterInputModes
    ? { ...node.parameterInputModes }
    : undefined;
  if (nextInputModes) {
    if (
      DIRECTIONAL_SCALE_FROM in nextInputModes &&
      !(DIRECTIONAL_SCALE_TO in nextInputModes)
    ) {
      nextInputModes[DIRECTIONAL_SCALE_TO] = nextInputModes[DIRECTIONAL_SCALE_FROM];
    }
    delete nextInputModes[DIRECTIONAL_SCALE_FROM];
  }

  return {
    ...node,
    type: TARGET_TYPE,
    parameters: nextParams as NodeInstance['parameters'],
    ...(nextInputModes && Object.keys(nextInputModes).length > 0
      ? { parameterInputModes: nextInputModes }
      : {}),
  };
}

export function migrateDisplace2dUnify(graph: NodeGraph): NodeGraph {
  if (!hasLegacyDisplace2dNodes(graph)) return graph;

  const legacyTranslateIds = new Set(
    graph.nodes.filter((n) => n.type === TRANSLATE_TYPE).map((n) => n.id)
  );
  const legacyDirectionalIds = new Set(
    graph.nodes.filter((n) => n.type === DIRECTIONAL_TYPE).map((n) => n.id)
  );

  const nodes = graph.nodes.map((n) => {
    if (n.type === TRANSLATE_TYPE) return migrateTranslateNode(n);
    if (n.type === DIRECTIONAL_TYPE) return migrateDirectionalNode(n);
    return n;
  });

  const connections: Connection[] = graph.connections.map((c) => {
    if (!c.targetParameter) return c;
    if (legacyTranslateIds.has(c.targetNodeId)) {
      const mapped = TRANSLATE_PARAM_MAP[c.targetParameter];
      if (!mapped) return c;
      return { ...c, targetParameter: mapped };
    }
    if (legacyDirectionalIds.has(c.targetNodeId) && c.targetParameter === DIRECTIONAL_SCALE_FROM) {
      return { ...c, targetParameter: DIRECTIONAL_SCALE_TO };
    }
    return c;
  });

  const automation =
    graph.automation == null
      ? undefined
      : {
          ...graph.automation,
          lanes: graph.automation.lanes.map((lane) => {
            if (legacyTranslateIds.has(lane.nodeId)) {
              const mapped = TRANSLATE_PARAM_MAP[lane.paramName];
              if (!mapped) return lane;
              return { ...lane, paramName: mapped };
            }
            if (legacyDirectionalIds.has(lane.nodeId) && lane.paramName === DIRECTIONAL_SCALE_FROM) {
              return { ...lane, paramName: DIRECTIONAL_SCALE_TO };
            }
            return lane;
          }),
        };

  return { ...graph, nodes, connections, ...(automation !== undefined && { automation }) };
}

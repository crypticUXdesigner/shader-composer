/**
 * Migrates `domain-repetition` nodes to the unified `brick-tiling` (UI name: "Tiling").
 *
 * domain-repetition:
 *   out = fract(in * scale + offset)
 *
 * brick-tiling (tiling):
 *   out = fract(in * brickScale + vec2(offsetX, brickOffsetY) + parityRow * brickOffsetX)
 *
 * For a pure "domain repetition" behavior, we migrate to brick-tiling with:
 *   brickOffsetX (brick stagger) = 0
 * and map:
 *   scaleX -> brickScaleX
 *   scaleY -> brickScaleY
 *   offsetX -> offsetX
 *   offsetY -> brickOffsetY
 */

import type { ParameterInputMode } from '../types/nodeSpec';
import type { Connection, NodeGraph, NodeInstance } from './types';

const SOURCE_TYPE = 'domain-repetition';
const TARGET_TYPE = 'brick-tiling';

const PARAM_MAP: Record<string, string> = {
  scaleX: 'brickScaleX',
  scaleY: 'brickScaleY',
  offsetX: 'offsetX',
  offsetY: 'brickOffsetY',
};

export function hasDomainRepetitionNodes(graph: NodeGraph): boolean {
  return graph.nodes.some((n) => n.type === SOURCE_TYPE);
}

function migrateNode(node: NodeInstance): NodeInstance {
  const params = node.parameters ?? {};

  const nextParams: Record<string, unknown> = {
    brickScaleX: typeof params.scaleX === 'number' ? params.scaleX : 3.0,
    brickScaleY: typeof params.scaleY === 'number' ? params.scaleY : 3.0,
    offsetX: typeof params.offsetX === 'number' ? params.offsetX : 0.0,
    brickOffsetY: typeof params.offsetY === 'number' ? params.offsetY : 0.0,
    brickOffsetX: 0.0,
  };

  const nextInputModes: Record<string, ParameterInputMode> | undefined = node.parameterInputModes
    ? {}
    : undefined;
  if (node.parameterInputModes && nextInputModes) {
    for (const [k, modeVal] of Object.entries(node.parameterInputModes)) {
      const nk = PARAM_MAP[k];
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

export function migrateDomainRepetitionToTiling(graph: NodeGraph): NodeGraph {
  if (!hasDomainRepetitionNodes(graph)) return graph;

  const migratedIds = new Set(graph.nodes.filter((n) => n.type === SOURCE_TYPE).map((n) => n.id));

  const nodes = graph.nodes.map((n) => (n.type === SOURCE_TYPE ? migrateNode(n) : n));

  const connections: Connection[] = graph.connections.map((c) => {
    if (!c.targetParameter) return c;
    if (!migratedIds.has(c.targetNodeId)) return c;
    const mapped = PARAM_MAP[c.targetParameter];
    if (!mapped) return c;
    return { ...c, targetParameter: mapped };
  });

  const automation =
    graph.automation == null
      ? undefined
      : {
          ...graph.automation,
          lanes: graph.automation.lanes.map((lane) => {
            if (!migratedIds.has(lane.nodeId)) return lane;
            const mapped = PARAM_MAP[lane.paramName];
            if (!mapped) return lane;
            return { ...lane, paramName: mapped };
          }),
        };

  return { ...graph, nodes, connections, ...(automation !== undefined && { automation }) };
}


import type { NodeGraph, NodeInstance, ParameterValue } from './types';

const LEGACY_STAR_TYPE = 'star-2d';
const TARGET_STAR_TYPE = 'star-shape-2d';

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
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

function migrateNode(node: NodeInstance): NodeInstance {
  if (node.type === LEGACY_STAR_TYPE) return migrateStar2dNode(node);
  return node;
}

export function migrateShapesNodeMerges(graph: NodeGraph): NodeGraph {
  if (!graph.nodes.some((n) => n.type === LEGACY_STAR_TYPE)) {
    return graph;
  }

  const nodes = graph.nodes.map((n) => migrateNode(n));
  return { ...graph, nodes };
}


/**
 * Automatic layered layout for Setup example mini graphs (DAG, left → right).
 * Falls back to a single-row order when the connection graph has a cycle or invalid refs.
 */

import type { SetupExampleGraph } from './ContextualHelpManager';

export interface MiniGraphLayoutMetrics {
  nodeWidth: number;
  nodeHeight: number;
  gapX: number;
  gapY: number;
  padding: number;
}

export interface MiniGraphLayoutResult {
  mode: 'layered' | 'linear-fallback';
  positions: Map<string, { x: number; y: number }>;
  totalWidth: number;
  totalHeight: number;
  /** Layer index per node (only meaningful when mode === 'layered'). */
  layerById: Map<string, number>;
  /**
   * Order within layer after sorting (for parallel-edge offsets).
   * Same layer + same rank → parallel outgoing/incoming stacks align.
   */
  orderInLayerById: Map<string, number>;
}

const defaultMetrics: MiniGraphLayoutMetrics = {
  nodeWidth: 72,
  nodeHeight: 60,
  gapX: 24,
  gapY: 24,
  padding: 0,
};

function buildIds(graph: SetupExampleGraph): Set<string> {
  return new Set(graph.nodes.map((n) => n.id));
}

/** Valid directed edges between known node ids (no self-loops). */
function buildAdjacency(
  graph: SetupExampleGraph,
  ids: Set<string>
): { preds: Map<string, string[]>; succs: Map<string, string[]> } {
  const preds = new Map<string, string[]>();
  const succs = new Map<string, string[]>();
  for (const id of ids) {
    preds.set(id, []);
    succs.set(id, []);
  }
  for (const c of graph.connections) {
    if (!ids.has(c.from) || !ids.has(c.to) || c.from === c.to) continue;
    preds.get(c.to)!.push(c.from);
    succs.get(c.from)!.push(c.to);
  }
  return { preds, succs };
}

/** Kahn topological sort; returns null if cycle or empty ids mismatch. */
function topologicalOrder(
  ids: Set<string>,
  preds: Map<string, string[]>,
  succs: Map<string, string[]>
): string[] | null {
  const inDegree = new Map<string, number>();
  for (const id of ids) {
    const ps = preds.get(id) ?? [];
    inDegree.set(id, ps.filter((p) => ids.has(p)).length);
  }
  const queue: string[] = [];
  for (const id of ids) {
    if ((inDegree.get(id) ?? 0) === 0) queue.push(id);
  }
  const out: string[] = [];
  while (queue.length) {
    const v = queue.shift()!;
    out.push(v);
    for (const w of succs.get(v) ?? []) {
      const next = (inDegree.get(w) ?? 0) - 1;
      inDegree.set(w, next);
      if (next === 0) queue.push(w);
    }
  }
  return out.length === ids.size ? out : null;
}

/** Longest-path layering: layer[v] = max(layer[u]+1); roots at 0. */
function computeLayers(
  topo: string[],
  preds: Map<string, string[]>
): Map<string, number> {
  const layer = new Map<string, number>();
  for (const v of topo) {
    const ps = preds.get(v) ?? [];
    let L = 0;
    for (const u of ps) {
      L = Math.max(L, (layer.get(u) ?? 0) + 1);
    }
    layer.set(v, L);
  }
  return layer;
}

function indexById(graph: SetupExampleGraph): Map<string, number> {
  const m = new Map<string, number>();
  graph.nodes.forEach((n, i) => m.set(n.id, i));
  return m;
}

/** Sort nodes inside each layer to reduce crossings (median of predecessor positions). */
function orderWithinLayers(
  ids: Set<string>,
  layer: Map<string, number>,
  preds: Map<string, string[]>,
  originalIndex: Map<string, number>
): Map<string, number> {
  const maxLayer = Math.max(0, ...[...layer.values()]);
  const byLayer: string[][] = [];
  for (let L = 0; L <= maxLayer; L++) byLayer[L] = [];
  for (const id of ids) {
    const L = layer.get(id) ?? 0;
    byLayer[L].push(id);
  }

  /** position within layer after sorting */
  const posInLayer = new Map<string, number>();

  for (let L = 0; L <= maxLayer; L++) {
    const nodes = byLayer[L];
    if (L === 0) {
      nodes.sort((a, b) => (originalIndex.get(a) ?? 0) - (originalIndex.get(b) ?? 0));
    } else {
      nodes.sort((a, b) => {
        const pa = preds.get(a) ?? [];
        const pb = preds.get(b) ?? [];
        const med = (predIds: string[], selfId: string) => {
          const positions = predIds
            .map((p) => posInLayer.get(p))
            .filter((x): x is number => x !== undefined);
          if (positions.length === 0) return originalIndex.get(selfId) ?? 0;
          positions.sort((x, y) => x - y);
          return positions[Math.floor((positions.length - 1) / 2)]!;
        };
        const ma = pa.length ? med(pa, a) : (originalIndex.get(a) ?? 0);
        const mb = pb.length ? med(pb, b) : (originalIndex.get(b) ?? 0);
        if (ma !== mb) return ma - mb;
        return (originalIndex.get(a) ?? 0) - (originalIndex.get(b) ?? 0);
      });
    }
    nodes.forEach((id, i) => posInLayer.set(id, i));
  }

  return posInLayer;
}

function columnContentHeight(
  count: number,
  nodeHeight: number,
  gapY: number
): number {
  if (count <= 0) return 0;
  return count * nodeHeight + (count - 1) * gapY;
}

/**
 * Computes pixel positions for mini-graph nodes.
 */
export function computeMiniGraphLayout(
  graph: SetupExampleGraph,
  metrics: MiniGraphLayoutMetrics = defaultMetrics
): MiniGraphLayoutResult {
  const { nodeWidth, nodeHeight, gapX, gapY, padding } = metrics;
  const ids = buildIds(graph);
  const originalIndex = indexById(graph);

  if (graph.nodes.length === 0) {
    return {
      mode: 'linear-fallback',
      positions: new Map(),
      totalWidth: 0,
      totalHeight: 0,
      layerById: new Map(),
      orderInLayerById: new Map(),
    };
  }

  const { preds, succs } = buildAdjacency(graph, ids);
  const topo = topologicalOrder(ids, preds, succs);

  if (!topo) {
    return linearFallback(graph, metrics);
  }

  const layer = computeLayers(topo, preds);
  const orderInLayer = orderWithinLayers(ids, layer, preds, originalIndex);

  const maxLayer = Math.max(0, ...[...layer.values()]);
  const byLayer: string[][] = Array.from({ length: maxLayer + 1 }, () => []);
  for (const id of ids) {
    byLayer[layer.get(id) ?? 0].push(id);
  }
  for (let L = 0; L <= maxLayer; L++) {
    byLayer[L].sort((a, b) => (orderInLayer.get(a) ?? 0) - (orderInLayer.get(b) ?? 0));
  }

  let totalHeight = padding * 2;
  for (let L = 0; L <= maxLayer; L++) {
    const h = columnContentHeight(byLayer[L].length, nodeHeight, gapY);
    totalHeight = Math.max(totalHeight, padding * 2 + h);
  }

  const totalWidth =
    padding * 2 + (maxLayer + 1) * nodeWidth + maxLayer * gapX;

  const positions = new Map<string, { x: number; y: number }>();

  /* Top-align every column so row 0 shares the same y across layers */
  const offsetY = padding;

  for (let L = 0; L <= maxLayer; L++) {
    const col = byLayer[L];
    const x = padding + L * (nodeWidth + gapX);
    col.forEach((id, row) => {
      positions.set(id, {
        x,
        y: offsetY + row * (nodeHeight + gapY),
      });
    });
  }

  return {
    mode: 'layered',
    positions,
    totalWidth,
    totalHeight,
    layerById: layer,
    orderInLayerById: orderInLayer,
  };
}

function linearFallback(
  graph: SetupExampleGraph,
  metrics: MiniGraphLayoutMetrics
): MiniGraphLayoutResult {
  const { nodeWidth, nodeHeight, gapX, padding } = metrics;
  const positions = new Map<string, { x: number; y: number }>();
  graph.nodes.forEach((node, i) => {
    positions.set(node.id, { x: padding + i * (nodeWidth + gapX), y: padding });
  });
  const n = graph.nodes.length;
  const totalWidth =
    n === 0 ? 0 : padding * 2 + n * nodeWidth + (n - 1) * gapX;
  const totalHeight = padding * 2 + nodeHeight;
  const layerById = new Map<string, number>();
  const orderInLayerById = new Map<string, number>();
  graph.nodes.forEach((node, i) => {
    layerById.set(node.id, i);
    orderInLayerById.set(node.id, 0);
  });
  return {
    mode: 'linear-fallback',
    positions,
    totalWidth,
    totalHeight,
    layerById,
    orderInLayerById,
  };
}

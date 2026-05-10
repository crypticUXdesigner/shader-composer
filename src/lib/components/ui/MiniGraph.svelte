<script lang="ts">
  /**
   * MiniGraph – generic read-only mini graph (nodes + edges) for Setup example visualization.
   * Layered DAG layout (left → right); cycles fall back to array-order row. Parallel edges are separated slightly.
   */
  import { NodeIconSvg } from './icon';
  import { getNodeIcon } from '../../../utils/nodeSpecUtils';
  import { getCategorySlug } from '../../../utils/cssTokens';
  import { computeMiniGraphLayout } from '../../../utils/miniGraphLayout';
  import type { SetupExampleGraph } from '../../../utils/ContextualHelpManager';
  import type { NodeSpec } from '../../../types/nodeSpec';

  /** Horizontal → vertical → horizontal wire with quarter-circle corners (SVG y grows downward). */
  function orthogonalRoundedWirePath(
    sx: number,
    sy: number,
    ex: number,
    ey: number,
    requestedR: number
  ): string {
    const EPS = 0.5;
    if (Math.abs(sy - ey) < EPS) {
      return `M ${sx} ${sy} L ${ex} ${ey}`;
    }
    if (ex <= sx + EPS) {
      return `M ${sx} ${sy} L ${ex} ${ey}`;
    }

    const midX = (sx + ex) / 2;
    const vertSpan = Math.abs(ey - sy);
    let R = Math.min(
      requestedR,
      (ex - sx) / 2 - 0.25,
      vertSpan / 2 - 0.25,
      midX - sx - 0.25,
      ex - midX - 0.25
    );
    R = Math.max(R, 0);

    if (R < 1.5) {
      return `M ${sx} ${sy} L ${midX} ${sy} L ${midX} ${ey} L ${ex} ${ey}`;
    }

    if (ey > sy) {
      return [
        `M ${sx} ${sy}`,
        `L ${midX - R} ${sy}`,
        `A ${R} ${R} 0 0 1 ${midX} ${sy + R}`,
        `L ${midX} ${ey - R}`,
        `A ${R} ${R} 0 0 1 ${midX + R} ${ey}`,
        `L ${ex} ${ey}`,
      ].join(' ');
    }

    return [
      `M ${sx} ${sy}`,
      `L ${midX - R} ${sy}`,
      `A ${R} ${R} 0 0 0 ${midX} ${sy - R}`,
      `L ${midX} ${ey + R}`,
      `A ${R} ${R} 0 0 0 ${midX + R} ${ey}`,
      `L ${ex} ${ey}`,
    ].join(' ');
  }

  interface Props {
    graph: SetupExampleGraph;
    nodeSpecs: Map<string, NodeSpec>;
  }

  let { graph, nodeSpecs }: Props = $props();

  /* Match CSS tokens --size-xl (60px), --size-lg (48px) so SVG layout and edges align */
  const NODE_WIDTH = 72;
  const NODE_HEIGHT = 60;
  const GAP = 24;
  const PADDING = 0;

  /** Unique SVG marker id when multiple MiniGraph instances exist on one page */
  const arrowMarkerId = `mini-graph-arrow-${Math.random().toString(36).slice(2, 11)}`;

  const layoutMetrics = {
    nodeWidth: NODE_WIDTH,
    nodeHeight: NODE_HEIGHT,
    gapX: GAP,
    gapY: GAP,
    padding: PADDING,
  };

  const layoutResult = $derived(computeMiniGraphLayout(graph, layoutMetrics));
  const nodePositions = $derived(layoutResult.positions);
  const totalWidth = $derived(layoutResult.totalWidth);
  const totalHeight = $derived(layoutResult.totalHeight);

  /**
   * Triangle tip → tail length along the wire. Path ends at targetEdgeX - MARKER_W so the marker
   * (anchored at tail refX=0) paints the tip flush on the node edge.
   */
  const PARALLEL_EDGE_SPREAD = 8;
  const CORNER_RADIUS = 6;
  const MARKER_W = 8;
  const MARKER_H = 6;

  const edgePaths = $derived.by(() => {
    const connections = graph.connections;
    const key = (c: (typeof connections)[number]) => `${c.from}\0${c.to}`;
    const buckets = new Map<string, (typeof connections)[number][]>();
    for (const c of connections) {
      const k = key(c);
      let arr = buckets.get(k);
      if (!arr) {
        arr = [];
        buckets.set(k, arr);
      }
      arr.push(c);
    }
    for (const arr of buckets.values()) {
      arr.sort(
        (a, b) =>
          a.fromPort.localeCompare(b.fromPort) || a.toPort.localeCompare(b.toPort)
      );
    }

    return connections.map((conn) => {
      const fromPos = nodePositions.get(conn.from);
      const toPos = nodePositions.get(conn.to);
      if (!fromPos || !toPos) return '';
      const group = buckets.get(key(conn))!;
      const parallel = group.length;
      const slot = group.indexOf(conn);
      const spread =
        parallel > 1 ? Math.min(PARALLEL_EDGE_SPREAD, (NODE_HEIGHT - 12) / parallel) : 0;
      const dy = parallel > 1 ? (slot - (parallel - 1) / 2) * spread : 0;

      const x1 = fromPos.x + NODE_WIDTH;
      const y1 = fromPos.y + NODE_HEIGHT / 2 + dy;
      const targetEdgeX = toPos.x;
      const y2 = toPos.y + NODE_HEIGHT / 2 + dy;
      const wireEndX = targetEdgeX - MARKER_W;
      return orthogonalRoundedWirePath(x1, y1, wireEndX, y2, CORNER_RADIUS);
    });
  });

  const visible = $derived(graph.nodes.length > 0);
</script>

{#if visible}
  <figure class="mini-graph" role="img" aria-label="Example graph">
    <svg
      class="svg"
      width={totalWidth}
      height={totalHeight}
      viewBox="0 0 {totalWidth} {totalHeight}"
      aria-hidden="true"
    >
      <defs>
        <marker
          id={arrowMarkerId}
          markerUnits="userSpaceOnUse"
          markerWidth={MARKER_W}
          markerHeight={MARKER_H}
          refX="0"
          refY={MARKER_H / 2}
          orient="auto"
          class="arrow-marker"
        >
          <path d={`M 0 0 L ${MARKER_W} ${MARKER_H / 2} L 0 ${MARKER_H} Z`} />
        </marker>
      </defs>
      <g class="nodes">
        {#each graph.nodes as node (node.id)}
          {@const pos = nodePositions.get(node.id)}
          {@const spec = nodeSpecs.get(node.type)}
          {#if pos}
            <g class="node-wrap" transform="translate({pos.x}, {pos.y})">
              <foreignObject x="0" y="0" width={NODE_WIDTH} height={NODE_HEIGHT}>
                <div
                  class="mini-graph-node node {spec ? getCategorySlug(spec.category) : 'default'}"
                  xmlns="http://www.w3.org/1999/xhtml"
                >
                  <div class="node-header">
                    <div class="icon-box">
                      <NodeIconSvg identifier={spec ? getNodeIcon(spec) : 'circle'} class="header-icon" />
                    </div>
                    <span class="label-text">{spec ? spec.displayName : node.type}</span>
                  </div>
                </div>
              </foreignObject>
            </g>
          {/if}
        {/each}
      </g>
      <g class="edges">
        {#each edgePaths as path}
          <path class="edge" d={path} fill="none" marker-end={`url(#${arrowMarkerId})`} />
        {/each}
      </g>
    </svg>
  </figure>
{/if}

<style>
  .mini-graph {
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: flex-start;

    .svg {
      display: block;
      overflow: visible;
    }

    .edges .edge {
      stroke: var(--color-gray-100);
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .arrow-marker path {
      fill: var(--color-gray-100);
    }

    /* Reuse node header colors from .node.{category}; only override size and layout */
    .mini-graph-node {
      width: var(--size-2xl);
      height: var(--size-xl);
      border-radius: var(--radius-xs);
      overflow: hidden;
      box-sizing: border-box;
      display: flex;
      align-items: stretch;
      padding: var(--pd-xs);

      .node-header {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--pd-2xs);
        width: 100%;
        min-height: 0;
        padding: 0;
        box-sizing: border-box;
        background: transparent;
      }

      .icon-box {
        width: 24px;
        height: 24px;
        min-width: 24px;
        min-height: 24px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      :global(.header-icon svg) {
        width: var(--icon-size-md);
        height: var(--icon-size-md);
      }

      .label-text {
        font-family: var(--font-sans);
        font-size: var(--text-xs, 12px);
        font-weight: var(--node-header-name-weight, 600);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        text-align: center;
        max-width: 100%;
      }
    }
  }
</style>

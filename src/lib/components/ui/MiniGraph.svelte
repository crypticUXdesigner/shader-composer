<script lang="ts">
  /**
   * MiniGraph – generic read-only mini graph (nodes + edges) for Setup example visualization.
   * Left-to-right layout; icon + label per node; SVG edges. No help or graph-store imports.
   */
  import { NodeIconSvg } from './icon';
  import { getNodeIcon } from '../../../utils/nodeSpecUtils';
  import { getCategorySlug } from '../../../utils/cssTokens';
  import type { SetupExampleGraph } from '../../../utils/ContextualHelpManager';
  import type { NodeSpec } from '../../../types/nodeSpec';

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

  const nodePositions = $derived.by(() => {
    const map = new Map<string, { x: number; y: number }>();
    graph.nodes.forEach((node, i) => {
      map.set(node.id, { x: PADDING + i * (NODE_WIDTH + GAP), y: PADDING });
    });
    return map;
  });

  /* Arrow marker length in same units as path; path stops this far from target so arrow tip hits node edge */
  const ARROW_LENGTH = 12;

  const edgePaths = $derived.by(() => {
    return graph.connections.map((conn) => {
      const fromPos = nodePositions.get(conn.from);
      const toPos = nodePositions.get(conn.to);
      if (!fromPos || !toPos) return '';
      const x1 = fromPos.x + NODE_WIDTH;
      const y1 = fromPos.y + NODE_HEIGHT / 2;
      const x2 = toPos.x;
      const y2 = toPos.y + NODE_HEIGHT / 2;
      /* End path early so arrowhead (drawn at path end) is not covered by target node */
      const x2End = x2 - ARROW_LENGTH;
      const cx = (x1 + x2End) / 2;
      return `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2End} ${y2}`;
    });
  });

  const totalWidth = $derived(
    graph.nodes.length === 0 ? 0 : PADDING * 2 + graph.nodes.length * NODE_WIDTH + (graph.nodes.length - 1) * GAP
  );
  const totalHeight = $derived(PADDING * 2 + NODE_HEIGHT);

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
          id="mini-graph-arrow"
          markerUnits="userSpaceOnUse"
          markerWidth="14"
          markerHeight="10"
          refX="0"
          refY="5"
          orient="auto"
          class="arrow-marker"
        >
          <path d="M 0 0 L 14 5 L 0 10 Z" />
        </marker>
      </defs>
      <g class="edges">
        {#each edgePaths as path}
          <path class="edge" d={path} fill="none" marker-end="url(#mini-graph-arrow)" />
        {/each}
      </g>
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
      stroke-width: 2.5;
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

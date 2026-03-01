<script lang="ts">
  /**
   * Scrollable results area: no-results message or grouped node sections.
   * Used only inside NodePanelContent. Exposes resultsEl for scroll-into-view.
   */
  import { NodeIconSvg } from '../ui';
  import { getCategoryDefaultIcon } from '../../../utils/nodeSpecUtils';
  import { getCategorySlug } from '../../../utils/cssTokens';
  import type { NodeSpec } from '../../../types/nodeSpec';
  import NodePanelSection from './NodePanelSection.svelte';
  import NodePanelItem from './NodePanelItem.svelte';

  type DisplayMode = 'list' | 'grid';

  interface Group {
    category: string;
    nodes: NodeSpec[];
  }

  interface SubgroupCount {
    subgroupSlug: string;
    count: number;
  }

  interface Props {
    resultsEl?: HTMLDivElement;
    groupedSpecs?: Group[];
    expandedCategories?: Set<string>;
    categoryCounts?: Map<string, number>;
    categorySubgroupCounts?: Map<string, SubgroupCount[]>;
    displayMode?: DisplayMode;
    onToggleCategoryExpand?: (category: string) => void;
    onDragStart?: (e: DragEvent, nodeType: string) => void;
    onDragEnd?: (e: DragEvent) => void;
  }

  let {
    resultsEl = $bindable<HTMLDivElement | undefined>(undefined),
    groupedSpecs = [],
    expandedCategories = new Set(),
    categoryCounts = new Map(),
    categorySubgroupCounts = new Map(),
    displayMode = 'grid',
    onToggleCategoryExpand,
    onDragStart,
    onDragEnd,
  }: Props = $props();
</script>

<div
  bind:this={resultsEl}
  class="results"
  class:is-list={displayMode === 'list'}
  class:is-grid={displayMode === 'grid'}
  role="region"
  aria-label="Node list"
>
  {#if groupedSpecs.length === 0}
    <div class="no-results">No nodes found</div>
  {:else}
    {#each groupedSpecs as group}
      {@const isExpanded = expandedCategories.has(group.category)}
      {@const totalCount = categoryCounts.get(group.category) ?? 0}
      {@const subgroupCounts = categorySubgroupCounts.get(group.category)}
      <div data-section-category={group.category} data-category={getCategorySlug(group.category)}>
        <NodePanelSection
          title={group.category}
          count={subgroupCounts?.length ? undefined : totalCount}
          subgroupCounts={subgroupCounts}
          expanded={isExpanded}
          onToggle={() => onToggleCategoryExpand?.(group.category)}
        >
          {#snippet headerIcon()}
            <NodeIconSvg identifier={getCategoryDefaultIcon(group.category)} />
          {/snippet}
          {#snippet children()}
            {#each group.nodes as spec (spec.id)}
              <NodePanelItem
                spec={spec}
                displayMode={displayMode}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
              />
            {/each}
          {/snippet}
        </NodePanelSection>
      </div>
    {/each}
  {/if}
</div>

<style>
  .results {
    --results-fade-height: 6px;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    gap: 0;
    scrollbar-width: none;
    -ms-overflow-style: none;
    mask-image: linear-gradient(
      to bottom,
      transparent 0%,
      black var(--results-fade-height)
    );
    -webkit-mask-image: linear-gradient(
      to bottom,
      transparent 0%,
      black var(--results-fade-height)
    );
  }

  .results::-webkit-scrollbar {
    display: none;
  }

  /* Section badge colors (section wrapper has data-category; badge is inside PanelSection) */
  [data-category="inputs"] :global(.panel-section .header .badge-wrapper .badge),
  [data-category="inputs"] :global(.panel-section .header .badge) {
    background: var(--node-header-bg-inputs);
    color: var(--node-header-print-inputs);
  }
  [data-category="inputs"] :global(.panel-section .header .badge-wrapper[data-subgroup="system-input"] .badge) {
    background: var(--node-header-bg-inputs-system);
    color: var(--node-header-print-inputs-system);
  }
  [data-category="patterns"] :global(.panel-section .header .badge-wrapper .badge),
  [data-category="patterns"] :global(.panel-section .header .badge) {
    background: var(--node-header-bg-patterns);
    color: var(--node-header-print-patterns);
  }
  [data-category="patterns"] :global(.panel-section .header .badge-wrapper[data-subgroup="structured"] .badge) {
    background: var(--node-header-bg-patterns-structured);
    color: var(--node-header-print-patterns-structured);
  }
  [data-category="shapes"] :global(.panel-section .header .badge-wrapper .badge),
  [data-category="shapes"] :global(.panel-section .header .badge) {
    background: var(--node-header-bg-shapes);
    color: var(--node-header-print-shapes);
  }
  [data-category="shapes"] :global(.panel-section .header .badge-wrapper[data-subgroup="derived"] .badge) {
    background: var(--node-header-bg-shapes-derived);
    color: var(--node-header-print-shapes-derived);
  }
  /* SDF category — distinct SDF tokens (cyan/blue-cyan pillar) */
  [data-category="sdf"] :global(.panel-section .header .badge-wrapper .badge),
  [data-category="sdf"] :global(.panel-section .header .badge) {
    background: var(--node-header-bg-sdf);
    color: var(--node-header-print-sdf);
  }
  [data-category="sdf"] :global(.panel-section .header .badge-wrapper[data-subgroup="raymarcher"] .badge) {
    background: var(--node-header-bg-sdf-raymarcher);
    color: var(--node-header-print-sdf-raymarcher);
  }
  [data-category="math"] :global(.panel-section .header .badge-wrapper .badge),
  [data-category="math"] :global(.panel-section .header .badge) {
    background: var(--node-header-bg-math);
    color: var(--node-header-print-math);
  }
  [data-category="math"] :global(.panel-section .header .badge-wrapper[data-subgroup="functions"] .badge) {
    background: var(--node-header-bg-math-functions);
    color: var(--node-header-print-math-functions);
  }
  [data-category="math"] :global(.panel-section .header .badge-wrapper[data-subgroup="advanced"] .badge) {
    background: var(--node-header-bg-math-advanced);
    color: var(--node-header-print-math-advanced);
  }
  [data-category="utilities"] :global(.panel-section .header .badge-wrapper .badge),
  [data-category="utilities"] :global(.panel-section .header .badge) {
    background: var(--node-header-bg-utilities);
    color: var(--node-header-print-utilities);
  }
  [data-category="distort"] :global(.panel-section .header .badge-wrapper .badge),
  [data-category="distort"] :global(.panel-section .header .badge) {
    background: var(--node-header-bg-distort);
    color: var(--node-header-print-distort);
  }
  [data-category="distort"] :global(.panel-section .header .badge-wrapper[data-subgroup="warp"] .badge) {
    background: var(--node-header-bg-distort-warp);
    color: var(--node-header-print-distort-warp);
  }
  [data-category="blend"] :global(.panel-section .header .badge-wrapper .badge),
  [data-category="blend"] :global(.panel-section .header .badge) {
    background: var(--node-header-bg-blend);
    color: var(--node-header-print-blend);
  }
  [data-category="mask"] :global(.panel-section .header .badge-wrapper .badge),
  [data-category="mask"] :global(.panel-section .header .badge) {
    background: var(--node-header-bg-mask);
    color: var(--node-header-print-mask);
  }
  [data-category="effects"] :global(.panel-section .header .badge-wrapper .badge),
  [data-category="effects"] :global(.panel-section .header .badge) {
    background: var(--node-header-bg-effects);
    color: var(--node-header-print-effects);
  }
  [data-category="effects"] :global(.panel-section .header .badge-wrapper[data-subgroup="stylize"] .badge) {
    background: var(--node-header-bg-effects-stylize);
    color: var(--node-header-print-effects-stylize);
  }
  [data-category="output"] :global(.panel-section .header .badge-wrapper .badge),
  [data-category="output"] :global(.panel-section .header .badge) {
    background: var(--node-header-bg-output);
    color: var(--node-header-print-output);
  }
  [data-category="audio"] :global(.panel-section .header .badge-wrapper .badge),
  [data-category="audio"] :global(.panel-section .header .badge) {
    background: var(--node-header-bg-audio);
    color: var(--node-header-print-audio);
  }

  /* List mode: section content is a flex column of items */
  .results.is-list :global(.panel-section .panel-section-content) {
    display: flex;
    flex-direction: column;
    gap: var(--pd-xs);
  }

  /* Grid mode: section content is a grid */
  .results.is-grid :global(.panel-section .panel-section-content) {
    display: grid !important;
    grid-template-columns: repeat(3, 1fr);
    grid-auto-rows: min-content;
    gap: var(--pd-md);
  }

  .no-results {
    padding: var(--pd-lg);
    text-align: center;
    font-size: var(--text-sm);
    color: var(--color-gray-80);
  }
</style>

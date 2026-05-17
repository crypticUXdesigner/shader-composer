<script lang="ts">
  /**
   * Compact node picker for empty-canvas add (Add tool / Alt+click): search, main list,
   * recent footer. Anchored to cursor like other popovers.
   */
  import { tick, untrack } from 'svelte';
  import { Popover, SearchInput, NodeIconSvg } from '../ui';
  import { getCategorySlug } from '../../../utils/cssTokens';
  import { getCategoryDefaultIcon, getNodeIcon } from '../../../utils/nodeSpecUtils';
  import type { NodeSpec } from '../../../types/nodeSpec';
  import {
    compareNodeSpecsForPanel,
    flattenGroupedNodeSpecs,
    groupNodeSpecsByPanelCategory,
    isNodePanelCategoryDividerStart,
  } from '../../../utils/nodePanelCategoryOrder';
  import {
    matchesNodePanelSearch,
    pickDefaultNodePanelSelectionIndex,
  } from '../../../utils/nodePanelSearch';
  import { loadRecentNodeTypes, pushRecentNodeType } from '../../../utils/recentNodeTypes';

  interface Props {
    open: boolean;
    x: number;
    y: number;
    nodeSpecs: NodeSpec[];
    onSelect: (nodeType: string) => void;
    onClose: () => void;
    /** Return false to ignore an outside click (see Popover `canCloseOnClickOutside`). */
    canCloseOnClickOutside?: (e: MouseEvent) => boolean;
  }

  let { open, x, y, nodeSpecs, onSelect, onClose, canCloseOnClickOutside }: Props = $props();

  let searchQuery = $state('');
  let searchRowRef = $state<HTMLDivElement | null>(null);
  let listRef = $state<HTMLDivElement | null>(null);
  let selectedSpecId = $state<string | null>(null);

  const filteredSpecs = $derived.by(() => {
    const query = searchQuery.toLowerCase().trim();
    let filtered = nodeSpecs;

    if (query !== '') {
      filtered = filtered.filter((spec) => matchesNodePanelSearch(spec, query));
    }

    filtered = [...filtered].sort((a, b) => compareNodeSpecsForPanel(a, b, query));

    return filtered;
  });

  const groupedSpecs = $derived.by(() => groupNodeSpecsByPanelCategory(filteredSpecs));

  /** List order as rendered (grouped by category), not filteredSpecs sort order. */
  const visualOrderedSpecs = $derived.by(() => flattenGroupedNodeSpecs(groupedSpecs));

  const selectedIndex = $derived.by(() => {
    if (!selectedSpecId) return -1;
    return visualOrderedSpecs.findIndex((s) => s.id === selectedSpecId);
  });

  const flatIndexBySpecId = $derived.by(() => {
    const map = new Map<string, number>();
    visualOrderedSpecs.forEach((spec, index) => map.set(spec.id, index));
    return map;
  });

  const specById = $derived.by(() => new Map(nodeSpecs.map((s) => [s.id, s])));

  const recentSpecs = $derived.by(() => {
    const recent = loadRecentNodeTypes();
    const out: NodeSpec[] = [];
    for (const id of recent) {
      const spec = specById.get(id);
      if (spec) out.push(spec);
    }
    return out.slice(0, 3);
  });

  function getSearchInput(): HTMLInputElement | null {
    return searchRowRef?.querySelector('input') ?? null;
  }

  function handlePick(nodeType: string): void {
    pushRecentNodeType(nodeType);
    onSelect(nodeType);
    onClose();
  }

  $effect(() => {
    if (!open) return;
    untrack(() => {
      searchQuery = '';
      selectedSpecId = null;
    });
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) getSearchInput()?.focus();
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  });

  /** Keep selection aligned with filtered list order (by spec id, not stale index). */
  $effect(() => {
    const specs = filteredSpecs;
    const query = searchQuery;

    untrack(() => {
      const q = query.trim();
      if (q === '') {
        selectedSpecId = null;
        return;
      }
      if (selectedSpecId !== null && specs.some((s) => s.id === selectedSpecId)) {
        return;
      }
      const nextIdx = pickDefaultNodePanelSelectionIndex(specs, query);
      selectedSpecId = nextIdx >= 0 ? specs[nextIdx]!.id : null;
    });
  });

  $effect(() => {
    if (selectedIndex < 0) return;
    const idx = selectedIndex;
    untrack(() => {
      void tick().then(() => {
        const el = listRef?.querySelector(`[data-ridx="${idx}"]`);
        el?.scrollIntoView({ block: 'nearest' });
      });
    });
  });

  function setSelectionByIndex(index: number): void {
    const specs = visualOrderedSpecs;
    if (index < 0 || index >= specs.length) {
      selectedSpecId = null;
      return;
    }
    selectedSpecId = specs[index]!.id;
  }

  function moveSelection(delta: number): void {
    const specs = visualOrderedSpecs;
    if (specs.length === 0) return;

    const current = selectedIndex;
    if (current < 0) {
      if (delta > 0) setSelectionByIndex(0);
      return;
    }

    setSelectionByIndex(Math.max(0, Math.min(current + delta, specs.length - 1)));
  }

  function handleKeydown(e: KeyboardEvent): void {
    const searchInput = getSearchInput();
    const isSearchFocused = searchInput === document.activeElement;
    const list = visualOrderedSpecs;

    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (list.length === 0) return;
      moveSelection(1);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (list.length === 0) return;
      if (selectedIndex <= 0) {
        selectedSpecId = null;
        searchInput?.focus();
      } else {
        moveSelection(-1);
      }
      return;
    }

    if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < list.length) {
        e.preventDefault();
        handlePick(list[selectedIndex]!.id);
      }
      return;
    }
  }
</script>

<Popover
  {open}
  {x}
  {y}
  align="center"
  alignY="start"
  clampToViewport
  viewportInset={60}
  {canCloseOnClickOutside}
  {onClose}
  class="add-node-picker"
>
  <div
    class="content"
    role="dialog"
    aria-label="Add node"
    tabindex="-1"
    onkeydown={handleKeydown}
  >
    <div class="pinned-top">
      <div class="search-row" bind:this={searchRowRef}>
        <SearchInput
          variant="primary"
          size="sm"
          placeholder="Search nodes…"
          class="menu-input"
          ariaLabel="Search nodes"
          bind:value={searchQuery}
        />
      </div>
    </div>

    <div
      class="result-list scrollbar-styled frame-elevated"
      bind:this={listRef}
      tabindex="-1"
      role="listbox"
      aria-activedescendant={selectedIndex >= 0 && selectedIndex < visualOrderedSpecs.length
        ? `add-node-opt-${selectedIndex}`
        : undefined}
    >
      {#each groupedSpecs as group, groupIndex (group.category)}
        {@const startsDividerGroup =
          isNodePanelCategoryDividerStart(group.category) &&
          (groupIndex === 0 || groupedSpecs[groupIndex - 1]?.category !== group.category)}
        <section
          class="category-group"
          class:divider-start={startsDividerGroup}
          aria-label={group.category}
        >
          <div
            class="category-heading"
            data-category={getCategorySlug(group.category)}
          >
            <span class="category-heading-icon" aria-hidden="true">
              <NodeIconSvg identifier={getCategoryDefaultIcon(group.category)} />
            </span>
            <span class="category-heading-label">{group.category}</span>
          </div>
          {#each group.nodes as spec (spec.id)}
            {@const flatIdx = flatIndexBySpecId.get(spec.id) ?? -1}
            <button
              type="button"
              id="add-node-opt-{flatIdx}"
              data-ridx={flatIdx}
              class="node-row"
              class:is-active={selectedIndex === flatIdx}
              onclick={() => handlePick(spec.id)}
            >
              <span class="node-row-icon" data-category={spec.category}>
                <NodeIconSvg identifier={getNodeIcon(spec)} />
              </span>
              <span class="node-row-name">{spec.displayName}</span>
            </button>
          {/each}
        </section>
      {/each}

      {#if filteredSpecs.length === 0}
        <div class="empty">No matches</div>
      {/if}
    </div>

    {#if recentSpecs.length > 0}
      <div class="pinned-bottom">
        <div class="recent-label">Recent</div>
        <div class="recent-chips">
          {#each recentSpecs as spec (spec.id)}
            <button type="button" class="recent-chip" onclick={() => handlePick(spec.id)}>
              <span class="recent-ico">
                <NodeIconSvg identifier={getNodeIcon(spec)} />
              </span>
              <span class="recent-name">{spec.displayName}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</Popover>

<style>
  /* Portal popover: strip outer padding so .frame is the single chrome (same pattern as SignalConnectionPicker). */
  :global(.add-node-picker) {
    padding: 0 !important;
  }

  :global(.add-node-picker) .content {
    display: flex;
    flex-direction: column;
    min-width: min(280px, calc(100vw - 24px));
    max-width: min(340px, calc(100vw - 24px));
    /* Stay within viewport padding (see Popover clampToViewport); list scrolls inside. */
    min-height: 480px;
    max-height: 480px;
    box-sizing: border-box;
  }

  :global(.add-node-picker) .pinned-top {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: var(--pd-md);
    padding: var(--pd-sm) var(--pd-md);
  }

  :global(.add-node-picker) .search-row :global(input) {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }

  :global(.add-node-picker) .result-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--pd-md);
    padding: var(--pd-md);
    outline: none;
  }

  .category-group {
    display: flex;
    flex-direction: column;
    gap: var(--pd-2xs);
  }

  .category-group.divider-start {
    padding-top: var(--pd-sm);
    border-top: 1px solid var(--divider);
    margin-top: var(--pd-xs);
  }

  .category-heading {
    display: flex;
    align-items: center;
    gap: var(--pd-sm);
    padding: 0 var(--pd-sm);
    color: var(--print-muted);
    font-size: var(--text-2xs);
    font-weight: var(--weight-medium);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .category-heading-icon {
    flex-shrink: 0;
    width: var(--size-sm);
    height: var(--size-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.85;
  }

  .category-heading-icon :global(svg) {
    width: 18px;
    height: 18px;
  }

  .category-heading-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .node-row {
    display: flex;
    align-items: center;
    gap: var(--pd-sm);
    width: 100%;
    text-align: left;
    padding: var(--pd-xs) var(--pd-sm);
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--print-highlight);
    font-size: var(--text-sm);
    cursor: default;
    transition: background var(--motion-effects-fast-duration) var(--motion-effects-fast-easing);
  }

  .node-row:hover,
  .node-row.is-active {
    background: var(--ghost-bg-hover);
  }

  .node-row-icon {
    flex-shrink: 0;
    width: var(--size-sm);
    height: var(--size-sm);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .node-row-icon :global(svg) {
    width: 18px;
    height: 18px;
  }

  .node-row-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .empty {
    padding: var(--pd-md);
    text-align: center;
    font-size: var(--text-xs);
    color: var(--print-muted);
  }

  :global(.add-node-picker) .pinned-bottom {
    flex-shrink: 0;
    padding: var(--pd-md);
  }

  .recent-label {
    font-size: var(--text-2xs);
    color: var(--print-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: var(--pd-xs);
  }

  .recent-chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--pd-xs);
  }

  .recent-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--pd-xs);
    max-width: 100%;
    padding: 2px var(--pd-sm) 2px 2px;
    border-radius: var(--radius-md);
    border: 1px solid var(--divider);
    background: var(--ghost-bg);
    color: var(--print-normal);
    font-size: var(--text-xs);
    cursor: default;
  }

  .recent-chip:hover {
    background: var(--ghost-bg-hover);
  }

  .recent-ico {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .recent-ico :global(svg) {
    width: 16px;
    height: 16px;
  }

  .recent-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>

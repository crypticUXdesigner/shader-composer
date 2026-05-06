<script lang="ts">
  /**
   * Compact node picker for empty-canvas add (Add tool / Alt+click): search, category pills,
   * main list, recent footer. Anchored to cursor like other popovers.
   */
  import { untrack } from 'svelte';
  import { Popover, SearchInput, Tag, NodeIconSvg } from '../ui';
  import { getNodeIcon } from '../../../utils/nodeSpecUtils';
  import type { NodeSpec } from '../../../types/nodeSpec';
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
  let selectedCategories = $state<Set<string>>(new Set());
  let searchRowRef = $state<HTMLDivElement | null>(null);
  let listRef = $state<HTMLDivElement | null>(null);
  let selectedIndex = $state(-1);

  const CATEGORY_ORDER: string[] = [
    'Distort',
    'Patterns',
    'Shapes',
    'SDF',
    'Blend',
    'Mask',
    'Effects',
    'Audio',
    'Inputs',
    'Output',
    'Math',
    'Utilities',
  ];

  function sortCategories(categories: string[]): string[] {
    return [...categories].sort((a, b) => {
      const aIndex = CATEGORY_ORDER.indexOf(a);
      const bIndex = CATEGORY_ORDER.indexOf(b);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.localeCompare(b);
    });
  }

  const allCategories = $derived(sortCategories([...new Set(nodeSpecs.map((s) => s.category))]));

  const filteredSpecs = $derived.by(() => {
    const query = searchQuery.toLowerCase().trim();
    let filtered = nodeSpecs;

    if (query !== '') {
      filtered = filtered.filter(
        (spec) =>
          spec.displayName.toLowerCase().includes(query) ||
          (spec.description?.toLowerCase().includes(query) ?? false) ||
          spec.category.toLowerCase().includes(query)
      );
    }

    if (selectedCategories.size > 0) {
      filtered = filtered.filter((spec) => selectedCategories.has(spec.category));
    }

    filtered = [...filtered].sort((a, b) => {
      if (query !== '') {
        const aExact = a.displayName.toLowerCase() === query;
        const bExact = b.displayName.toLowerCase() === query;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
      }
      const cat = a.category.localeCompare(b.category);
      if (cat !== 0) return cat;
      return a.displayName.localeCompare(b.displayName);
    });

    return filtered;
  });

  const specById = $derived.by(() => new Map(nodeSpecs.map((s) => [s.id, s])));

  const recentSpecs = $derived.by(() => {
    const recent = loadRecentNodeTypes();
    const out: NodeSpec[] = [];
    for (const id of recent) {
      const spec = specById.get(id);
      if (spec) out.push(spec);
    }
    return out;
  });

  function getSearchInput(): HTMLInputElement | null {
    return searchRowRef?.querySelector('input') ?? null;
  }

  function toggleCategory(cat: string): void {
    const next = new Set(selectedCategories);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    selectedCategories = next;
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
      selectedIndex = -1;
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

  function scrollSelectedIntoView(): void {
    const el = listRef?.querySelector(`[data-ridx="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }

  function handleKeydown(e: KeyboardEvent): void {
    const searchInput = getSearchInput();
    const isSearchFocused = searchInput === document.activeElement;
    const list = filteredSpecs;

    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (list.length === 0) return;
      if (isSearchFocused) {
        if (selectedIndex < 0) selectedIndex = 0;
        else selectedIndex = Math.min(selectedIndex + 1, list.length - 1);
      } else {
        selectedIndex = Math.min(selectedIndex + 1, list.length - 1);
      }
      scrollSelectedIntoView();
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (list.length === 0) return;
      if (selectedIndex <= 0) {
        selectedIndex = -1;
        searchInput?.focus();
      } else {
        selectedIndex -= 1;
        scrollSelectedIntoView();
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

      {#if allCategories.length > 0}
        <div class="filters-row filter-categories">
          {#each allCategories as cat (cat)}
            <Tag
              size="xs"
              interactive
              selected={selectedCategories.has(cat)}
              category={cat}
              onclick={() => toggleCategory(cat)}
            >
              {cat}
            </Tag>
          {/each}
        </div>
      {/if}
    </div>

    <div
      class="result-list scrollbar-styled frame-elevated"
      bind:this={listRef}
      tabindex="-1"
      role="listbox"
      aria-activedescendant={selectedIndex >= 0 && selectedIndex < filteredSpecs.length
        ? `add-node-opt-${selectedIndex}`
        : undefined}
    >
      {#each filteredSpecs as spec, i (spec.id)}
        <button
          type="button"
          id="add-node-opt-{i}"
          data-ridx={i}
          class="node-row"
          class:is-active={selectedIndex === i}
          onclick={() => handlePick(spec.id)}
        >
          <span class="node-row-icon" data-category={spec.category}>
            <NodeIconSvg identifier={getNodeIcon(spec)} />
          </span>
          <span class="node-row-name">{spec.displayName}</span>
        </button>
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

  :global(.add-node-picker) .filters-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--pd-xs);
    max-height: 5.5rem;
    overflow-y: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
    padding-bottom: var(--pd-sm);
  }

  :global(.add-node-picker) .filters-row::-webkit-scrollbar {
    display: none;
  }

  :global(.add-node-picker) .result-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--pd-sm);
    padding: var(--pd-md);
    outline: none;
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

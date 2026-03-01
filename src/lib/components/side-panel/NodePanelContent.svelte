<script lang="ts">
  /**
   * Node panel content: search, category/type filters, node grid/list, drag-to-add.
   * Lives in side-panel; composes NodePanelHeader, NodePanelResults (which uses NodePanelSection and NodePanelItem).
   */
  import { tick } from 'svelte';
  import type { NodeSpec } from '../../../types/nodeSpec';
  import { getCategorySlug, getSubGroupSlug, CATEGORY_SUBGROUP_ORDER } from '../../../utils/cssTokens';
  import NodePanelHeader from './NodePanelHeader.svelte';
  import NodePanelResults from './NodePanelResults.svelte';

  type DisplayMode = 'list' | 'grid';

  interface Props {
    nodeSpecs?: NodeSpec[];
    onCreateNode?: (nodeType: string, canvasX: number, canvasY: number) => void;
    onScreenToCanvas?: (screenX: number, screenY: number) => { x: number; y: number };
    /** When set, clicking a node in the list adds it at canvas center (no drag). */
    onAddNodeAtCenter?: (nodeType: string) => void;
  }

  let {
    nodeSpecs = [],
    onCreateNode,
    onScreenToCanvas,
    onAddNodeAtCenter,
  }: Props = $props();

  let panelEl: HTMLDivElement;
  let resultsEl = $state<HTMLDivElement | undefined>(undefined);

  // State
  let searchQuery = $state('');
  let selectedTypes = $state<Set<string>>(new Set());
  let displayMode = $state<DisplayMode>('grid');
  let isVisible = $state(true);
  /** Set of category names that are expanded; multiple sections can be open. */
  let expandedCategoriesSet = $state<Set<string>>(new Set());

  const CATEGORY_ORDER: string[] = [
    'Inputs',
    'Distort',
    'Audio',
    'Patterns',
    'SDF',
    'Shapes',
    'Math',
    'Utilities',
    'Blend',
    'Mask',
    'Effects',
    'Output',
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

  const allTypes = $derived.by(() => {
    const set = new Set<string>();
    for (const spec of nodeSpecs) {
      for (const input of spec.inputs) set.add(input.type);
      for (const output of spec.outputs) set.add(output.type);
    }
    return Array.from(set).sort();
  });

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

    if (selectedTypes.size > 0) {
      filtered = filtered.filter((spec) => {
        const hasInputType = spec.inputs.some((i) => selectedTypes.has(i.type));
        const hasOutputType = spec.outputs.some((o) => selectedTypes.has(o.type));
        return hasInputType || hasOutputType;
      });
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

  const groupedSpecs = $derived.by(() => {
    const map = new Map<string, NodeSpec[]>();
    for (const spec of filteredSpecs) {
      if (!map.has(spec.category)) map.set(spec.category, []);
      map.get(spec.category)!.push(spec);
    }
    const sorted = sortCategories(Array.from(map.keys()));
    return sorted.map((category) => ({ category, nodes: map.get(category)! }));
  });

  // Determine which categories should be expanded
  const expandedCategories = $derived.by(() => {
    const hasSearch = searchQuery.trim() !== '';
    const hasTypeFilter = selectedTypes.size > 0;
    if (hasSearch || hasTypeFilter) {
      // When searching or filtering by type, expand all categories that have matching nodes
      return new Set(groupedSpecs.map((g) => g.category));
    }
    // When no filter, use the user's set of expanded categories (multiple can be open)
    return new Set(expandedCategoriesSet);
  });

  // Get total node count per category (for badge display)
  const categoryCounts = $derived.by(() => {
    const map = new Map<string, number>();
    for (const spec of nodeSpecs) {
      map.set(spec.category, (map.get(spec.category) ?? 0) + 1);
    }
    return map;
  });

  // Per-category counts by subgroup (only for categories with ≥2 buckets). Used for multiple badges.
  const categorySubgroupCounts = $derived.by(() => {
    const byCategory = new Map<string, Map<string, number>>();
    for (const spec of nodeSpecs) {
      const cat = spec.category;
      const slug = getSubGroupSlug(spec.id, spec.category);
      if (!byCategory.has(cat)) byCategory.set(cat, new Map());
      const sub = byCategory.get(cat)!;
      sub.set(slug, (sub.get(slug) ?? 0) + 1);
    }
    const result = new Map<string, { subgroupSlug: string; count: number }[]>();
    for (const [category, subMap] of byCategory) {
      if (subMap.size < 2) continue;
      const order = CATEGORY_SUBGROUP_ORDER[getCategorySlug(category)];
      if (!order) continue;
      const entries = order
        .filter((subgroupSlug) => (subMap.get(subgroupSlug) ?? 0) > 0)
        .map((subgroupSlug) => ({ subgroupSlug, count: subMap.get(subgroupSlug) ?? 0 }));
      if (entries.length > 0) result.set(category, entries);
    }
    return result;
  });

  function clearSearch() {
    searchQuery = '';
    panelEl?.querySelector<HTMLInputElement>('.search input')?.focus();
  }

  async function toggleCategoryExpand(category: string) {
    const next = new Set(expandedCategoriesSet);
    const wasExpanded = next.has(category);
    if (wasExpanded) {
      next.delete(category);
    } else {
      next.add(category);
      // Wait for DOM to update, then scroll to section header when expanding
      await tick();
      if (resultsEl) {
        const sectionWrapper = resultsEl.querySelector(
          `[data-section-category="${category}"]`
        ) as HTMLElement;
        if (sectionWrapper) {
          const sectionHeader = sectionWrapper.querySelector('.header') as HTMLElement;
          if (sectionHeader && resultsEl) {
            const headerRect = sectionHeader.getBoundingClientRect();
            const containerRect = resultsEl.getBoundingClientRect();
            const currentScrollTop = resultsEl.scrollTop;
            const scrollTarget = currentScrollTop + (headerRect.top - containerRect.top);
            const threshold = 10;
            if (Math.abs(currentScrollTop - scrollTarget) > threshold) {
              resultsEl.scrollTo({
                top: scrollTarget,
                behavior: 'smooth'
              });
            }
          }
        }
      }
    }
    expandedCategoriesSet = next;
  }

  function toggleType(type: string) {
    const next = new Set(selectedTypes);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    selectedTypes = next;
  }

  function show() {
    isVisible = true;
  }

  function hide() {
    isVisible = false;
  }

  function toggle() {
    isVisible = !isVisible;
  }

  function focusSearch() {
    panelEl?.querySelector<HTMLInputElement>('.search input')?.focus();
  }

  function handleDrop(screenX: number, screenY: number, nodeType: string) {
    if (onCreateNode && onScreenToCanvas) {
      const canvasPos = onScreenToCanvas(screenX, screenY);
      onCreateNode(nodeType, canvasPos.x, canvasPos.y);
    }
  }

  function onDragStart(e: DragEvent, nodeType: string) {
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', nodeType);
    }
  }

  // Exported API for parent (bind:this)
  export { show, hide, toggle, focusSearch, handleDrop };
  export const isPanelVisible = () => isVisible;
  export const getPanelElement = () => panelEl;
</script>

<div
  bind:this={panelEl}
  class="node-panel"
  role="region"
  aria-label="Node panel"
>
  <NodePanelHeader
    bind:searchQuery
    bind:displayMode
    selectedTypes={selectedTypes}
    allTypes={allTypes}
    onClearSearch={clearSearch}
    onToggleType={toggleType}
    onCollapseAllSections={() => (expandedCategoriesSet = new Set())}
  />

  <NodePanelResults
    bind:resultsEl
    groupedSpecs={groupedSpecs}
    expandedCategories={expandedCategories}
    categoryCounts={categoryCounts}
    categorySubgroupCounts={categorySubgroupCounts}
    displayMode={displayMode}
    onToggleCategoryExpand={toggleCategoryExpand}
    onDragStart={onDragStart}
    onDragEnd={() => {}}
    onAddNode={onAddNodeAtCenter}
  />
</div>

<style>
  .node-panel {
    position: absolute;
    display: flex;
    flex-direction: column;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    overflow: hidden;
  }
</style>

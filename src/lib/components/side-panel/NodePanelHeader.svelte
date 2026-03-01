<script lang="ts">
  /**
   * Node panel header: search input, list/grid toggle, type filter tags.
   * Used only inside NodePanelContent.
   */
  import { Input, Button, ButtonGroup, Tag, IconSvg } from '../ui';

  type DisplayMode = 'list' | 'grid';

  interface Props {
    searchQuery?: string;
    displayMode?: DisplayMode;
    selectedTypes?: Set<string>;
    allTypes?: string[];
    onClearSearch?: () => void;
    onDisplayModeChange?: (mode: DisplayMode) => void;
    onToggleType?: (type: string) => void;
    onCollapseAllSections?: () => void;
  }

  let {
    searchQuery = $bindable(''),
    displayMode = $bindable('grid' as DisplayMode),
    selectedTypes = new Set(),
    allTypes = [],
    onClearSearch,
    onDisplayModeChange,
    onToggleType,
    onCollapseAllSections,
  }: Props = $props();

  function handleClearSearch() {
    searchQuery = '';
    onClearSearch?.();
  }

  function onSearchInput(e: Event) {
    searchQuery = (e.currentTarget as HTMLInputElement).value;
  }
</script>

{#snippet searchIcon()}
  <IconSvg name="search" variant="line" />
{/snippet}

{#snippet clearButton()}
  <Button
    variant="ghost"
    size="sm"
    mode="icon-only"
    title="Clear search"
    class="input-clear {searchQuery.trim() === '' ? 'is-hidden' : ''}"
    onclick={handleClearSearch}
    type="button"
  >
    <IconSvg name="circle-x" variant="filled" />
  </Button>
{/snippet}

<header class="node-panel-header" role="group" aria-label="Node panel search and filters">
  <div class="search">
    <Input
      variant="primary"
      size="sm"
      type="text"
      value={searchQuery}
      oninput={onSearchInput}
      placeholder="Search nodes..."
      class="menu-input"
      leading={searchIcon}
      trailing={clearButton}
    />
    <ButtonGroup class="display-mode-toggle" role="group" ariaLabel="View mode">
      <Button
        variant="ghost"
        size="sm"
        mode="icon-only"
        title="List view"
        class={displayMode === 'list' ? 'is-active' : ''}
        onclick={() => {
          displayMode = 'list';
          onDisplayModeChange?.('list');
        }}
      >
        <IconSvg name="menu" variant="line" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        mode="icon-only"
        title="Grid view"
        class={displayMode === 'grid' ? 'is-active' : ''}
        onclick={() => {
          displayMode = 'grid';
          onDisplayModeChange?.('grid');
        }}
      >
        <IconSvg name="layout-grid" variant="filled" />
      </Button>
    </ButtonGroup>
  </div>

  <div class="filters">
    <div class="tag-container">
      {#each allTypes as type}
        <Tag
          interactive
          selected={selectedTypes.has(type)}
          type={type}
          onclick={() => onToggleType?.(type)}
        >
          {type}
        </Tag>
      {/each}
    </div>
    <Button
      variant="ghost"
      size="sm"
      mode="icon-only"
      title="Collapse all sections"
      onclick={() => onCollapseAllSections?.()}
      type="button"
    >
      <IconSvg name="arrows-in-line-vertical" variant="line" />
    </Button>
  </div>
</header>

<style>
  .node-panel-header {
    display: flex;
    flex-direction: column;
    gap: var(--pd-sm);
    flex-shrink: 0;
    padding: var(--pd-md);
    border-bottom: 1px solid var(--divider);
  }

  .search {
    display: flex;
    align-items: center;
    gap: var(--pd-md);
    flex-shrink: 0;
    padding: 0;
  }

  :global(.display-mode-toggle) {
    flex-shrink: 0;
  }

  .filters {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--pd-sm);
    flex-shrink: 0;
    padding: 0;
    max-height: calc(var(--size-xl) * 3.33);
    overflow: hidden;
  }

  .tag-container {
    display: flex;
    flex-wrap: wrap;
    gap: var(--pd-xs);
    align-items: center;
    min-width: 0;
    flex: 1;
    overflow-y: auto;
  }
</style>

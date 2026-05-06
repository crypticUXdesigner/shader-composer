<script lang="ts">
  import { Button, Input, DropdownMenu, IconSvg, MenuHeader, MenuInput, MenuItem, MenuNoResults } from '../ui';

  interface FloatParamOption {
    nodeId: string;
    paramName: string;
    nodeLabel: string;
    paramLabel: string;
  }

  interface SnapGridMenuItem {
    label: string;
    action: () => void;
  }

  interface Props {
    bpm: number;
    onApplyBpm: (bpm: number) => void;

    snapEnabled: boolean;
    onToggleSnap: () => void;
    snapGridLabel: string;
    snapGridEnabled: boolean;
    snapGridMenuItems: SnapGridMenuItem[];

    filteredFloatParams: { options: FloatParamOption[]; grouped: Map<string, FloatParamOption[]> };
    addLaneOpen: boolean;
    addLaneSearch: string;
    onToggleAddLaneOpen: () => void;
    onCloseAddLane: () => void;
    onUpdateAddLaneSearch: (value: string) => void;
    onAddLane: (nodeId: string, paramName: string) => void;

    snapGridOpen: boolean;
    onToggleSnapGridOpen: () => void;
    onCloseSnapGrid: () => void;

    onClose?: () => void;
  }

  let {
    bpm,
    onApplyBpm,
    snapEnabled,
    onToggleSnap,
    snapGridLabel,
    snapGridEnabled,
    snapGridMenuItems,
    filteredFloatParams,
    addLaneOpen,
    addLaneSearch,
    onToggleAddLaneOpen,
    onCloseAddLane,
    onUpdateAddLaneSearch,
    onAddLane,
    snapGridOpen,
    onToggleSnapGridOpen,
    onCloseSnapGrid,
    onClose,
  }: Props = $props();

  let addLaneButtonEl = $state<HTMLDivElement | null>(null);
  let snapGridButtonEl = $state<HTMLDivElement | null>(null);
</script>

<header class="timeline-header">
  <div class="header-left">
    <div class="actions">
      <div bind:this={addLaneButtonEl} class="add-lane-btn-anchor">
        <Button
          variant="ghost"
          size="sm"
          mode="both"
          class="add-lane-btn"
          title="Add automation lane"
          onclick={onToggleAddLaneOpen}
        >
          <IconSvg name="plus" />
          <span>Add Lane</span>
        </Button>
      </div>
      <DropdownMenu
        open={addLaneOpen}
        anchor={addLaneButtonEl}
        openAbove={true}
        onClose={onCloseAddLane}
        class="timeline-add-lane-dropdown"
      >
        {#snippet children()}
          <MenuInput
            value={addLaneSearch}
            placeholder="Search node or param…"
            oninput={(e) => onUpdateAddLaneSearch((e.currentTarget as HTMLInputElement).value)}
          />
          <div class="timeline-add-lane-list scrollbar-styled">
            {#if filteredFloatParams.options.length === 0}
              <MenuNoResults>
                {addLaneSearch.trim() ? 'No matching params' : 'No float params available'}
              </MenuNoResults>
            {:else}
              {#each filteredFloatParams.grouped as [nodeId, params]}
                {@const headerLabel = params[0]?.nodeLabel ?? nodeId}
                <MenuHeader text={headerLabel} />
                {#each params as p}
                  <MenuItem label={p.paramLabel} onclick={() => onAddLane(p.nodeId, p.paramName)} />
                {/each}
              {/each}
            {/if}
          </div>
        {/snippet}
      </DropdownMenu>
    </div>
  </div>
  <div class="header-right">
    <div class="bpm-wrap">
      <label class="bpm-label" for="timeline-bpm-input">BPM</label>
      <Input
        id="timeline-bpm-input"
        type="number"
        variant="ghost"
        size="sm"
        class="bpm-input"
        value={bpm}
        min={20}
        max={300}
        title="Beats per minute (default 120 when no audio)"
        onchange={(e: Event) => {
          const el = e.currentTarget as HTMLInputElement;
          const v = el.valueAsNumber;
          onApplyBpm(Number.isFinite(v) ? v : bpm);
        }}
      />
    </div>
    <div class="snap-wrap">
      <Button
        variant="ghost"
        size="sm"
        mode="icon-only"
        class="snap-toggle {snapEnabled ? 'is-active' : ''}"
        title="Snap regions to bar grid"
        onclick={onToggleSnap}
      >
        <IconSvg name="hash-straight" />
      </Button>
      <div bind:this={snapGridButtonEl} class="snap-grid-button-anchor">
        <Button
          variant="ghost"
          size="sm"
          class="snap-grid-button"
          title="Snap grid size (bar fraction)"
          disabled={!snapGridEnabled}
          onclick={onToggleSnapGridOpen}
        >
          <span class="snap-grid-label">{snapGridLabel}</span>
        </Button>
      </div>
      <DropdownMenu open={snapGridOpen} anchor={snapGridButtonEl} openAbove={true} onClose={onCloseSnapGrid}>
        {#snippet children()}
          {#each snapGridMenuItems as item}
            <MenuItem
              label={item.label}
              onclick={() => {
                item.action();
                onCloseSnapGrid();
              }}
            />
          {/each}
        {/snippet}
      </DropdownMenu>
    </div>
    <Button
      variant="ghost"
      size="sm"
      mode="both"
      class="close"
      title="Close timeline"
      aria-label="Close timeline"
      onclick={() => onClose?.()}
    >
      Close
      <IconSvg name="x" variant="line" />
    </Button>
  </div>
</header>

<style>
  /* Add Lane dropdown: uses Popover + .frame; layout/sizing here */
  :global(.timeline-add-lane-dropdown.dropdown-menu.menu-wrapper) {
    min-width: 200px; /* One-off */
    /* Allow the menu to grow with content until it hits the viewport. */
    max-height: 40vh;
    min-height: 300px;
    overflow: hidden;
    padding: 0;

    /* DropdownMenu renders: Popover(.timeline-add-lane-dropdown) > .menu-wrapper-inner > (MenuInput + list).
       Make the inner wrapper a flex column so the list can take remaining height and scroll. */
    :global(.menu-wrapper-inner) {
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
      padding: var(--pd-xs);
    }

    .timeline-add-lane-list {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      padding: var(--pd-sm) 0 0 0;
      scrollbar-width: thin;
    }

  }

  .timeline-header {
    position: static;
    flex-shrink: 0;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--pd-md);
    min-height: var(--size-sm);
    padding: var(--pd-xs);
  }

  .timeline-header :global(.button.sm.ghost) {
    border-radius: calc(var(--radius-md) - var(--pd-xs)) !important;
  }

  .header-left {
    width: var(--track-header-width);
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }

  .actions {
    position: relative;
  }

  :global(.add-lane-btn) {
    display: inline-flex;
    align-items: center;
    gap: var(--pd-xs);
  }

  .header-right {
    margin-left: auto;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: var(--pd-md);
  }

  .bpm-wrap {
    display: flex;
    align-items: center;
    gap: var(--pd-xs);
  }

  .bpm-label {
    font-size: var(--text-xs);
    color: var(--color-gray-100);
  }

  :global(.bpm-input) {
    width: 3.5em;
    appearance: textfield;
    -moz-appearance: textfield;
  }

  :global(.bpm-input)::-webkit-inner-spin-button,
  :global(.bpm-input)::-webkit-outer-spin-button {
    appearance: none;
    -webkit-appearance: none;
    margin: 0;
  }

  .snap-wrap {
    display: flex;
    align-items: center;
    gap: var(--pd-xs);
  }

  :global(.snap-grid-button),
  :global(.snap-grid-button *) {
    padding: 0 var(--pd-sm);
  }

  :global(.snap-grid):focus {
    background: var(--ghost-bg-hover);
    border-color: var(--color-gray-70);
  }

  :global(.close) {
    flex-shrink: 0;
  }
</style>


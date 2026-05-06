<script lang="ts">
  /**
   * Top bar left section: panel toggle, preset selector, download preset JSON, image/video export.
   */
  import { Button, ButtonGroup, DropdownMenu, IconSvg, MenuItem } from '../ui';

  interface Props {
    presetLabel: string;
    isPanelVisible: boolean;
    isVideoExportSupported?: boolean;
    /** When true, preset button shows "Loading…" and is disabled. */
    presetLoading?: boolean;
    /** When true, show undo/redo (editor bootstrapped). */
    graphHistoryControls?: boolean;
    canUndoGraph?: boolean;
    canRedoGraph?: boolean;
    onGraphUndo?: () => void;
    onGraphRedo?: () => void;
    onPanelToggle?: () => void;
    onPresetClick?: (e: MouseEvent) => void;
    onDownloadPreset?: () => void;
    onExport?: () => void | Promise<void>;
    onVideoExport?: () => void | Promise<void>;
  }

  let {
    presetLabel,
    isPanelVisible,
    isVideoExportSupported = true,
    presetLoading = false,
    graphHistoryControls = false,
    canUndoGraph = false,
    canRedoGraph = false,
    onGraphUndo,
    onGraphRedo,
    onPanelToggle,
    onPresetClick,
    onDownloadPreset,
    onExport,
    onVideoExport,
  }: Props = $props();

  let exportMenuOpen = $state(false);
  let exportMenuAnchorEl = $state<HTMLDivElement | null>(null);
</script>

<div class="top-bar-preset-and-export">
  <ButtonGroup role="group" ariaLabel="Panel, preset, graph history, and export">
    {#if !isPanelVisible}
      <Button variant="ghost" size="sm" mode="icon-only" title="Open node panel" onclick={() => onPanelToggle?.()}>
        <IconSvg name="layout-grid" variant="filled" />
      </Button>
    {/if}
    {#if graphHistoryControls}
      <span class="top-bar-graph-history">
        <Button
          class="top-bar-graph-history-btn"
          variant="ghost"
          size="sm"
          mode="icon-only"
          title="Undo (Ctrl+Z)"
          disabled={!canUndoGraph}
          onclick={() => onGraphUndo?.()}
        >
          <IconSvg name="graph-undo" variant="line" />
        </Button>
        <Button
          class="top-bar-graph-history-btn"
          variant="ghost"
          size="sm"
          mode="icon-only"
          title="Redo (Ctrl/Cmd+Shift+Z or Ctrl+Y / Cmd+Y)"
          disabled={!canRedoGraph}
          onclick={() => onGraphRedo?.()}
        >
          <IconSvg name="graph-redo" variant="line" />
        </Button>
      </span>
    {/if}
    <Button variant="ghost" size="sm" mode="both" title={presetLoading ? 'Loading preset…' : 'Load project'} disabled={presetLoading} onclick={onPresetClick}>
      <IconSvg name="folder-open" variant="filled" />
      <span class="top-bar-preset-button-label">{presetLoading ? 'Loading…' : presetLabel}</span>
    </Button>
    <div bind:this={exportMenuAnchorEl} class="top-bar-export-menu-anchor">
      <Button
        variant="ghost"
        size="sm"
        mode="icon-only"
        title="Export…"
        onclick={() => (exportMenuOpen = !exportMenuOpen)}
      >
        <IconSvg name="download-simple" variant="line" />
      </Button>
    </div>
    <DropdownMenu
      open={exportMenuOpen}
      anchor={exportMenuAnchorEl}
      offsetX={-11}
      onClose={() => (exportMenuOpen = false)}
      class="topbar-export-menu"
    >
      {#snippet children()}
        <MenuItem
          label="Export JSON"
          onclick={() => {
            onDownloadPreset?.();
            exportMenuOpen = false;
          }}
        >
          {#snippet icon()}
            <IconSvg name="download-simple" variant="line" />
          {/snippet}
        </MenuItem>
        <MenuItem
          label="Export Image"
          onclick={() => {
            void onExport?.();
            exportMenuOpen = false;
          }}
        >
          {#snippet icon()}
            <IconSvg name="image-square" variant="line" />
          {/snippet}
        </MenuItem>
        <MenuItem
          label="Export Video"
          disabled={!isVideoExportSupported}
          desc={isVideoExportSupported ? '' : 'Requires WebCodecs (VideoEncoder/AudioEncoder)'}
          onclick={() => {
            void onVideoExport?.();
            exportMenuOpen = false;
          }}
        >
          {#snippet icon()}
            <IconSvg name="video" variant="line" />
          {/snippet}
        </MenuItem>
      {/snippet}
    </DropdownMenu>
  </ButtonGroup>
</div>

<style>
  .top-bar-preset-and-export {
    display: flex;
    align-items: center;
    gap: var(--pd-md);
  }

  .top-bar-preset-button-label {
    white-space: nowrap;
  }

  .top-bar-graph-history {
    display: inline-flex;
    align-items: center;
    gap: var(--pd-2xs);
  }

  .top-bar-graph-history :global(.top-bar-graph-history-btn.button.sm.icon-only) {
    width: var(--scale-6);
    min-width: var(--scale-6);
  }

  .top-bar-export-menu-anchor {
    display: inline-flex;
  }
</style>

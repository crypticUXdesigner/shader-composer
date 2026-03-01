<script lang="ts">
  /**
   * TopBar - App top bar: preset/export (left), view mode (center), viewport status (right).
   * Composes TopBarPresetAndExport, TopBarViewControls, TopBarViewportStatus.
   */
  import TopBarPresetAndExport from './TopBarPresetAndExport.svelte';
  import TopBarViewControls from './TopBarViewControls.svelte';
  import TopBarViewportStatus from './TopBarViewportStatus.svelte';
  import type { ViewMode } from '../editor/types';

  interface Props {
    /** Called with the top bar root element so layout can measure height. */
    barElement?: (el: HTMLDivElement) => void;
    presetLabel: string;
    viewMode: ViewMode;
    setViewMode: (mode: ViewMode) => void;
    zoomPercent: number;
    fps: number;
    fpsColor: string;
    helpEnabled: boolean;
    isPanelVisible: boolean;
    panelOffset: number;
    onPanelToggle?: () => void;
    onPresetClick?: (e: MouseEvent) => void;
    onCopyPreset?: () => void | Promise<void>;
    onExport?: () => void | Promise<void>;
    onVideoExport?: () => void | Promise<void>;
    /** When false, video export button is disabled and title explains WebCodecs is required. */
    isVideoExportSupported?: boolean;
    /** When true, preset button shows loading state and is disabled. */
    presetLoading?: boolean;
    onZoomClick?: () => void;
    onZoomDblClick?: () => void;
    onHelpClick?: () => void;
    onShortcutsClick?: () => void;
  }

  let {
    barElement,
    presetLabel,
    viewMode,
    setViewMode,
    zoomPercent,
    fps,
    fpsColor,
    helpEnabled,
    isPanelVisible,
    panelOffset = 0,
    onPanelToggle,
    onPresetClick,
    onCopyPreset,
    onExport,
    onVideoExport,
    isVideoExportSupported = true,
    presetLoading = false,
    onZoomClick,
    onZoomDblClick,
    onHelpClick,
    onShortcutsClick,
  }: Props = $props();

  let barEl = $state<HTMLDivElement | undefined>(undefined);

  $effect(() => {
    if (barEl && barElement) barElement(barEl);
  });
</script>

<div
  bind:this={barEl}
  class="top-bar"
  style="--top-bar-left-offset: {panelOffset}px;"
>
  <div class="top-bar-left">
    <TopBarPresetAndExport
      {presetLabel}
      {isPanelVisible}
      {isVideoExportSupported}
      {presetLoading}
      {onPanelToggle}
      {onPresetClick}
      {onCopyPreset}
      {onExport}
      {onVideoExport}
    />
  </div>
  <div class="top-bar-center">
    <TopBarViewControls {viewMode} {setViewMode} />
  </div>
  <div class="top-bar-right">
    <TopBarViewportStatus
      {zoomPercent}
      {fps}
      {fpsColor}
      {helpEnabled}
      {onZoomClick}
      {onZoomDblClick}
      {onHelpClick}
      {onShortcutsClick}
    />
  </div>
</div>

<style>
  /* Top Bar layout – bar and left/center/right slots */
  .top-bar {
    position: absolute;
    left: var(--top-bar-left-offset, 0px);
    top: 0;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--pd-md);
    height: calc(var(--size-md) + var(--pd-md) * 2);
    padding: 0 var(--pd-lg);
    z-index: 100;
    transition: left 0.3s ease;
  }

  :global([data-view="split"]) .top-bar,
  :global([data-view="full"]) .top-bar {
    background: transparent;
  }

  .top-bar-left {
    display: flex;
    align-items: center;
    gap: var(--pd-md);
  }

  .top-bar-center {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    min-width: 0;
  }

  .top-bar-right {
    display: flex;
    align-items: center;
    gap: var(--pd-md);
  }
</style>

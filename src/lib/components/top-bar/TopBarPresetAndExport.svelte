<script lang="ts">
  /**
   * Top bar left section: panel toggle, preset selector, copy preset, image/video export.
   */
  import { Button, ButtonGroup, IconSvg } from '../ui';

  interface Props {
    presetLabel: string;
    isPanelVisible: boolean;
    isVideoExportSupported?: boolean;
    /** When true, preset button shows "Loading…" and is disabled. */
    presetLoading?: boolean;
    onPanelToggle?: () => void;
    onPresetClick?: (e: MouseEvent) => void;
    onCopyPreset?: () => void | Promise<void>;
    onExport?: () => void | Promise<void>;
    onVideoExport?: () => void | Promise<void>;
  }

  let {
    presetLabel,
    isPanelVisible,
    isVideoExportSupported = true,
    presetLoading = false,
    onPanelToggle,
    onPresetClick,
    onCopyPreset,
    onExport,
    onVideoExport,
  }: Props = $props();
</script>

<div class="top-bar-preset-and-export">
  <ButtonGroup role="group" ariaLabel="Panel, preset and export">
    {#if !isPanelVisible}
      <Button variant="ghost" size="sm" mode="icon-only" title="Open node panel" onclick={() => onPanelToggle?.()}>
        <IconSvg name="layout-grid" variant="filled" />
      </Button>
    {/if}
    <Button variant="ghost" size="sm" mode="both" title={presetLoading ? 'Loading preset…' : 'Select preset'} disabled={presetLoading} onclick={onPresetClick}>
      <IconSvg name="folder-open" variant="filled" />
      <span class="top-bar-preset-button-label">{presetLoading ? 'Loading…' : presetLabel}</span>
    </Button>
    <Button variant="ghost" size="sm" mode="icon-only" title="Copy Preset" onclick={onCopyPreset}>
      <IconSvg name="copy" variant="line" />
    </Button>
    <Button variant="ghost" size="sm" mode="icon-only" title="Save Image" onclick={onExport}>
      <IconSvg name="image-square" variant="line" />
    </Button>
    <Button
      variant="ghost"
      size="sm"
      mode="icon-only"
      title={isVideoExportSupported ? 'Save Video' : 'Video export requires WebCodecs (VideoEncoder/AudioEncoder)'}
      disabled={!isVideoExportSupported}
      onclick={onVideoExport}
    >
      <IconSvg name="video" variant="line" />
    </Button>
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
</style>

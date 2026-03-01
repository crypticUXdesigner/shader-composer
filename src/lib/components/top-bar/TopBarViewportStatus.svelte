<script lang="ts">
  /**
   * Top bar right section: FPS, zoom, help.
   */
  import { Button, ButtonGroup, IconSvg } from '../ui';

  interface Props {
    zoomPercent: number;
    fps: number;
    fpsColor: string;
    helpEnabled: boolean;
    onZoomClick?: () => void;
    onZoomDblClick?: () => void;
    onHelpClick?: () => void;
    onShortcutsClick?: () => void;
  }

  let {
    zoomPercent,
    fps,
    fpsColor,
    helpEnabled,
    onZoomClick,
    onZoomDblClick,
    onHelpClick,
    onShortcutsClick,
  }: Props = $props();
</script>

<div class="top-bar-viewport-status">
  <ButtonGroup role="group" ariaLabel="Zoom, shortcuts, help and FPS">
    <div class="top-bar-fps-display" style="font-family: 'JetBrains Mono', monospace; font-size: 12px; color: {fpsColor}; min-width: 50px; text-align: right; opacity: 0.7;">
      {fps > 0 ? `${fps.toFixed(1)} FPS` : '-- FPS'}
    </div>
    <Button variant="ghost" size="sm" mode="both" title="Zoom" onclick={onZoomClick} ondblclick={onZoomDblClick}>
      <IconSvg name="zoom-in" variant="filled" />
      <span class="top-bar-zoom-value-display">{zoomPercent}%</span>
    </Button>
    <Button variant="ghost" size="sm" mode="icon-only" title="Keyboard shortcuts" onclick={() => onShortcutsClick?.()}>
      <IconSvg name="keyboard" variant="line" />
    </Button>
    <Button variant="ghost" size="sm" mode="icon-only" title="Help" disabled={!helpEnabled} onclick={() => onHelpClick?.()}>
      <IconSvg name="help-circle" variant="filled" />
    </Button>
  </ButtonGroup>
</div>

<style>
  .top-bar-viewport-status {
    display: flex;
    align-items: center;
    gap: var(--pd-md);
  }

  .top-bar-fps-display {
    width: var(--size-2xl);
  }

  .top-bar-zoom-value-display {
    min-width: var(--size-md);
    text-align: left;
    white-space: nowrap;
  }
</style>

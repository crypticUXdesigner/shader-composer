<script lang="ts">
  /**
   * Top bar right section: FPS, zoom, help.
   */
  import { Button, ButtonGroup, IconSvg } from '../ui';
  import { createStrictDoubleClickHandler } from '../../utils/strictDoubleClick';

  interface Props {
    zoomPercent: number;
    fps: number;
    fpsColor: string;
    helpEnabled: boolean;
    onZoomChange?: (zoom: number) => void;
    onHelpClick?: () => void;
    onShortcutsClick?: () => void;
  }

  let {
    zoomPercent,
    fps,
    fpsColor,
    helpEnabled,
    onZoomChange,
    onHelpClick,
    onShortcutsClick,
  }: Props = $props();

  let isEditingZoom = $state(false);
  let zoomEditText = $state('');
  let zoomInputEl = $state<HTMLInputElement | undefined>(undefined);

  function startZoomEditing() {
    zoomEditText = String(Math.round(zoomPercent));
    isEditingZoom = true;
    queueMicrotask(() => {
      zoomInputEl?.focus();
      zoomInputEl?.select();
    });
  }

  function cancelZoomEditing() {
    isEditingZoom = false;
  }

  const strictZoomEditing = createStrictDoubleClickHandler((e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startZoomEditing();
  });

  function commitZoomEditing() {
    const raw = Number.parseFloat(zoomEditText);
    if (!Number.isFinite(raw)) {
      cancelZoomEditing();
      return;
    }
    const clampedPercent = Math.max(10, Math.min(100, Math.round(raw)));
    onZoomChange?.(clampedPercent / 100);
    isEditingZoom = false;
  }
</script>

<div class="top-bar-viewport-status">
  <ButtonGroup role="group" ariaLabel="Zoom, shortcuts, help and FPS">
    <div class="top-bar-fps-display" style="font-family: 'JetBrains Mono', monospace; font-size: 12px; color: {fpsColor}; min-width: 50px; text-align: right; opacity: 0.7;">
      {fps > 0 ? `${fps.toFixed(1)} FPS` : '-- FPS'}
    </div>
    <Button
      variant="ghost"
      size="sm"
      mode="both"
      title="Zoom — double-click to edit"
      onclick={strictZoomEditing}
    >
      <IconSvg name="zoom-in" variant="filled" />
      {#if isEditingZoom}
        <input
          bind:this={zoomInputEl}
          class="top-bar-zoom-input"
          type="number"
          inputmode="numeric"
          min={10}
          max={100}
          step={1}
          value={zoomEditText}
          aria-label="Zoom percentage"
          title="Zoom percentage (10–100)"
          oninput={(e: Event) => (zoomEditText = (e.target as HTMLInputElement).value)}
          onblur={() => commitZoomEditing()}
          onkeydown={(e: KeyboardEvent) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitZoomEditing();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              cancelZoomEditing();
            }
          }}
          onclick={(e: MouseEvent) => e.stopPropagation()}
        />
        <span class="top-bar-zoom-suffix">%</span>
      {:else}
        <span class="top-bar-zoom-value-display">{zoomPercent}%</span>
      {/if}
    </Button>
    <Button variant="ghost" size="sm" mode="icon-only" title="Keyboard shortcuts" onclick={() => onShortcutsClick?.()}>
      <IconSvg name="keyboard" variant="line" />
    </Button>
    <Button variant="ghost" size="sm" mode="icon-only" title="Help" disabled={!helpEnabled} onclick={() => onHelpClick?.()}>
      <IconSvg name="book-open-text" variant="filled" />
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

  .top-bar-zoom-input {
    width: 6ch;
    text-align: right;
    font: inherit;
    color: inherit;
    background: transparent;
    border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
    border-radius: var(--radius-sm);
    padding: 2px 6px;
    margin-left: 2px;
    outline: none;
    appearance: textfield;
    -webkit-appearance: textfield;
    -moz-appearance: textfield;
  }

  /* Hide number input spinners (up/down buttons) */
  .top-bar-zoom-input::-webkit-outer-spin-button,
  .top-bar-zoom-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .top-bar-zoom-input[type='number'] {
    appearance: textfield;
    -moz-appearance: textfield;
  }

  .top-bar-zoom-input:focus-visible {
    border-color: color-mix(in srgb, currentColor 45%, transparent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary-100) 35%, transparent);
  }

  .top-bar-zoom-suffix {
    margin-left: 4px;
    opacity: 0.9;
  }
</style>

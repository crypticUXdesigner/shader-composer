<script lang="ts">
  /**
   * ColorPickerRow - Two OKLCH color swatches in one row.
   * Parity with canvas ColorPickerRowElement.
   * Click swatch opens ColorPickerPopover via overlay bridge.
   */
  import { oklchToCssRgb } from '../../../../utils/colorConversion';

  interface Props {
    startColor: { l: number; c: number; h: number };
    endColor: { l: number; c: number; h: number };
    disabled?: boolean;
    class?: string;
    onStartColorClick?: (screenX: number, screenY: number) => void;
    onEndColorClick?: (screenX: number, screenY: number) => void;
    onStartColorChange?: (l: number, c: number, h: number) => void;
    onEndColorChange?: (l: number, c: number, h: number) => void;
  }

  let {
    startColor,
    endColor,
    disabled = false,
    class: className = '',
    onStartColorClick,
    onEndColorClick,
  }: Props = $props();

  const startRgb = $derived(oklchToCssRgb(startColor.l, startColor.c, startColor.h));
  const endRgb = $derived(oklchToCssRgb(endColor.l, endColor.c, endColor.h));

  function handleStartClick(e: MouseEvent) {
    if (disabled) return;
    onStartColorClick?.(e.clientX, e.clientY);
  }

  function handleEndClick(e: MouseEvent) {
    if (disabled) return;
    onEndColorClick?.(e.clientX, e.clientY);
  }
</script>

<div class="color-picker-row {className}" data-disabled={disabled || undefined}>
  <button
    type="button"
    class="swatch"
    style="background: {startRgb};"
    disabled={disabled}
    onclick={handleStartClick}
    aria-label="Start color"
  ></button>
  <button
    type="button"
    class="swatch"
    style="background: {endRgb};"
    disabled={disabled}
    onclick={handleEndClick}
    aria-label="End color"
  ></button>
</div>

<style>
  .color-picker-row {
    /* Layout */
    display: flex;
    flex: 1;
    min-height: 0;
    align-items: stretch;
    gap: var(--pd-md);

    /* Box model */
    width: 100%;
    padding: var(--embed-slot-pd);
    background: var(--embed-slot-bg);
    border-radius: var(--embed-slot-radius);
    border: 1px solid var(--color-gray-70);
    box-sizing: border-box;

    .swatch {
      /* Layout */
      flex: 1;
      align-self: stretch;

      /* Box model */
      padding: 0;
      border: 1px solid var(--color-gray-70);
      border-radius: var(--color-picker-node-swatch-color-radius);
      cursor: default;
      transition: border-color 0.15s, box-shadow 0.15s;
    }

    .swatch:hover:not(:disabled) {
      border-color: var(--color-gray-90);
      box-shadow: 0 0 0 2px var(--color-gray-80);
    }

    .swatch:disabled {
      opacity: var(--opacity-disabled);
      cursor: not-allowed;
    }
  }
</style>

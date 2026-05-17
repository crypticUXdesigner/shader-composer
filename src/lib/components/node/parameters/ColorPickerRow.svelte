<script lang="ts">
  /**
   * ColorPickerRow - OKLCH color swatches in one row (equal width).
   * Parity with canvas ColorPickerRowElement.
   */
  import { oklchToCssRgb } from '../../../../utils/colorConversion';

  export type OklchColor = { l: number; c: number; h: number };

  interface Props {
    colors?: OklchColor[];
    disabled?: boolean;
    class?: string;
    onColorClick?: (index: number, screenX: number, screenY: number) => void;
    /** @deprecated Use `colors` + `onColorClick` */
    startColor?: OklchColor;
    /** @deprecated Use `colors` + `onColorClick` */
    endColor?: OklchColor;
    /** @deprecated Use `onColorClick` */
    onStartColorClick?: (screenX: number, screenY: number) => void;
    /** @deprecated Use `onColorClick` */
    onEndColorClick?: (screenX: number, screenY: number) => void;
  }

  let {
    colors: colorsProp,
    disabled = false,
    class: className = '',
    onColorClick,
    startColor,
    endColor,
    onStartColorClick,
    onEndColorClick,
  }: Props = $props();

  const colors = $derived(
    colorsProp ??
      (startColor != null && endColor != null ? [startColor, endColor] : []),
  );

  const cssColors = $derived(
    colors.map((color) => oklchToCssRgb(color.l, color.c, color.h)),
  );

  function handleClick(index: number, e: MouseEvent) {
    if (disabled) return;
    if (onColorClick) {
      onColorClick(index, e.clientX, e.clientY);
      return;
    }
    if (index === 0) onStartColorClick?.(e.clientX, e.clientY);
    else if (index === 1) onEndColorClick?.(e.clientX, e.clientY);
  }
</script>

<div class="color-picker-row {className}" data-disabled={disabled || undefined}>
  {#each cssColors as rgb, index (index)}
    <button
      type="button"
      class="swatch"
      style="background: {rgb};"
      disabled={disabled}
      onclick={(e) => handleClick(index, e)}
      aria-label="Color {index + 1}"
    ></button>
  {/each}
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
      transition:
        border-color var(--motion-effects-fast-duration) var(--motion-effects-fast-easing),
        box-shadow var(--motion-effects-fast-duration) var(--motion-effects-fast-easing);
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

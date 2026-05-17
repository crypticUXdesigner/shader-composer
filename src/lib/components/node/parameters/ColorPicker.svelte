<script lang="ts">
  /**
   * ColorPicker - Single OKLCH color swatch.
   * Parity with canvas ColorPickerElement.
   * Click swatch opens ColorPickerPopover via overlay bridge.
   */
  import { oklchToCssRgb } from '../../../../utils/colorConversion';

  interface Props {
    color: { l: number; c: number; h: number };
    /** `compact` — fixed square swatch for dense lists (e.g. track filter rows). */
    variant?: 'default' | 'compact';
    disabled?: boolean;
    class?: string;
    onClick?: (screenX: number, screenY: number) => void;
  }

  let {
    color,
    variant = 'default',
    disabled = false,
    class: className = '',
    onClick,
  }: Props = $props();

  const rgb = $derived(oklchToCssRgb(color.l, color.c, color.h));

  function handleClick(e: MouseEvent) {
    if (disabled) return;
    onClick?.(e.clientX, e.clientY);
  }
</script>

<div
  class="color-picker {variant === 'compact' ? 'is-compact' : ''} {className}"
  data-disabled={disabled || undefined}
>
  <button
    type="button"
    class="swatch"
    style="background: {rgb};"
    disabled={disabled}
    onclick={handleClick}
    aria-label="Color"
  ></button>
</div>

<style>
  .color-picker {
    /* Layout */
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;

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
      min-height: 0;

      /* Box model */
      width: 100%;
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

  .color-picker.is-compact {
    flex: none;
    width: 1.25rem;
    min-height: auto;
    padding: 0;
    border: none;
    background: transparent;

    .swatch {
      flex: none;
      width: 1.25rem;
      height: 1.25rem;
      min-height: 1.25rem;
      border-radius: var(--radius-sm);
    }
  }
</style>

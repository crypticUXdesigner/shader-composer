<script lang="ts">
  /**
   * EnumSelector - Button that opens a dropdown for int params with enum mappings.
   * Uses Button (secondary, md) styling. Styled to match node parameter controls.
   */
  import { Button, DropdownMenu, IconSvg } from '../../ui';

  interface Props {
    value: number;
    options: Record<number, string>;
    disabled?: boolean;
    /** When true, show prev/next chevrons after the preset label button (e.g. color-lut). */
    showSteppers?: boolean;
    class?: string;
    onChange?: (value: number) => void;
    onCommit?: (value: number) => void;
  }

  let {
    value,
    options,
    disabled = false,
    showSteppers = false,
    class: className = '',
    onChange,
    onCommit,
  }: Props = $props();

  let menuOpen = $state(false);
  let triggerEl = $state<HTMLElement | null>(null);

  const entries = $derived(
    Object.entries(options)
      .map(([k, v]) => ({ value: parseInt(k, 10), label: v }))
      .sort((a, b) => a.value - b.value)
  );

  /** Coerce floats (automation/audio) onto integer enum indices so lookups and dropdown selection work. */
  const coercedValue = $derived.by(() => {
    const keys = entries.map((e) => e.value);
    if (keys.length === 0) return value;
    const lo = keys[0]!;
    const hi = keys[keys.length - 1]!;
    if (!Number.isFinite(value)) return lo;
    let r = Math.round(Math.min(hi, Math.max(lo, value)));
    if (keys.includes(r)) return r;
    return keys.reduce((best, k) => (Math.abs(k - value) < Math.abs(best - value) ? k : best));
  });

  const currentLabel = $derived(options[coercedValue] ?? String(coercedValue));

  const menuItems = $derived(
    entries.map((e) => ({
      label: e.label,
      selected: e.value === coercedValue,
      action: () => {
        onChange?.(e.value);
        onCommit?.(e.value);
        menuOpen = false;
      }
    }))
  );

  const menuPos = $derived.by(() => {
    if (!triggerEl) return { x: 0, y: 0 };
    const _ = menuOpen; // Re-run when opening so we get fresh position after zoom/pan
    const r = triggerEl.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });

  const valueKeys = $derived(entries.map((e) => e.value));

  function stepPreset(delta: -1 | 1) {
    const keys = valueKeys;
    if (keys.length === 0 || disabled) return;
    const idx = keys.indexOf(coercedValue);
    const from = idx >= 0 ? idx : 0;
    const next = (from + delta + keys.length) % keys.length;
    const nextValue = keys[next]!;
    onChange?.(nextValue);
    onCommit?.(nextValue);
    menuOpen = false;
  }
</script>

<div class="enum-selector-row {className}" class:with-steppers={showSteppers}>
  <div bind:this={triggerEl} class="enum-selector-trigger">
    <Button
      variant="secondary"
      size="md"
      mode="label-only"
      disabled={disabled}
      onclick={() => (menuOpen = !menuOpen)}
      aria-haspopup="listbox"
      aria-expanded={menuOpen}
    >
      <span class="label">{currentLabel}</span>
    </Button>
  </div>
  {#if showSteppers}
    <Button
      variant="secondary"
      size="md"
      mode="icon-only"
      class="enum-stepper"
      disabled={disabled || valueKeys.length < 2}
      title="Previous preset"
      aria-label="Previous preset"
      onclick={() => stepPreset(-1)}
    >
      <IconSvg name="chevron-left" variant="line" />
    </Button>
    <Button
      variant="secondary"
      size="md"
      mode="icon-only"
      class="enum-stepper"
      disabled={disabled || valueKeys.length < 2}
      title="Next preset"
      aria-label="Next preset"
      onclick={() => stepPreset(1)}
    >
      <IconSvg name="chevron-right" variant="line" />
    </Button>
  {/if}
</div>

<DropdownMenu
  open={menuOpen}
  x={menuPos.x}
  y={menuPos.y}
  anchorToSelected
  items={menuItems}
  onClose={() => (menuOpen = false)}
/>

<style>
  .enum-selector-row {
    display: flex;
    align-items: stretch;
    gap: var(--pd-xs);
    width: fit-content;
    max-width: 100%;
    align-self: flex-start;
  }

  .enum-selector-trigger {
    display: flex;
    min-width: 120px;
    max-width: 220px;
    width: fit-content;

    .with-steppers & {
      min-width: 88px;
      max-width: 152px;
    }

    :global(.button) {
      flex: 1;
      min-width: 0;
      justify-content: flex-start;
    }

    .with-steppers & :global(.button) {
      flex: 0 1 auto;
      width: 100%;
    }

    .label {
      min-width: 0;
      text-align: left;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .enum-stepper {
    flex-shrink: 0;
  }
</style>

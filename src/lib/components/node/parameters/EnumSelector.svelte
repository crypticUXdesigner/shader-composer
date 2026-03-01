<script lang="ts">
  /**
   * EnumSelector - Button that opens a dropdown for int params with enum mappings.
   * Uses Button (secondary, md) styling. Styled to match node parameter controls.
   */
  import { Button, DropdownMenu } from '../../ui';

  interface Props {
    value: number;
    options: Record<number, string>;
    disabled?: boolean;
    class?: string;
    onChange?: (value: number) => void;
    onCommit?: (value: number) => void;
  }

  let {
    value,
    options,
    disabled = false,
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

  const currentLabel = $derived(options[value] ?? String(value));

  const menuItems = $derived(
    entries.map((e) => ({
      label: e.label,
      selected: e.value === value,
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
</script>

<div bind:this={triggerEl} class="enum-selector-trigger {className}">
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

<DropdownMenu
  open={menuOpen}
  x={menuPos.x}
  y={menuPos.y}
  anchorToSelected
  items={menuItems}
  onClose={() => (menuOpen = false)}
/>

<style>
  .enum-selector-trigger {
    display: flex;
    min-width: 120px;
    max-width: 220px;
    width: fit-content;

    :global(.button) {
      flex: 1;
      min-width: 0;
      justify-content: flex-start;
    }

    .label {
      min-width: 0;
      text-align: left;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
</style>

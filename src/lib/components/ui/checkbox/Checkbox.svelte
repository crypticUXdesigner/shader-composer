<script lang="ts">
  /**
   * Shared checkbox control. Uses design tokens for disabled state.
   */
  interface Props {
    checked?: boolean;
    disabled?: boolean;
    label?: string;
    onchange?: (checked: boolean) => void;
    children?: import('svelte').Snippet<[]>;
    class?: string;
  }

  let {
    checked = $bindable(false),
    disabled = false,
    label = '',
    onchange,
    children,
    class: className = '',
  }: Props = $props();

  function handleChange(e: Event) {
    const el = e.currentTarget as HTMLInputElement;
    checked = el.checked;
    onchange?.(el.checked);
  }
</script>

<label class="checkbox {className || ''}" class:is-disabled={disabled}>
  <input
    type="checkbox"
    {checked}
    {disabled}
    onchange={handleChange}
    class="input"
    aria-label={label || undefined}
  />
  <span class="label">
    {#if children}
      {@render children()}
    {:else if label}
      {label}
    {/if}
  </span>
</label>

<style>
  .checkbox {
    /* layout */
    display: inline-flex;
    align-items: center;
    gap: var(--pd-sm);
    /* visual */
    cursor: default;
    font-size: var(--text-sm);
    color: var(--color-gray-90);

    &.is-disabled {
      cursor: not-allowed;
      opacity: var(--opacity-disabled);
    }

    .input {
      flex-shrink: 0;
      width: 1em;
      height: 1em;
      margin: 0;
      accent-color: var(--primary-bg, currentColor);
    }

    .label {
      user-select: none;
    }
  }
</style>

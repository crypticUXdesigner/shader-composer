<script lang="ts">
  interface Props {
    label: string;
    disabled?: boolean;
    selected?: boolean;
    desc?: string;
    icon?: import('svelte').Snippet<[]>;
    onclick?: (e: MouseEvent) => void;
    class?: string;
  }

  let {
    label,
    disabled = false,
    selected = false,
    desc = '',
    icon,
    onclick,
    class: className = ''
  }: Props = $props();

  function handleClick(e: MouseEvent) {
    e.stopPropagation();
    if (!disabled) {
      onclick?.(e);
    }
  }
</script>

<button
  type="button"
  class="menu-item {className}"
  class:is-disabled={disabled}
  class:is-selected={selected}
  {disabled}
  onclick={handleClick}
>
  {#if icon}
    <span class="icon">
      {@render icon()}
    </span>
  {/if}
  <span class="content">
    <span class="name">{label}</span>
    {#if desc}
      <span class="desc">{desc}</span>
    {/if}
  </span>
</button>

<style>
  /* MenuItem styles */
  .menu-item {
    /* Layout */
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: var(--pd-sm);
    min-height: var(--size-md);

    /* Box model */
    padding: var(--pd-sm) var(--pd-lg);

    /* Visual */
    color: var(--menu-item-color);

    /* Typography */
    font-size: var(--text-md);
    text-align: left;

    /* Other */
    cursor: default;
    outline: none;
    transition: background 0.15s;

    &:hover:not(.is-disabled),
    &.is-selected:not(.is-disabled) {
      background: var(--menu-item-bg-hover);
    }

    &.is-disabled {
      opacity: var(--opacity-disabled);
      cursor: not-allowed;
    }

    .icon {
      /* Layout */
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      /* Box model */
      width: calc(var(--size-xs) + var(--scale-1));
      height: calc(var(--size-xs) + var(--scale-1));

      /* Visual */
      color: var(--menu-item-color);

      :global(svg) {
        width: var(--scale-5);
        height: var(--scale-5);
      }
    }

    .content {
      flex: 1;
      min-width: 0;

      .name {
        margin-bottom: var(--pd-xs);
        font-weight: bold;
      }

      .desc {
        font-size: var(--text-sm);
        color: var(--search-result-desc-color);
      }
    }
  }
</style>

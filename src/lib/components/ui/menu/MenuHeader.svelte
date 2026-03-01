<script lang="ts">
  interface Props {
    text?: string;
    children?: import('svelte').Snippet<[]>;
    class?: string;
  }

  let { text, children, class: className = '' }: Props = $props();
</script>

<div class="menu-header {className}">
  {#if text !== undefined}
    {text}
  {:else}
    {@render children?.()}
  {/if}
</div>

<style>
  .menu-header {
    /* Box model */
    padding: var(--pd-xs) var(--menu-item-padding);

    /* Typography */
    font-size: var(--text-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: var(--scale-1);
    color: var(--menu-header-color);
  }
</style>

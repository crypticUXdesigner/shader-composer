<script lang="ts">
  /**
   * Badge component for displaying counts and labels.
   */
  interface Props {
    children?: import('svelte').Snippet;
    value?: string | number;
  }

  let { children, value }: Props = $props();
</script>

<span class="badge">
  {#if children}
    {@render children()}
  {:else if value !== undefined}
    {value}
  {/if}
</span>

<style>
  .badge {
    /* Layout */
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    /* Box model */
    padding: var(--pd-xs) calc(var(--pd-sm) + var(--pd-xs));
    min-width: var(--size-sm);
    width: fit-content;
    height: fit-content;
    border-radius: var(--radius-md);
    border: 2px solid var(--color-gray-50);

    /* Visual */
    background: var(--color-blue-gray-50);
    color: var(--color-blue-gray-100);

    /* Typography */
    font-family: inherit;
    font-size: var(--text-xs);
    font-weight: 600;
    line-height: 1;
  }
</style>

<script lang="ts">
  interface Props {
    children?: import('svelte').Snippet<[]>;
    class?: string;
  }

  let { children, class: className = '' }: Props = $props();
</script>

<div class="menu-no-results {className}">
  {@render children?.()}
</div>

<style>
  .menu-no-results {
    /* Box model */
    padding: var(--pd-lg);

    /* Typography */
    text-align: center;
    color: var(--search-no-results-color);
  }
</style>

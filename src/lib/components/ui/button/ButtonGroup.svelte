<script lang="ts">
  interface Props {
    children?: import('svelte').Snippet<[]>;
    class?: string;
    role?: string;
    /** Forwarded to aria-label for accessibility */
    ariaLabel?: string;
  }

  let { children, class: className = '', role, ariaLabel }: Props = $props();
</script>

<div class="button-group control-strip {className}" {role} aria-label={ariaLabel}>
  {@render children?.()}
</div>

<style>
  .button-group {
    /* Layout */
    display: flex;
    align-items: center;
  }
</style>

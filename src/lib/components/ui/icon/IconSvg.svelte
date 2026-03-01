<script lang="ts">
  import { getIconHtml } from '../../../../utils/icons';
  import type { IconName } from '../../../../utils/icons';

  interface Props {
    name: IconName;
    variant?: 'line' | 'filled';
    class?: string;
  }

  let { name, variant, class: className = '' }: Props = $props();

  const svgHtml = $derived.by(() =>
    name ? getIconHtml(name, 'currentColor', 'icon', variant) : ''
  );
</script>

<div class="icon-svg {className}">
  {@html svgHtml}
</div>

<style>
  .icon-svg {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .icon-svg :global(svg) {
    display: block;
    flex-shrink: 0;
    pointer-events: none;
    width: 1em;
    height: 1em;
    min-width: 16px;
    min-height: 16px;
  }
</style>

<script lang="ts">
  import { getNodeIconHtml } from '../../../../utils/icons';
  import type { NodeIconIdentifier } from '../../../../utils/icons';

  interface Props {
    identifier: NodeIconIdentifier | string;
    class?: string;
  }

  let { identifier, class: className = '' }: Props = $props();

  const svgHtml = $derived.by(() =>
    identifier ? getNodeIconHtml(identifier, 'currentColor', 'item-icon') : ''
  );
</script>

<div class="node-icon-svg {className}">
  {@html svgHtml}
</div>

<style>
  .node-icon-svg {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .node-icon-svg :global(svg) {
    display: block;
    flex-shrink: 0;
    pointer-events: none;
    width: 1em;
    height: 1em;
    min-width: 16px;
    min-height: 16px;
  }
</style>

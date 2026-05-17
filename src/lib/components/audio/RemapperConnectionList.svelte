<script lang="ts">
  import { MenuItem } from '../ui';
  import type { RemapperParameterConnectionTarget } from '../../../utils/getRemapperParameterConnections';

  interface Props {
    connections: RemapperParameterConnectionTarget[];
    onReveal?: (nodeId: string, paramName: string) => void;
  }

  let { connections, onReveal }: Props = $props();
</script>

{#if connections.length > 0}
  <ul class="connection-list" aria-label="Connected parameters">
    {#each connections as target (target.nodeId + ':' + target.paramName)}
      <li>
        <MenuItem
          label={target.label}
          onclick={() => onReveal?.(target.nodeId, target.paramName)}
        />
      </li>
    {/each}
  </ul>
{/if}

<style>
  .connection-list {
    display: flex;
    flex-direction: column;
    gap: var(--pd-2xs);
    margin: 0;
    padding: 0 var(--pd-xs) var(--pd-sm);
    list-style: none;
    width: 100%;
    box-sizing: border-box;

    li {
      width: 100%;
      min-width: 0;
    }

    :global(.menu-item) {
      width: 100%;
      box-sizing: border-box;
    }

    /* Pressed state aligned with menu selection (MenuItem has hover/focus only). */
    :global(.menu-item:active:not(.is-disabled)) {
      background: var(--ghost-bg-active);
      color: var(--color-blue-110);
    }
  }
</style>

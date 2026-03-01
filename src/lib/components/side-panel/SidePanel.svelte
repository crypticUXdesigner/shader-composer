<script lang="ts">
  /**
   * Side panel container: tabs (Nodes / Docs), tab content slots, resize handle.
   * State (activeTab, isPanelVisible, panelWidth) and resize logic are owned by the parent (NodeEditorLayout).
   */
  import { Button, ButtonGroup, IconSvg } from '../ui';

  interface Props {
    isPanelVisible?: boolean;
    panelWidth?: number;
    activeTab?: 'nodes' | 'docs';
    onTabChange?: (tab: 'nodes' | 'docs') => void;
    onPanelToggle?: () => void;
    nodesPanel?: import('svelte').Snippet<[]>;
    docsPanel?: import('svelte').Snippet<[]>;
  }

  let {
    isPanelVisible = false,
    panelWidth = 300,
    activeTab = 'nodes',
    onTabChange,
    onPanelToggle,
    nodesPanel,
    docsPanel,
  }: Props = $props();
</script>

<div
  class="side-panel-container frame"
  class:is-visible={isPanelVisible}
  style="--panel-width-dynamic: {panelWidth}px;"
>
  <div class="wrapper">
    <div class="bar">
      <ButtonGroup role="tablist" ariaLabel="Side panel tabs">
        <Button
          variant="ghost"
          size="sm"
          class={activeTab === 'nodes' ? 'is-active' : ''}
          role="tab"
          aria-selected={activeTab === 'nodes'}
          aria-controls="side-panel-panel-nodes"
          id="side-panel-tab-nodes"
          onclick={() => onTabChange?.('nodes')}
        >
          Nodes
        </Button>
        <Button
          variant="ghost"
          size="sm"
          class={activeTab === 'docs' ? 'is-active' : ''}
          role="tab"
          aria-selected={activeTab === 'docs'}
          aria-controls="side-panel-panel-docs"
          id="side-panel-tab-docs"
          onclick={() => onTabChange?.('docs')}
        >
          Docs
        </Button>
      </ButtonGroup>
      <Button variant="ghost" size="sm" mode="both" title="Close panel" onclick={() => onPanelToggle?.()}>
        Close
        <IconSvg name="x" variant="line" />
      </Button>
    </div>
    <div class="content frame-elevated">
      {#if activeTab === 'nodes'}
        <div id="side-panel-panel-nodes" role="tabpanel" aria-labelledby="side-panel-tab-nodes" class="panel">
          {#if nodesPanel}
            {@render nodesPanel()}
          {/if}
        </div>
      {:else}
        <div id="side-panel-panel-docs" role="tabpanel" aria-labelledby="side-panel-tab-docs" class="panel">
          {#if docsPanel}
            {@render docsPanel()}
          {:else}
            <div class="placeholder">Documentation</div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .side-panel-container {
    /* Extra offset when closed so box-shadow (spread + blur) is fully off-screen */
    --panel-hidden-offset: 40px;
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: var(--panel-width-dynamic, var(--panel-width));
    transform: translateX(calc(-100% - var(--panel-hidden-offset)));
    z-index: var(--z-panel);
    overflow: visible;
    transition: transform 0.3s ease;
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
    box-shadow: 0 0 0 6px var(--color-gray-20), 0 0 30px 6px var(--color-gray-20);

    &.is-visible {
      transform: translateX(0);
    }

    .wrapper {
      display: flex;
      flex-direction: column;
      position: absolute;
      inset: 0;
      min-height: 0;

      .bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-shrink: 0;
        gap: var(--pd-md);
        height: calc(var(--size-md) + var(--pd-md) * 2);
        padding: 0 var(--pd-md);
      }

      .content {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
        overflow: hidden;
        border-bottom-left-radius: 0;

        .panel {
          position: relative;
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
          overflow: hidden;

          .placeholder {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: var(--text-sm);
            color: var(--print-subtle);
          }
        }
      }
    }

  }
</style>

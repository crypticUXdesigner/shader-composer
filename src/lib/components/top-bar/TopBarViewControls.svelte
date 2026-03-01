<script lang="ts">
  /**
   * Top bar center section: view mode (Node | Split | Full).
   */
  import { Button, ButtonGroup } from '../ui';
  import type { ViewMode } from '../editor/types';

  interface Props {
    viewMode: ViewMode;
    setViewMode: (mode: ViewMode) => void;
  }

  let { viewMode, setViewMode }: Props = $props();
</script>

<div class="top-bar-view-controls">
  <ButtonGroup class="top-bar-view-mode-group" role="group" ariaLabel="View mode">
    <Button variant="ghost" size="sm" class={viewMode === 'node' ? 'is-active' : ''} onclick={() => setViewMode('node')} title="Node editor with small shader preview">Node</Button>
    <Button variant="ghost" size="sm" class={viewMode === 'split' ? 'is-active' : ''} onclick={() => setViewMode('split')} title="Node editor and shader preview side by side">Split</Button>
    <Button variant="ghost" size="sm" class={viewMode === 'full' ? 'is-active' : ''} onclick={() => setViewMode('full')} title="Shader fills viewport">Full</Button>
  </ButtonGroup>
</div>

<style>
  .top-bar-view-controls {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    min-width: 0;
  }

  :global(.top-bar-view-mode-group) {
    display: inline-flex;
    align-items: stretch;
  }
</style>

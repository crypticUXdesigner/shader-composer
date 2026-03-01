<script lang="ts">
  /**
   * Modal that lists keyboard shortcuts. Surfaces F5 (document and surface shortcuts in-app).
   */
  import { Modal, Button } from '../ui';

  interface Props {
    open?: boolean;
    onClose?: () => void;
  }

  let { open = false, onClose }: Props = $props();

  const shortcuts = [
    { keys: 'Delete / Backspace', action: 'Delete selected nodes' },
    { keys: 'Ctrl/Cmd + Z', action: 'Undo' },
    { keys: 'Ctrl/Cmd + Shift + Z', action: 'Redo' },
    { keys: 'Ctrl/Cmd + C', action: 'Copy selected nodes' },
    { keys: 'Ctrl/Cmd + V', action: 'Paste nodes' },
    { keys: 'Ctrl/Cmd + A', action: 'Select all nodes' },
    { keys: 'Ctrl/Cmd + D', action: 'Duplicate selected nodes' },
    { keys: 'Spacebar (hold)', action: 'Temporary pan (Hand tool)' },
  ];
</script>

<Modal {open} {onClose} class="keyboard-shortcuts-modal">
  <div class="shortcuts-content">
    <h2 class="shortcuts-title">Keyboard shortcuts</h2>
    <dl class="shortcuts-list">
      {#each shortcuts as { keys, action }}
        <dt class="shortcuts-keys">{keys}</dt>
        <dd class="shortcuts-action">{action}</dd>
      {/each}
    </dl>
    <div class="shortcuts-actions">
      <Button variant="primary" size="sm" onclick={() => onClose?.()}>Close</Button>
    </div>
  </div>
</Modal>

<style>
  .shortcuts-content {
    padding: var(--pd-lg);
    min-width: 280px;
  }

  .shortcuts-title {
    margin: 0 0 var(--pd-md);
    font-size: var(--font-size-lg);
    font-weight: 600;
  }

  .shortcuts-list {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--pd-xs) var(--pd-lg);
    margin: 0 0 var(--pd-lg);
    font-size: var(--font-size-sm);
  }

  .shortcuts-keys {
    margin: 0;
    font-family: var(--font-mono, ui-monospace, monospace);
    color: var(--text-secondary, #666);
  }

  .shortcuts-action {
    margin: 0;
  }

  .shortcuts-actions {
    display: flex;
    justify-content: flex-end;
  }
</style>

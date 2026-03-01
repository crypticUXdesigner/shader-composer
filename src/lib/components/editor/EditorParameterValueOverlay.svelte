<script lang="ts">
  /**
   * Editor overlay for editing a numeric parameter value (double-click value on canvas).
   * Uses the shared Input Svelte component.
   */
  import { tick } from 'svelte';
  import { Input } from '../ui';

  interface Props {
    visible: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
    value: number;
    paramType: 'int' | 'float';
    onCommit: (value: number) => void;
    onCancel: () => void;
  }

  let {
    visible,
    x,
    y,
    width,
    height,
    value,
    paramType,
    onCommit,
    onCancel,
  }: Props = $props();

  let wrapperEl = $state<HTMLDivElement | null>(null);
  let inputValue = $state('');

  $effect(() => {
    if (!visible) return;
    const displayValue =
      paramType === 'int' ? Math.round(value).toString() : Number(value).toFixed(3);
    inputValue = displayValue;
  });

  $effect(() => {
    if (!visible || !wrapperEl) return;
    tick().then(() => {
      const el = wrapperEl?.querySelector('input');
      el?.focus();
      el?.select();
    });
  });

  function handleCommit() {
    const num = parseFloat(inputValue);
    if (!Number.isNaN(num)) onCommit(num);
    else onCancel();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }
</script>

{#if visible}
  <div
    bind:this={wrapperEl}
    class="canvas-parameter-value-overlay"
    style="left: {x}px; top: {y}px; width: {width}px; height: {height}px;"
    role="dialog"
    aria-label="Edit parameter value"
  >
    <Input
      type="number"
      variant="primary"
      size="lg"
      value={inputValue}
      oninput={(e) => {
        inputValue = (e.currentTarget as HTMLInputElement).value;
      }}
      onblur={() => handleCommit()}
      onkeydown={handleKeydown}
      class="canvas-parameter-value-input"
    />
  </div>
{/if}

<style>
  .canvas-parameter-value-overlay {
    position: fixed;
    z-index: 1000;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .canvas-parameter-value-overlay :global(.input) {
    width: 100%;
    height: 100%;
    text-align: center;
  }
</style>

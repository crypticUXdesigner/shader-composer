<script lang="ts">
  /**
   * ParamCell — Layout wrapper for parameter cells (ParameterCell, CoordPadWithPorts).
   * Owns param-cell structure and scoped styles; root keeps .param-cell for node-category and NodeBody overrides.
   * Uses param-cell-* tokens (from tokens-node-editor.css).
   */
  import type { ParamCellProps as Props } from './ParamCell.types';

  let {
    connected = false,
    class: className = '',
    supportsAudio,
    supportsAnimation,
    label,
    inlineControl = false,
    timelineDriven = false,
    leftBottom: leftBottomSlot,
    control,
    children: _children,
  }: Props = $props();
</script>

{#if inlineControl}
  <div
    class="param-cell param-cell--inline-control {className}"
    class:connected
    data-timeline-driven={timelineDriven ? 'true' : undefined}
    data-supports-audio={supportsAudio === undefined ? undefined : supportsAudio ? 'true' : 'false'}
    data-supports-animation={supportsAnimation === undefined
      ? undefined
      : supportsAnimation
        ? 'true'
        : 'false'}
  >
    <div class="control-slot param-controls">
      {@render control()}
    </div>
  </div>
{:else}
  <div
    class="param-cell {className}"
    class:connected
    data-timeline-driven={timelineDriven ? 'true' : undefined}
    data-supports-audio={supportsAudio === undefined ? undefined : supportsAudio ? 'true' : 'false'}
    data-supports-animation={supportsAnimation === undefined
      ? undefined
      : supportsAnimation
        ? 'true'
        : 'false'}
  >
    <div class="left-column">
      <div class="top">
        <span class="label">{label}</span>
      </div>
      {#if leftBottomSlot}
        <div class="bottom">
          {@render leftBottomSlot()}
        </div>
      {/if}
    </div>

    <div class="control-slot param-controls">
      {@render control()}
    </div>
  </div>
{/if}

<style>
  /* Layout and tokens: param-cell-* from tokens-node-editor.css. Per-category overrides in node-categories. */
  .param-cell {
    /* Layout */
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--param-cell-gap);

    /* Box model */
    min-width: var(--param-cell-min-width);
    padding: var(--param-cell-padding);
    min-height: var(--param-cell-min-height);
    flex-grow: 0;
    flex-shrink: 1;
    flex-basis: auto;
    border: 1px solid var(--param-cell-border);
    border-radius: var(--param-cell-border-radius);

    /* Visual */
    background: var(--param-cell-bg);

    /* Other */
    transition:
      background var(--motion-effects-fast-duration) var(--motion-effects-fast-easing),
      border-color var(--motion-effects-fast-duration) var(--motion-effects-fast-easing);
  }

  .param-cell.connected {
    background: var(--param-cell-bg-connected);
    border-color: var(--param-cell-border-connected);
  }

  .param-cell--inline-control {
    /* Layout */
    display: inline-flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    flex-shrink: 0;

    /* Box model */
    min-width: 0;
    min-height: 0;
    padding: var(--pd-xs, 4px) var(--pd-sm, 8px);
  }

  .param-cell--inline-control .control-slot {
    flex: 0 0 auto;
    justify-content: center;
  }

  .left-column {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    flex-shrink: 0;
    align-self: stretch;
  }

  .left-column .top {
    display: flex;
    flex-direction: row;
    align-items: center;
    flex-shrink: 0;
    gap: var(--pd-xs, 4px);
  }

  .left-column .top .label {
    font-size: var(--param-label-font-size);
    font-weight: var(--param-label-font-weight);
    color: var(--param-label-color);
    text-align: left;
    flex-shrink: 0;
  }

  .left-column .bottom {
    display: flex;
    flex-direction: column;
    gap: var(--pd-md);
    flex-shrink: 0;
  }

  .left-column .bottom :global(.port-row) {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--pd-md);
    min-height: 32px;
  }

  .left-column .bottom :global(.port-row .signal) {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--pd-sm);
    min-width: 0;
    max-width: 90px; /* One-off: signal label + peak bar container */
  }

  .left-column .bottom :global(.port-row .signal .name) {
    position: absolute;
    bottom: 200%;
    left: 0;
    right: 0;
    font-size: var(--text-md);
    font-weight: var(--param-label-font-weight);
    color: var(--param-label-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .left-column .bottom :global(.port-row .signal .peak) {
    height: var(--scale-3); /* 6px */
    width: 100%;
    min-width: 90px;
    background: var(--color-gray-130);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .left-column .bottom :global(.port-row .signal .peak .fill) {
    height: 100%;
    background: var(--color-teal-100);
    border-radius: var(--radius-sm);
    /* Exception: ultra-fast linear width for live peak metering (not part of the standard motion scale). */
    transition: width 0.05s linear;
  }

  .control-slot {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--pd-sm);
    flex: 1;
    min-width: 0;
    justify-content: flex-end;
  }
</style>

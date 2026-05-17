<script lang="ts">
  /**
   * NodeHeader
   * Icon, label (double-click the label text to edit). Drag handle for node drag.
   * Output ports are positioned to align with the connection layer.
   * Input ports: port -> type -> name. Output ports: name -> type -> port.
   */

  import { IconSvg, NodeIconSvg } from '../ui';
  import { getNodeIcon, isRedundantOutputLabel } from '../../../utils/nodeSpecUtils';
  import type { NodeSpec, PortSpec } from '../../../types/nodeSpec';
  import type { SelectActiveBranchPort } from '../../../utils/selectActiveBranch';
  import type { PortPosition } from './types';
  import { nodeSupportsPower } from '../../../shaders/nodePower';
  import { createStrictDoubleClickHandler } from '../../utils/strictDoubleClick';

  /** Short display labels for port types (matches ParamPort/RenderingUtils) */
  const PORT_TYPE_LABELS: Record<string, string> = {
    float: 'ft',
    vec2: 'v2',
    vec3: 'v3',
    vec4: 'v4',
    int: 'int',
    bool: 'bool'
  };

  function getTypeLabel(port: PortSpec): string {
    return PORT_TYPE_LABELS[port.type] ?? port.type;
  }

  function getNameLabel(port: PortSpec): string {
    return port.label ?? port.name;
  }

  /** Output port display name: empty when single-output and label matches node name (e.g. input nodes). */
  function getOutputDisplayLabel(port: PortSpec): string {
    return isRedundantOutputLabel(spec, port) ? '' : getNameLabel(port);
  }

  interface Props {
    spec: NodeSpec;
    label: string;
    headerHeight: number;
    inputPortPositions?: Map<string, PortPosition>;
    outputPortPositions?: Map<string, PortPosition>;
    nodePosition: { x: number; y: number };
    nodeId: string;
    /** Present when this node type supports Power (see `nodeSupportsPower`). */
    bypassed?: boolean;
    onPowerToggle?: (nodeId: string, nextBypassed: boolean) => void;
    onLabelChange: (label: string | undefined) => void;
    onDragStart: (clientX: number, clientY: number, shiftKey: boolean) => void;
    onHeaderPortPointerDown?: (screenX: number, screenY: number, pointerId?: number) => void;
    /** Select node: which value input is active (condition > 0.5 → trueValue). */
    selectActiveBranchPort?: SelectActiveBranchPort | null;
  }

  let {
    spec,
    label,
    headerHeight,
    inputPortPositions,
    outputPortPositions,
    nodePosition,
    nodeId,
    bypassed = false,
    onPowerToggle,
    onLabelChange,
    onDragStart,
    onHeaderPortPointerDown,
    selectActiveBranchPort = null,
  }: Props = $props();

  let isEditing = $state(false);
  let editValue = $state('');
  let inputEl = $state<HTMLInputElement | null>(null);

  const displayLabel = $derived(label || spec.displayName);

  const supportsPower = $derived(nodeSupportsPower(spec));
  const isBypassed = $derived(bypassed === true);
  const powerHelp = $derived(
    isBypassed ? 'Power — node is bypassed' : 'Power — bypass this node'
  );

  function handlePowerClick(e: MouseEvent) {
    e.stopPropagation();
    onPowerToggle?.(nodeId, !isBypassed);
  }

  function handlePowerMouseDownCapture(e: MouseEvent) {
    // Wrapper installs a capture-phase mousedown listener for connection hit-testing/forwarding.
    // Stop here so canvas gestures don't interpret this UI click as background interaction.
    e.preventDefault();
    e.stopPropagation();
  }

  function handlePowerPointerDown(e: PointerEvent) {
    e.stopPropagation();
  }

  function beginLabelEdit(e: MouseEvent) {
    e.stopPropagation();
    isEditing = true;
    editValue = displayLabel;
    requestAnimationFrame(() => inputEl?.focus());
  }

  const labelStrictDoubleClick = createStrictDoubleClickHandler((e: MouseEvent) => beginLabelEdit(e));

  function commitEdit() {
    isEditing = false;
    const trimmed = editValue.trim();
    onLabelChange(trimmed === spec.displayName ? undefined : trimmed);
  }

  function cancelEdit() {
    isEditing = false;
    editValue = displayLabel;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  }

  function handlePointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    // Capture pointer so canvas doesn't receive move/up during drag (prevents unwanted pan)
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    onDragStart(e.clientX, e.clientY, e.shiftKey);
  }
</script>

<div
  class="node-header"
  role="presentation"
  style="height: {headerHeight}px; min-height: {headerHeight}px;"
>
  {#if supportsPower}
    <div class="power-row">
      <button
        type="button"
        class="power-toggle"
        aria-pressed={isBypassed}
        aria-label={powerHelp}
        title={powerHelp}
        onmousedowncapture={handlePowerMouseDownCapture}
        onclick={handlePowerClick}
        onpointerdown={handlePowerPointerDown}
      >
        <IconSvg name="power" class="power-icon {isBypassed ? 'is-dimmed' : ''}" />
      </button>
    </div>
  {/if}
  <div class="header-columns">
    <div class="header-col header-col-inputs" aria-hidden="true"></div>
    <div class="header-col header-col-center">
      <div
        class="drag-area"
        role="button"
        tabindex="-1"
        onpointerdown={handlePointerDown}
      >
        <div class="icon-box">
          <NodeIconSvg identifier={getNodeIcon(spec)} class="header-icon" />
        </div>
        <div class="label">
          {#if isEditing}
            <input
              bind:this={inputEl}
              bind:value={editValue}
              class="label-input"
              onblur={commitEdit}
              onkeydown={handleKeydown}
              onclick={(e) => e.stopPropagation()}
              ondblclick={(e) => e.stopPropagation()}
            />
          {:else}
            <span class="label-text" onclick={labelStrictDoubleClick}>{displayLabel}</span>
          {/if}
        </div>
      </div>
    </div>
    <div class="header-col header-col-outputs" aria-hidden="true"></div>
  </div>
  {#if inputPortPositions && spec.inputs.length > 0}
    <div class="inputs" role="group" aria-label="Input ports">
      {#each spec.inputs as port}
        {@const key = `input:${port.name}`}
        {@const pos = inputPortPositions.get(key)}
        {#if pos}
          <button
            type="button"
            class="port input-port type-{port.type}"
            class:branch-active={selectActiveBranchPort === port.name}
            data-port-key={key}
            style="left: {pos.x - nodePosition.x - 12}px; top: {pos.y - nodePosition.y}px; transform: translate(0, -50%);"
            aria-label="Input: {getNameLabel(port)} ({getTypeLabel(port)}). Drag to connect."
            onpointerdown={(e) => { e.stopPropagation(); onHeaderPortPointerDown?.(e.clientX, e.clientY, e.pointerId); }}
          >
            <span class="dot"></span>
            <span class="type-chip">{getTypeLabel(port)}</span>
            {#if !port.hideHeaderLabel}
              <span class="name-chip">{getNameLabel(port)}</span>
            {/if}
          </button>
        {/if}
      {/each}
    </div>
  {/if}
  {#if outputPortPositions && spec.outputs.length > 0}
    <div class="outputs" role="group" aria-label="Output ports">
      {#each spec.outputs as port}
        {@const key = `output:${port.name}`}
        {@const pos = outputPortPositions.get(key)}
        {#if pos}
          <button
            type="button"
            class="port output-port type-{port.type}"
            data-port-key={key}
            style="left: {pos.x - nodePosition.x + 12}px; top: {pos.y - nodePosition.y}px; transform: translate(-100%, -50%);"
            aria-label="Output: {getNameLabel(port)} ({getTypeLabel(port)}). Drag to connect."
            onpointerdown={(e) => { e.stopPropagation(); onHeaderPortPointerDown?.(e.clientX, e.clientY, e.pointerId); }}
          >
            {#if getOutputDisplayLabel(port)}
              <span class="name-chip">{getOutputDisplayLabel(port)}</span>
            {/if}
            <span class="type-chip">{getTypeLabel(port)}</span>
            <span class="dot"></span>
          </button>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  /* NodeHeader Styles */

  .node-header {
    /* Layout */
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: stretch;

    /* Box model */
    min-height: var(--node-header-min-height);
    padding: var(--node-header-padding);
    border-radius: var(--node-box-border-radius) var(--node-box-border-radius) 0 0;

    /* Visual */
    background: transparent;

    .power-row {
      flex: 0 0 var(--node-header-power-strip-height);
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      justify-content: center;
      width: 100%;
      min-width: 0;
      height: var(--size-lg);
      margin-top: -12px;


      /* Keep strip height for canvas metrics, but visually bias upward. */
      padding: 0 0 24px 0;
      z-index: 3;
      pointer-events: auto;
    }

    .header-columns {
      display: flex;
      flex-direction: row;
      align-items: center;
      flex: 1 1 auto;
      min-height: 0;
      width: 100%;
      min-width: 0;
    }

    .header-col-inputs,
    .header-col-outputs {
      flex-shrink: 0;
      width: var(--node-port-size);
    }

    .header-col-center {
      flex: 1 1 auto;
      min-width: 0;
      display: flex;
      flex-direction: row;
      justify-content: center;
      align-items: stretch;
    }

    .power-toggle {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin: 0;
      padding: var(--port-type-padding-vertical) var(--port-type-padding-horizontal);
      border: none;
      border-radius: var(--port-type-bg-radius);
      background-color: rgba(255,255,255,0.07);
      color: var(--node-header-name-color);
      cursor: default;
      font-size: var(--text-xl);
      line-height: 1;
      height: var(--size-md);

      &:focus {
        outline: none;
      }

      &:focus-visible {
        outline: 2px solid var(--color-blue-90);
        outline-offset: var(--pd-2xs);
      }

      &:hover {
        background-color: rgba(255,255,255,0.1);
      }

      :global(.power-icon) {
        display: inline-flex;
      }

      :global(.power-icon svg) {
        width: 1.2em;
        height: 1.2em;
        min-width: 0;
        min-height: 0;
      }

      :global(.power-icon.is-dimmed svg) {
        color: var(--color-blue-110);
      }
    }

    .drag-area {
      /* Layout */
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--pd-md);
      min-width: 0;
      padding: var(--pd-2xl) 0;

      /* Other */
      cursor: default;

      &:focus,
      &:focus-visible {
        outline: none;
      }

      &:active {
        cursor: grabbing;
      }

      .icon-box {
        /* Layout */
        display: flex;
        align-items: center;
        justify-content: center;

        /* Box model */
        width: var(--node-icon-box-width);
        height: var(--node-icon-box-height);
        border-radius: var(--node-icon-box-radius);

        /* background set by .node.{slug} in node-categories.css */
        :global(.header-icon) {
          width: var(--node-header-icon-size);
          height: var(--node-header-icon-size);
          /* color from .node.{slug} in node-categories.css */

          :global(svg) {
            width: 100%;
            height: 100%;
          }
        }
      }

      .label {
        /* Layout */
        display: flex;
        justify-content: center;
        min-width: 0;

        .label-text {
          /* Box model */
          max-width: 100%;

          /* Visual */
          color: var(--node-header-name-color);

          /* Typography */
          font-size: var(--text-4xl);
          font-weight: 900;
          font-family: var(--font-sans);
          text-align: center;
          overflow: hidden;
          text-overflow: ellipsis; 
          white-space: nowrap;
        }

        .label-input {
          /* Box model */
          width: 100%;
          max-width: 200px; /* One-off - label edit field max width */
          padding: var(--pd-2xs) var(--pd-md);
          border: 1px solid var(--color-gray-80);
          border-radius: var(--radius-md);
          outline: none;

          /* Visual */
          color: var(--node-header-name-color);
          background: var(--color-gray-70);

          /* Typography */
          font-size: var(--text-xl);
          font-weight: 600;
          font-family: var(--font-sans);
        }
      }
    }

    .inputs,
    .outputs {
      /* Layout */
      position: absolute;
      inset: 0;
      z-index: 1;

      /* Other */
      pointer-events: none;

      .port {
        /* Layout */
        position: absolute;
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--port-label-spacing);
        pointer-events: auto;

        /* Box model */
        padding: 0;
        border: none;

        /* Visual */
        background: transparent;

        /* Other */
        cursor: crosshair;
        transition: transform var(--motion-effects-fast-duration) var(--motion-effects-fast-easing);

        &:hover .dot {
          transform: scale(1.15);
          box-shadow: 0 0 var(--scale-1) var(--scale-3) var(--color-teal-gray-40);
        }

        &:focus {
          outline: none;
        }

        &:focus-visible {
          outline: 2px solid var(--color-blue-90);
          outline-offset: var(--pd-2xs);
        }

        .dot {
          --port-color: var(--port-color-float);
          --shadow-color: var(--port-color-float);
          /* Layout */
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;

          /* Box model */
          width: var(--param-port-circle-size);
          height: var(--param-port-circle-size);
          min-width: 14px; /* One-off - ensure dot visibility */
          min-height: 14px;
          border-radius: 50%;
          flex-shrink: 0;
          border: 1px solid rgba(255, 255, 255, 0.3);

          /* Visual */
          background: var(--port-color);
          box-shadow: 0 0 var(--scale-1) var(--scale-3) color-mix(in srgb, var(--shadow-color) 30%, transparent 70%);

          /* Other */
          transition:
            background var(--motion-effects-fast-duration) var(--motion-effects-fast-easing),
            box-shadow var(--motion-effects-fast-duration) var(--motion-effects-fast-easing),
            transform var(--motion-effects-fast-duration) var(--motion-effects-fast-easing);
        }

        &.input-port .dot,
        &.output-port .dot {
          background: var(--port-color);
        }

        &.type-vec2 .dot {
          --port-color: var(--port-color-vec2);
          --shadow-color: var(--port-color-vec2);
        }

        &.type-vec3 .dot {
          --port-color: var(--port-color-vec3);
          --shadow-color: var(--port-color-vec3);
        }

        &.type-vec4 .dot {
          --port-color: var(--port-color-vec4);
          --shadow-color: var(--port-color-vec4);
        }

        &.input-port.branch-active .dot {
          --port-color: var(--port-branch-active-color);
          --shadow-color: var(--port-branch-active-color);
          background: var(--port-branch-active-color);
        }

        .type-chip {
          /* Box model */
          padding: var(--port-type-padding-vertical) var(--port-type-padding-horizontal);
          border-radius: var(--port-type-bg-radius);
          flex-shrink: 0;

          /* Typography */
          font-size: var(--text-xl);
          font-weight: var(--port-type-font-weight);
        }

        &.input-port .type-chip,
        &.output-port .type-chip {
          color: var(--port-type-text-float);
          background: var(--port-type-bg-float);
        }

        &.type-vec2 .type-chip {
          color: var(--port-type-text-vec2);
          background: var(--port-type-bg-vec2);
        }

        &.type-vec3 .type-chip {
          color: var(--port-type-text-vec3);
          background: var(--port-type-bg-vec3);
        }

        &.type-vec4 .type-chip {
          color: var(--port-type-text-vec4);
          background: var(--port-type-bg-vec4);
        }

        .name-chip {
          /* Box model */
          max-width: 140px; /* One-off - port name truncation */

          /* Visual */
          color: var(--node-header-name-color);

          /* Typography */
          font-size: var(--text-xl);
          font-weight: var(--port-label-font-weight);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }
    }
  }
</style>

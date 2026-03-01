<script lang="ts">
  /**
   * NodeHeader - Canvas DOM Migration WP 14A
   * Icon, label (double-click to edit). Drag handle for node drag.
   * WP 14C: Output ports for connection layer alignment.
   * Input ports: port -> type -> name. Output ports: name -> type -> port.
   */

  import { NodeIconSvg } from '../ui';
  import { getNodeIcon, isRedundantOutputLabel } from '../../../utils/nodeSpecUtils';
  import type { NodeSpec, PortSpec } from '../../../types/nodeSpec';
  import type { PortPosition } from './types';

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
    onLabelChange: (label: string | undefined) => void;
    onDragStart: (clientX: number, clientY: number, shiftKey: boolean) => void;
    onHeaderPortPointerDown?: (screenX: number, screenY: number, pointerId?: number) => void;
  }

  let {
    spec,
    label,
    headerHeight,
    inputPortPositions,
    outputPortPositions,
    nodePosition,
    onLabelChange,
    onDragStart,
    onHeaderPortPointerDown,
  }: Props = $props();

  let isEditing = $state(false);
  let editValue = $state('');
  let inputEl = $state<HTMLInputElement | null>(null);

  const displayLabel = $derived(label || spec.displayName);

  $effect(() => {
    if (!isEditing) editValue = displayLabel;
  });

  function handleDoubleClick() {
    isEditing = true;
    editValue = displayLabel;
    requestAnimationFrame(() => inputEl?.focus());
  }

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
  <div
    class="drag-area"
    role="button"
    tabindex="-1"
    ondblclick={handleDoubleClick}
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
        <span class="label-text">{displayLabel}</span>
      {/if}
    </div>
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
            data-port-key={key}
            style="left: {pos.x - nodePosition.x - 12}px; top: {pos.y - nodePosition.y}px; transform: translate(0, -50%);"
            aria-label="Input: {getNameLabel(port)} ({getTypeLabel(port)}). Drag to connect."
            onpointerdown={(e) => { e.stopPropagation(); onHeaderPortPointerDown?.(e.clientX, e.clientY, e.pointerId); }}
          >
            <span class="dot"></span>
            <span class="type-chip">{getTypeLabel(port)}</span>
            <span class="name-chip">{getNameLabel(port)}</span>
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
    align-items: center;
    justify-content: space-between;

    /* Box model */
    min-height: var(--node-header-min-height);
    padding: var(--node-header-padding);
    border-radius: var(--node-box-border-radius) var(--node-box-border-radius) 0 0;

    /* Visual */
    background: transparent;

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
        transition: transform 0.15s;

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
          transition: background 0.15s, box-shadow 0.15s, transform 0.15s;
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

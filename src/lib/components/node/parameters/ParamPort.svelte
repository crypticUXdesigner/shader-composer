<script lang="ts">
  import { IconSvg } from '../../ui';
  export type ParamPortState = 'default' | 'graph-connected' | 'audio-connected';

  interface Props {
    portId: string;
    portType: string;
    /** For DOM-based hit testing when connecting (elementFromPoint) */
    nodeId?: string;
    paramName?: string;
    state?: ParamPortState;
    signalName?: string;
    /** When false, hide signal name in port (parent may show it elsewhere, e.g. bottom row) */
    showSignalName?: boolean;
    liveValue?: number;
    /** Start connection drag from port */
    onPointerDown?: (e: PointerEvent) => void;
    /** Open connection menu (signal picker) */
    onDoubleClick?: (e: PointerEvent) => void;
    disabled?: boolean;
    class?: string;
  }

  let {
    portId,
    portType,
    nodeId = '',
    paramName = '',
    state = 'default',
    signalName = '',
    showSignalName = true,
    liveValue = 0,
    onPointerDown,
    onDoubleClick,
    disabled = false,
    class: className = ''
  }: Props = $props();

  function handlePointerDown(e: PointerEvent) {
    if (disabled) return;
    onPointerDown?.(e);
  }

  function handleDoubleClick(e: PointerEvent) {
    if (disabled) return;
    onDoubleClick?.(e);
  }
</script>

<button
  type="button"
  class="param-port {state} type-{portType} {className}"
  class:disabled
  data-port-id={portId}
  data-port-type={portType}
  data-node-id={nodeId}
  data-param-name={paramName}
  data-state={state}
  onpointerdown={handlePointerDown}
  ondblclick={handleDoubleClick}
  aria-label="{state === 'audio-connected' && signalName
    ? `Port connected to ${signalName}. Drag to connect, double-click to change.`
    : `Parameter port. Drag to connect, double-click to open connection menu.`}"
  aria-disabled={disabled}
>
  <span class="port-circle" aria-hidden="true">
    {#if state === 'audio-connected'}
      <IconSvg name="waveform" variant="line" class="port-audio-icon" />
    {/if}
  </span>
  {#if showSignalName && state === 'audio-connected' && signalName}
    <span class="signal-name">{signalName}</span>
  {/if}
</button>

<style>
  .param-port {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--pd-xs);
    padding: 0;
    width: var(--param-port-circle-size);
    height: var(--param-port-circle-size);
    min-width: var(--param-port-circle-size);
    min-height: var(--param-port-circle-size);
    border: none;
    background: transparent;
    cursor: default;
    font-family: inherit;
    transition: opacity 0.15s;

    &:disabled {
      opacity: var(--opacity-disabled);
      cursor: not-allowed;
    }

    &:focus {
      outline: none;
    }

    &:focus-visible {
      outline: 2px solid var(--color-blue-90);
      outline-offset: 2px;
    }

    --param-port-icon-stroke-width: 1.5;

    .port-circle {
      --port-color: var(--port-color-float);
      --shadow-color: var(--port-color-float);
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: var(--param-port-circle-size);
      height: var(--param-port-circle-size);
      border-radius: 50%;
      background: var(--port-color);
      border: 1px solid rgba(255, 255, 255, 0.3);
      box-shadow: 0 0 2px 6px color-mix(in srgb, var(--shadow-color) 30%, transparent 70%);
      transition: background 0.15s, box-shadow 0.15s, transform 0.1s;

      :global(.port-audio-icon) {
        width: var(--icon-size-sm);
        height: var(--icon-size-sm);
        color: currentColor;
      }

      :global(.port-audio-icon svg),
      :global(.port-audio-icon svg *) {
        stroke-width: 3;
      }
    }

    &.type-vec2 .port-circle {
      --port-color: var(--port-color-vec2);
      --shadow-color: var(--port-color-vec2);
    }

    &.type-vec3 .port-circle {
      --port-color: var(--port-color-vec3);
      --shadow-color: var(--port-color-vec3);
    }

    &.type-vec4 .port-circle {
      --port-color: var(--port-color-vec4);
      --shadow-color: var(--port-color-vec4);
    }

    &.graph-connected .port-circle,
    &.audio-connected .port-circle {
      --port-color: var(--port-connected-color-float);
    }

    &.graph-connected.type-vec2 .port-circle,
    &.audio-connected.type-vec2 .port-circle {
      --port-color: var(--port-connected-color-vec2);
    }

    &.graph-connected.type-vec3 .port-circle,
    &.audio-connected.type-vec3 .port-circle {
      --port-color: var(--port-connected-color-vec3);
    }

    &.graph-connected.type-vec4 .port-circle,
    &.audio-connected.type-vec4 .port-circle {
      --port-color: var(--port-connected-color-vec4);
    }

    &:not(:disabled):hover .port-circle {
      background: var(--port-hover-color);
      transform: scale(1.15);
      box-shadow: 0 0 2px 6px var(--color-teal-gray-40);
    }

    .signal-name {
      font-size: var(--text-xs);
      font-weight: 500;
      color: var(--port-type-text-float);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 80px;
    }
  }
</style>

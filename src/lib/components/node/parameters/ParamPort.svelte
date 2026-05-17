<script lang="ts">
  import { IconSvg } from '../../ui';
  import { createStrictDoubleClickHandler } from '../../../utils/strictDoubleClick';
  export type ParamPortState = 'default' | 'graph-connected' | 'audio-connected';

  interface Props {
    portId: string;
    portType: string;
    /** For DOM-based hit testing when connecting (elementFromPoint) */
    nodeId?: string;
    paramName?: string;
    state?: ParamPortState;
    signalName?: string;
    /** When true, indicate the parameter is driven by timeline automation (not a connection). */
    timelineDriven?: boolean;
    /** When false, hide signal name in port (parent may show it elsewhere, e.g. bottom row) */
    showSignalName?: boolean;
    /** Start connection drag from port */
    onPointerDown?: (e: PointerEvent) => void;
    /** Open connection menu (signal picker); strict double-click (MouseEvent). */
    onDoubleClick?: (e: MouseEvent) => void;
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
    timelineDriven = false,
    showSignalName = true,
    onPointerDown,
    onDoubleClick,
    disabled = false,
    class: className = ''
  }: Props = $props();

  function getA11yText(opts: { includeInstructions: boolean }) {
    const parts: string[] = [];

    if (timelineDriven) parts.push('Timeline automation.');

    if (state === 'default') {
      parts.push('Port not connected.');
    } else if (state === 'graph-connected') {
      parts.push('Port connected to graph.');
    } else if (state === 'audio-connected') {
      parts.push(signalName ? `Port connected to audio: ${signalName}.` : 'Port connected to audio.');
    }

    if (opts.includeInstructions) {
      parts.push('Drag to connect. Double-click to change connection.');
    }

    return parts.join(' ');
  }

  function getAriaLabel() {
    return getA11yText({ includeInstructions: true });
  }

  function getTooltipText() {
    return getA11yText({ includeInstructions: false });
  }

  function handlePointerDown(e: PointerEvent) {
    if (disabled) return;
    onPointerDown?.(e);
  }

  function handleStrictDoubleClickOpen(e: MouseEvent) {
    if (disabled) return;
    e.stopPropagation();
    onDoubleClick?.(e);
  }

  const strictPortDoubleClick = createStrictDoubleClickHandler((e: MouseEvent) =>
    handleStrictDoubleClickOpen(e)
  );
</script>

<button
  type="button"
  class="param-port {state} type-{portType} {className}"
  class:disabled
  class:timeline-driven={timelineDriven}
  data-port-id={portId}
  data-port-type={portType}
  data-node-id={nodeId}
  data-param-name={paramName}
  data-state={state}
  onpointerdown={handlePointerDown}
  onclick={strictPortDoubleClick}
  aria-label={getAriaLabel()}
  aria-disabled={disabled}
  title={getTooltipText()}
>
  <span class="port-circle" aria-hidden="true">
    {#if timelineDriven}
      <IconSvg name="line-segments" variant="line" class="port-timeline-icon" />
    {:else if state === 'audio-connected'}
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
    transition: opacity var(--motion-effects-fast-duration) var(--motion-effects-fast-easing);

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
      transition:
        background var(--motion-effects-fast-duration) var(--motion-effects-fast-easing),
        box-shadow var(--motion-effects-fast-duration) var(--motion-effects-fast-easing),
        transform var(--motion-effects-fast-duration) var(--motion-effects-fast-easing);

      :global(.port-audio-icon),
      :global(.port-timeline-icon) {
        width: var(--icon-size-sm);
        height: var(--icon-size-sm);
        color: currentColor;
      }

      :global(.port-audio-icon svg),
      :global(.port-audio-icon svg *),
      :global(.port-timeline-icon svg),
      :global(.port-timeline-icon svg *) {
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

    &.timeline-driven .port-circle,
    &.timeline-driven.graph-connected .port-circle,
    &.timeline-driven.audio-connected .port-circle,
    &.timeline-driven.type-vec2 .port-circle,
    &.timeline-driven.type-vec3 .port-circle,
    &.timeline-driven.type-vec4 .port-circle {
      --port-color: var(--color-yellow-100);
      --shadow-color: var(--color-yellow-100);
      color: var(--color-yellow-10);
      border-color: color-mix(in srgb, var(--color-yellow-10) 25%, transparent 75%);
    }

    &:not(:disabled):not(.timeline-driven):hover .port-circle {
      background: var(--port-hover-color);
      transform: scale(1.15);
      box-shadow: 0 0 2px 6px var(--color-teal-gray-40);
    }

    &:not(:disabled).timeline-driven:hover .port-circle {
      transform: scale(1.15);
      background: var(--color-yellow-110);
      box-shadow: 0 0 2px 6px color-mix(in srgb, var(--color-yellow-100) 45%, transparent 55%);
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

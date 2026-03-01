<script lang="ts">
  /**
   * Node - Canvas DOM Migration WP 14A
   * Root container for DOM node. Position via transform, selection state, drag handle.
   */

  import NodeHeader from './NodeHeader.svelte';
  import NodeBody from './NodeBody.svelte';
  import {
    getCategorySlug,
    isSystemInputNode,
    isStructuredPatternNode,
    isDerivedShapeNode,
    isWarpDistortNode,
    isFunctionsMathNode,
    isAdvancedMathNode,
    isStylizeEffectsNode,
    isSdfRaymarcherNode,
    isShinyNode,
  } from '../../../utils/cssTokens';
  import type { NodeInstance, NodeGraph } from '../../../data-model/types';
  import type { NodeSpec } from '../../../types/nodeSpec';
  import type { DomNodeMetrics } from './types';
  import type { AudioSetup } from '../../../data-model/audioSetupTypes';
  import type { IAudioManager } from '../../../runtime/types';

  interface Props {
    nodeId: string;
    node: NodeInstance;
    spec: NodeSpec;
    metrics: DomNodeMetrics;
    selected: boolean;
    graph: NodeGraph;
    audioSetup: AudioSetup;
    nodeSpecs: Map<string, NodeSpec>;
    getAudioManager?: () => IAudioManager | undefined;
    /** WP 03: Current timeline time for automation-driven parameter display. */
    getTimelineCurrentTime?: () => number;
    overlayBridge?: import('../../../types/editor').CanvasOverlayBridge | null;
    onPortPointerDownForConnection?: (screenX: number, screenY: number, pointerId?: number) => void;
    onPortClickForSignalPicker?: (screenX: number, screenY: number, nodeId: string, paramName: string, triggerElement?: HTMLElement | null) => void;
    onHeaderPortPointerDown?: (screenX: number, screenY: number, pointerId?: number) => void;
    nodePosition: { x: number; y: number };
    onDrag: (nodeId: string, clientX: number, clientY: number, shiftKey: boolean) => void;
    onSelect: (nodeId: string, multiSelect: boolean) => void;
    onLabelChange: (nodeId: string, label: string | undefined) => void;
    onParameterChange: (nodeId: string, paramName: string, value: import('../../../data-model/types').ParameterValue) => void;
    onParameterInputModeChanged?: (nodeId: string, paramName: string, mode: import('../../../types/nodeSpec').ParameterInputMode) => void;
    onContextMenu?: (nodeId: string, clientX: number, clientY: number) => void;
  }

  let {
    nodeId,
    node,
    spec,
    metrics,
    selected,
    graph,
    audioSetup,
    nodeSpecs,
    getAudioManager,
    getTimelineCurrentTime,
    overlayBridge = null,
    onPortPointerDownForConnection,
    onPortClickForSignalPicker,
    onHeaderPortPointerDown,
    nodePosition,
    onDrag,
    onSelect,
    onLabelChange,
    onParameterChange,
    onParameterInputModeChanged,
    onContextMenu,
  }: Props = $props();

  const label = $derived(node.label ?? spec.displayName);
  const categorySlug = $derived(getCategorySlug(spec.category));
  const isSystemInput = $derived(isSystemInputNode(spec.id, spec.category));
  const isStructuredPattern = $derived(isStructuredPatternNode(spec.id, spec.category));
  const isDerivedShape = $derived(isDerivedShapeNode(spec.id, spec.category));
  const isWarpDistort = $derived(isWarpDistortNode(spec.id, spec.category));
  const isFunctionsMath = $derived(isFunctionsMathNode(spec.id, spec.category));
  const isAdvancedMath = $derived(isAdvancedMathNode(spec.id, spec.category));
  const isStylizeEffects = $derived(isStylizeEffectsNode(spec.id, spec.category));
  const isSdfRaymarcher = $derived(isSdfRaymarcherNode(spec.id, spec.category));
  const isShiny = $derived(isShinyNode(spec.id, spec.category));

  function handleHeaderDragStart(clientX: number, clientY: number, shiftKey: boolean) {
    onDrag(nodeId, clientX, clientY, shiftKey);
  }

  function handleClick(e: MouseEvent) {
    onSelect(nodeId, e.shiftKey);
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events - Node is a custom region; selection and context menu are handled by parent/canvas; keyboard handled elsewhere -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions - Node is a custom region; selection and context menu are handled by parent/canvas; keyboard handled elsewhere -->
<div
  class="node {categorySlug} {isSystemInput ? 'system-input' : ''} {isStructuredPattern ? 'structured' : ''} {isDerivedShape ? 'derived' : ''} {isWarpDistort ? 'warp' : ''} {isFunctionsMath ? 'functions' : ''} {isAdvancedMath ? 'advanced' : ''} {isStylizeEffects ? 'stylize' : ''} {isSdfRaymarcher ? 'raymarcher' : ''} {isShiny ? 'shiny' : ''} {selected ? 'selected' : ''}"
  data-node-id={nodeId}
  style="transform: translate({node.position.x}px, {node.position.y}px); width: {metrics.width}px; min-height: {metrics.height}px;"
  role="article"
  aria-label="Node: {label}"
  onclick={handleClick}
  oncontextmenu={(e) => {
      e.preventDefault();
      onContextMenu?.(nodeId, e.clientX, e.clientY);
    }}
>
  <NodeHeader
    spec={spec}
    label={node.label ?? ''}
    headerHeight={metrics.headerHeight}
    inputPortPositions={metrics.inputPortPositions}
    outputPortPositions={metrics.outputPortPositions}
    nodePosition={nodePosition}
    onHeaderPortPointerDown={onHeaderPortPointerDown}
    onLabelChange={(l) => onLabelChange(nodeId, l)}
    onDragStart={handleHeaderDragStart}
  />
  {#if metrics.height > metrics.headerHeight}
  <NodeBody
    nodeId={nodeId}
    node={node}
    spec={spec}
    width={metrics.width}
    headerHeight={metrics.headerHeight}
    height={metrics.height}
    graph={graph}
    audioSetup={audioSetup}
    nodeSpecs={nodeSpecs}
    getAudioManager={getAudioManager ? () => getAudioManager() ?? null : undefined}
    getTimelineCurrentTime={getTimelineCurrentTime}
    overlayBridge={overlayBridge}
    onPortPointerDownForConnection={onPortPointerDownForConnection}
    onPortClickForSignalPicker={onPortClickForSignalPicker}
    onParameterChange={(paramName, value) => onParameterChange(nodeId, paramName, value)}
    onParameterInputModeChanged={onParameterInputModeChanged ? (paramName, mode) => onParameterInputModeChanged(nodeId, paramName, mode) : undefined}
  />
  {/if}
</div>

<style>
  .node {
    position: absolute;
    left: 0;
    top: 0;
    box-sizing: border-box;
    border-radius: var(--node-box-border-radius);
    border: 1px solid var(--node-border);
    box-shadow: var(--node-box-shadow);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    pointer-events: auto;
    transition: box-shadow 0.15s, border-color 0.15s;

    &.shiny:not(.selected) {
      border-color: var(--node-shiny-ring-color);
      box-shadow:
        0 0 0 var(--node-shiny-ring-width) var(--node-shiny-ring-color),
        0 0 var(--node-shiny-glow-radius) var(--node-shiny-glow-color),
        var(--node-box-shadow);
    }

    &.selected {
      border-color: var(--node-border-selected);
      box-shadow:
        0 0 0 5px var(--node-border-selected),
        var(--node-box-shadow-selected);
    }
  }
</style>

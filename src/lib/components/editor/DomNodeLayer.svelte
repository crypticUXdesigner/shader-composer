<script lang="ts">
  /**
   * DomNodeLayer - Canvas DOM Migration WP 14A
   * Renders DOM nodes on top of canvas. Same pan/zoom transform as canvas.
   * WP 15A: All nodes are DOM (audio nodes removed from catalog and migrated).
   */

  import Node from '../node/Node.svelte';
  import type { NodeGraph } from '../../../data-model/types';
  import type { NodeSpec } from '../../../types/nodeSpec';
  import type { NodeEditorCanvasWrapperAPI } from './NodeEditorCanvasWrapper.types';
  import type { NodeRenderMetrics } from '../../../ui/editor';
  import type { DomNodeMetrics } from '../node/types';
  import type { AudioSetup } from '../../../data-model/audioSetupTypes';
  import type { IAudioManager } from '../../../runtime/types';
  interface Props {
    graph: NodeGraph;
    nodeSpecs: NodeSpec[];
    audioSetup?: AudioSetup;
    getAudioManager?: () => IAudioManager | undefined;
    /** WP 03: Current timeline time for automation-driven parameter display. */
    getTimelineCurrentTime?: () => number;
    viewState: { zoom: number; panX: number; panY: number; selectedNodeIds: string[] };
    canvasApi: NodeEditorCanvasWrapperAPI | null;
    overlayBridge?: import('../../../types/editor').CanvasOverlayBridge | null;
    onPortPointerDownForConnection?: (screenX: number, screenY: number, pointerId?: number) => void;
    onPortClickForSignalPicker?: (screenX: number, screenY: number, nodeId: string, paramName: string, triggerElement?: HTMLElement | null) => void;
    /** Start connection drag from header port (input/output). */
    onHeaderPortPointerDown?: (screenX: number, screenY: number, pointerId?: number) => void;
    onNodeMoved: (nodeId: string, x: number, y: number) => void;
    onNodeSelected: (nodeId: string, multiSelect: boolean) => void;
    onNodeLabelChanged: (nodeId: string, label: string | undefined) => void;
    onParameterChange?: (nodeId: string, paramName: string, value: import('../../../data-model/types').ParameterValue) => void;
    onParameterInputModeChanged?: (nodeId: string, paramName: string, mode: import('../../../types/nodeSpec').ParameterInputMode) => void;
    onNodeContextMenu?: (nodeId: string, clientX: number, clientY: number) => void;
  }

  let {
    graph,
    nodeSpecs,
    audioSetup = { files: [], bands: [], remappers: [] },
    getAudioManager,
    getTimelineCurrentTime,
    viewState,
    canvasApi,
    overlayBridge = null,
    onPortPointerDownForConnection,
    onPortClickForSignalPicker,
    onHeaderPortPointerDown,
    onNodeMoved,
    onNodeSelected,
    onNodeLabelChanged,
    onParameterChange,
    onParameterInputModeChanged,
    onNodeContextMenu,
  }: Props = $props();

  const nodeSpecsMap = $derived(new Map(nodeSpecs.map((s) => [s.id, s])));

  const domNodes = $derived(graph.nodes);

  const selectedSet = $derived(new Set(viewState.selectedNodeIds ?? []));

  let draggingNodeId = $state<string | null>(null);
  let dragOffsetX = $state(0);
  let dragOffsetY = $state(0);
  let selectedNodesInitialPositions = $state<Map<string, { x: number; y: number }>>(new Map());

  /** Potential drag: set on pointerdown, committed when move exceeds threshold, cleared on pointerup */
  let potentialDragNodeId = $state<string | null>(null);
  let potentialDragStartX = $state(0);
  let potentialDragStartY = $state(0);
  let potentialDragShiftKey = $state(false);
  const DRAG_THRESHOLD = 5;

  function getNodeMetrics(nodeId: string): NodeRenderMetrics | undefined {
    return canvasApi?.getNodeMetrics(nodeId);
  }

  function toDomMetrics(m: NodeRenderMetrics): DomNodeMetrics {
    const inputPortPositions = new Map<string, { x: number; y: number; isOutput: boolean }>();
    const outputPortPositions = new Map<string, { x: number; y: number; isOutput: boolean }>();
    m.portPositions?.forEach((pos, key) => {
      if (pos.isOutput) outputPortPositions.set(key, pos);
      else inputPortPositions.set(key, pos);
    });
    return {
      width: m.width,
      height: m.height,
      headerHeight: m.headerHeight,
      inputPortPositions: inputPortPositions.size ? inputPortPositions : undefined,
      outputPortPositions: outputPortPositions.size ? outputPortPositions : undefined
    };
  }

  function handlePointerDown(nodeId: string, clientX: number, clientY: number, shiftKey: boolean) {
    if (!canvasApi) return;
    const node = graph.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    potentialDragNodeId = nodeId;
    potentialDragStartX = clientX;
    potentialDragStartY = clientY;
    potentialDragShiftKey = shiftKey;
  }

  function commitToDrag(nodeId: string, clientX: number, clientY: number, shiftKey: boolean) {
    const node = graph.nodes.find((n) => n.id === nodeId);
    if (!node || !canvasApi) return;

    // Shift-drag: add dragged node to selection (so it moves with selected)
    if (shiftKey) {
      onNodeSelected(nodeId, true);
    }

    const selectedIds = viewState.selectedNodeIds ?? [];
    const nodesToMove = shiftKey || selectedIds.includes(nodeId)
      ? new Set([...selectedIds, nodeId])
      : new Set([nodeId]);

    const initialPositions = new Map<string, { x: number; y: number }>();
    for (const nid of nodesToMove) {
      const n = graph.nodes.find((nd) => nd.id === nid);
      if (n) initialPositions.set(nid, { x: n.position.x, y: n.position.y });
    }

    const clickCanvas = canvasApi.screenToCanvas(clientX, clientY);
    draggingNodeId = nodeId;
    dragOffsetX = clickCanvas.x - node.position.x;
    dragOffsetY = clickCanvas.y - node.position.y;
    selectedNodesInitialPositions = initialPositions;
    potentialDragNodeId = null;
  }

  function handlePointerMove(e: PointerEvent) {
    if (potentialDragNodeId && !draggingNodeId) {
      const dx = e.clientX - potentialDragStartX;
      const dy = e.clientY - potentialDragStartY;
      if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
        commitToDrag(potentialDragNodeId, e.clientX, e.clientY, potentialDragShiftKey);
      }
    }
    if (!draggingNodeId || !canvasApi) return;
    const cursorCanvas = canvasApi.screenToCanvas(e.clientX, e.clientY);
    const pos = { x: cursorCanvas.x - dragOffsetX, y: cursorCanvas.y - dragOffsetY };
    const primaryNode = graph.nodes.find((n) => n.id === draggingNodeId);
    if (!primaryNode) return;

    const result = canvasApi.calculateSmartGuides(primaryNode, pos.x, pos.y);
    canvasApi.setSmartGuides(result.guides);

    const initial = selectedNodesInitialPositions.get(draggingNodeId);
    const baseX = initial?.x ?? primaryNode.position.x;
    const baseY = initial?.y ?? primaryNode.position.y;
    const deltaX = result.snappedX - baseX;
    const deltaY = result.snappedY - baseY;

    for (const [nid, initialPos] of selectedNodesInitialPositions) {
      const newX = Math.round(initialPos.x + deltaX);
      const newY = Math.round(initialPos.y + deltaY);
      onNodeMoved(nid, newX, newY);
    }
    canvasApi.requestRender();
  }

  function handlePointerUp() {
    if (draggingNodeId && canvasApi) {
      canvasApi.clearSmartGuides();
      canvasApi.requestRender();
    }
    draggingNodeId = null;
    potentialDragNodeId = null;
  }

  $effect(() => {
    if (!draggingNodeId && !potentialDragNodeId) return;
    const onMove = (e: PointerEvent) => handlePointerMove(e);
    const onUp = () => handlePointerUp();
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  });
</script>

<div class="layer">
  <div
    class="transform"
    style="transform: translate({viewState.panX}px, {viewState.panY}px) scale({viewState.zoom}); transform-origin: 0 0;"
  >
    {#each domNodes as node (node.id)}
      {@const spec = nodeSpecsMap.get(node.type)}
      {@const metrics = getNodeMetrics(node.id)}
      {#if spec && metrics}
        <Node
          nodeId={node.id}
          node={node}
          spec={spec}
          metrics={toDomMetrics(metrics)}
          selected={selectedSet.has(node.id)}
          graph={graph}
          audioSetup={audioSetup}
          nodeSpecs={nodeSpecsMap}
          getAudioManager={getAudioManager}
          getTimelineCurrentTime={getTimelineCurrentTime}
          overlayBridge={overlayBridge}
          onPortPointerDownForConnection={onPortPointerDownForConnection}
          onPortClickForSignalPicker={onPortClickForSignalPicker}
          onHeaderPortPointerDown={onHeaderPortPointerDown}
          nodePosition={node.position}
          onDrag={handlePointerDown}
          onSelect={onNodeSelected}
          onLabelChange={onNodeLabelChanged}
          onParameterChange={onParameterChange ?? (() => {})}
          onParameterInputModeChanged={onParameterInputModeChanged}
          onContextMenu={onNodeContextMenu}
        />
      {/if}
    {/each}
  </div>
</div>

<style>
  .layer {
    /* Layout */
    position: absolute;
    inset: 0;

    /* Other */
    z-index: 1;
    pointer-events: none;

    .transform {
      /* Layout */
      position: absolute;
      left: 0;
      top: 0;
      width: 0;
      height: 0;

      /* Other */
      pointer-events: none;
    }
  }
</style>

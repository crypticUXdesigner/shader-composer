<script lang="ts">
  /**
   * NodeEditorCanvasWrapper - Svelte 5 Migration WP 04C
   *
   * Thin Svelte wrapper for vanilla NodeEditorCanvas. Syncs graph from store,
   * forwards canvas events to store/parent, and exposes canvas methods for parent.
   *
   * Undo/copy-paste: Parent owns them (WP 06); wrapper only forwards events.
   */

  import { untrack } from 'svelte';
  import { NodeEditorCanvas, CopyPasteManager } from '../../../ui/editor';
  import {
    addNodes,
    addConnections,
    updateViewState,
    addConnectionWithValidation,
    type AddConnectionWithValidationResult,
    type NodeSpecification,
  } from '../../../data-model';
  import { wheelNonPassive } from '../../actions/wheelPassive';
  import type { NodeGraph, Connection, NodeInstance, ParameterValue } from '../../../data-model/types';
  import type { NodeSpec, ParameterInputMode } from '../../../types/nodeSpec';
  import { graphStore } from '../../stores';
  import { getVirtualNodeIdsFromAudioSetup } from '../../../utils/virtualNodes';
  import DomNodeLayer from './DomNodeLayer.svelte';
  import type {
    NodeEditorCanvasWrapperCallbacks,
    NodeEditorCanvasWrapperAPI
  } from './NodeEditorCanvasWrapper.types';

  interface Props {
    nodeSpecs: NodeSpec[];
    graph: NodeGraph;
    callbacks?: NodeEditorCanvasWrapperCallbacks;
    api?: NodeEditorCanvasWrapperAPI | null;
    overlayBridge?: import('../../../types/editor').CanvasOverlayBridge | null;
    /** WP 03: Current timeline time for automation-driven parameter display. */
    getTimelineCurrentTime?: () => number;
    /** WP 04: Timeline state for dirty-runner (mark automation nodes dirty when playing). */
    getTimelineState?: () => import('../../../runtime/types').TimelineState | null;
  }

  let {
    nodeSpecs,
    graph,
    callbacks = {},
    api: apiProp = $bindable(null as NodeEditorCanvasWrapperAPI | null),
    overlayBridge = null,
    getTimelineCurrentTime,
    getTimelineState,
  }: Props = $props();

  const copyPasteManager = new CopyPasteManager();
  let containerEl = $state<HTMLDivElement | null>(null);
  let wrapperEl = $state<HTMLDivElement | null>(null);
  let canvasInstance = $state<NodeEditorCanvas | null>(null);
  let liveViewState = $state({ zoom: 1, panX: 0, panY: 0, selectedNodeIds: [] as string[] });
  const activeTool = $derived(graphStore.activeTool);
  const isSpacebarPressed = $derived(graphStore.isSpacebarPressed);
  /** Hand tool active = toolbar selection OR spacebar held */
  const effectiveHandTool = $derived(activeTool === 'hand' || isSpacebarPressed);
  let isHandPanning = $state(false);

  function generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  function toNodeSpecifications(specs: NodeSpec[]): NodeSpecification[] {
    return specs.map((spec) => ({
      id: spec.id,
      inputs: spec.inputs?.map((i) => ({ name: i.name, type: i.type })),
      outputs: spec.outputs?.map((o) => ({ name: o.name, type: o.type })),
      parameters: Object.fromEntries(
        Object.entries(spec.parameters ?? {}).map(([key, p]) => [
          key,
          {
            type: p.type,
            default: p.default,
            min: p.min,
            max: p.max,
          },
        ])
      ),
    }));
  }

  function applyAddConnectionResult(result: AddConnectionWithValidationResult): void {
    if (result.errors.length > 0) {
      return;
    }
    // If an existing connection was replaced, notify the callback.
    if (result.replacedConnectionId) {
      callbacks.onConnectionRemoved?.(result.replacedConnectionId);
    }
    graphStore.setGraph(result.graph);
    notifyGraphChanged();
  }

  function buildApi(
    canvas: NodeEditorCanvas,
    addNodeFn: (nodeType: string, x: number, y: number) => NodeInstance | null,
    nodeSpecsMap: Map<string, NodeSpec>
  ): NodeEditorCanvasWrapperAPI {
    return {
      requestRender: () => canvas.requestRender(),
      fitToView: () => canvas.fitToView(),
      handleWheel: (e) => canvas.handleWheel(e),
      forwardMouseDown: (e) => canvas.handleMouseDownFromOverlay(e),
      hitTestConnection: (sx, sy) => canvas.hitTestConnectionAtScreen(sx, sy),
      setZoom: (zoom, cx, cy) => canvas.setZoom(zoom, cx, cy),
      getViewState: () => canvas.getViewState(),
      setActiveTool: (tool) => canvas.setActiveTool(tool),
      setAudioManager: (am) => canvas.setAudioManager(am),
      getAudioManager: () => canvas.getAudioManager(),
      setSpacebarStateChangeCallback: (cb) => canvas.setSpacebarStateChangeCallback(cb),
      screenToCanvas: (sx, sy) => (canvas as unknown as { screenToCanvas(x: number, y: number): { x: number; y: number } }).screenToCanvas(sx, sy),
      getCanvasCenterInScreen: () => {
        const canvasEl = (canvas as unknown as { canvas: HTMLCanvasElement }).canvas;
        if (!canvasEl) return { x: 0, y: 0 };
        const r = canvasEl.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      },
      render: () => canvas.render(),
      addNode: addNodeFn,
      getNodeMetrics: (nodeId) => {
        const cached = canvas.getNodeMetrics().get(nodeId);
        if (cached) return cached;
        const node = graphStore.graph.nodes.find((n) => n.id === nodeId);
        if (!node) return undefined;
        const spec = nodeSpecsMap.get(node.type);
        if (!spec) return undefined;
        return canvas.getNodeRenderer().calculateMetrics(node, spec);
      },
      isNodeVisible: (node, metrics) => canvas.isNodeVisible(node, metrics),
      calculateSmartGuides: (node, x, y) => canvas.calculateSmartGuidesForDOM(node, x, y),
      setSmartGuides: (guides) => canvas.setSmartGuidesFromDOM(guides),
      clearSmartGuides: () => canvas.clearSmartGuides(),
      startConnectionFromPort: (sx, sy) => canvas.startConnectionFromPort(sx, sy)
    };
  }

  function notifyGraphChanged(): void {
    callbacks.onGraphChanged?.(graphStore.graph);
  }

  /** Show signal picker when param port is clicked (DOM nodes capture pointer events, so canvas never receives port clicks). */
  function handlePortClickForSignalPicker(
    screenX: number,
    screenY: number,
    targetNodeId: string,
    targetParameter: string,
    triggerElement?: HTMLElement | null
  ): void {
    if (!overlayBridge) return;
    const validationSpecs = toNodeSpecifications(nodeSpecs);
    const onSelect = (payload: import('../../../types/editor').SignalSelectPayload) => {
      if (payload.type === 'graph' && payload.nodeId != null && payload.port != null) {
        const conn: Connection = {
          id: generateId('conn'),
          sourceNodeId: payload.nodeId,
          sourcePort: payload.port,
          targetNodeId,
          targetPort: undefined,
          targetParameter,
        };
        const result = addConnectionWithValidation(graphStore.graph, conn, validationSpecs);
        if (canvasInstance) syncViewStateFromCanvas(canvasInstance);
        applyAddConnectionResult(result);
      } else if (payload.type === 'audio' && payload.virtualNodeId != null) {
        const conn: Connection = {
          id: generateId('conn'),
          sourceNodeId: payload.virtualNodeId,
          sourcePort: 'out',
          targetNodeId,
          targetPort: undefined,
          targetParameter,
        };
        const result = addConnectionWithValidation(graphStore.graph, conn, validationSpecs);
        if (canvasInstance) syncViewStateFromCanvas(canvasInstance);
        applyAddConnectionResult(result);
      } else if (payload.type === 'disconnect' && payload.connectionId != null) {
        if (canvasInstance) syncViewStateFromCanvas(canvasInstance);
        graphStore.removeConnection(payload.connectionId);
        callbacks.onConnectionRemoved?.(payload.connectionId);
        notifyGraphChanged();
      }
      canvasInstance?.requestRender?.();
    };
    overlayBridge.showSignalPicker(screenX, screenY + 8, targetNodeId, targetParameter, onSelect, triggerElement);
  }

  function syncViewStateFromCanvas(canvas: NodeEditorCanvas): void {
    const vs = canvas.getViewState();
    graphStore.updateViewState({
      zoom: vs.zoom,
      panX: vs.panX,
      panY: vs.panY,
      selectedNodeIds: vs.selectedNodeIds
    });
  }

  /**
   * Single parameter-change path: update store, call app callback (await if thenable),
   * then sync canvas view state, setGraph, and requestRender so paint happens after runtime sync.
   */
  async function handleParameterChange(
    nodeId: string,
    paramName: string,
    value: ParameterValue,
    canvas: NodeEditorCanvas | null
  ): Promise<void> {
    graphStore.updateNodeParameter(nodeId, paramName, value);
    const result = callbacks.onParameterChanged?.(
      nodeId,
      paramName,
      value,
      graphStore.graph
    );
    if (result != null && typeof (result as Promise<unknown>).then === 'function') {
      await (result as Promise<unknown>);
    }
    if (canvas) {
      syncViewStateFromCanvas(canvas);
      canvas.setGraph(graphStore.graph);
      canvas.requestRender();
    }
  }

  // View state sync from canvas (for DOM layer transform)
  // Only update when pan/zoom/selection actually change to avoid unnecessary Svelte re-renders.
  // PERF: Throttle tick to ~30 fps (VIEW_STATE_SYNC_INTERVAL_MS) so we don't run RAF every frame
  // when idle or during pan/zoom; selection changes still update liveViewState on the next tick.
  // When pan/zoom stop, apply final state once (wasChanging/skippedLast) so DomNodeLayer is not left behind.
  const VIEW_STATE_SYNC_INTERVAL_MS = 33;
  /** During pan/zoom-only, update liveViewState every N ticks. N=1 keeps DOM in sync with canvas (connections) for visual continuity; N>1 would throttle DOM more but caused connections to lag behind nodes. */
  const PAN_ZOOM_UPDATE_EVERY_N_FRAMES = 1;
  $effect(() => {
    const api = apiProp;
    if (!api) return;
    let rafId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let lastRunTime = 0;
    let frameCount = 0;
    let wasChanging = false;
    let skippedLast = false;
    function tick() {
      if (!api) return;
      const now = performance.now();
      const elapsed = lastRunTime === 0 ? VIEW_STATE_SYNC_INTERVAL_MS : now - lastRunTime;
      if (elapsed < VIEW_STATE_SYNC_INTERVAL_MS && lastRunTime !== 0) {
        timeoutId = setTimeout(() => {
          timeoutId = undefined;
          rafId = requestAnimationFrame(tick);
        }, VIEW_STATE_SYNC_INTERVAL_MS - elapsed);
        return;
      }
      lastRunTime = now;

      const vs = api.getViewState();
      const ids = vs.selectedNodeIds ?? [];
      const prev = liveViewState;
      const idsChanged =
        prev.selectedNodeIds.length !== ids.length ||
        ids.some((id, i) => prev.selectedNodeIds[i] !== id);
      const viewChanged =
        prev.panX !== vs.panX || prev.panY !== vs.panY || prev.zoom !== vs.zoom || idsChanged;
      if (viewChanged) {
        wasChanging = true;
        frameCount++;
        const onlyPanZoom = !idsChanged;
        const shouldUpdate = onlyPanZoom
          ? frameCount % PAN_ZOOM_UPDATE_EVERY_N_FRAMES === 0
          : true;
        if (shouldUpdate) {
          liveViewState = {
            panX: vs.panX,
            panY: vs.panY,
            zoom: vs.zoom,
            selectedNodeIds: ids
          };
          skippedLast = false;
        } else {
          skippedLast = onlyPanZoom;
        }
      } else {
        if (wasChanging && skippedLast) {
          liveViewState = {
            panX: vs.panX,
            panY: vs.panY,
            zoom: vs.zoom,
            selectedNodeIds: ids
          };
        }
        wasChanging = false;
        skippedLast = false;
      }

      if (timeoutId != null) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = undefined;
      }
      if (viewChanged && idsChanged) {
        rafId = requestAnimationFrame(tick);
      } else {
        timeoutId = setTimeout(() => {
          timeoutId = undefined;
          rafId = requestAnimationFrame(tick);
        }, VIEW_STATE_SYNC_INTERVAL_MS);
      }
    }
    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  });

  // Canvas creation: only depend on container and specs. Do NOT track graph - otherwise
  // clicking background to pan (which deselects nodes and updates graph) would destroy
  // and recreate the canvas, losing the pan state.
  $effect(() => {
    const container = containerEl;
    const specs = nodeSpecs;
    if (!container || !specs.length) return;

    const g = untrack(() => graph);

    const nodeSpecsMap = new Map<string, NodeSpec>();
    for (const spec of specs) {
      nodeSpecsMap.set(spec.id, spec);
    }
    const validationSpecs = toNodeSpecifications(specs);

    const canvasEl = document.createElement('canvas');
    canvasEl.tabIndex = 0;
    canvasEl.style.width = '100%';
    canvasEl.style.height = '100%';
    canvasEl.style.display = 'block';
    canvasEl.style.outline = 'none';
    container.appendChild(canvasEl);

    const paramConnectionsOverlayEl = document.createElement('canvas');
    paramConnectionsOverlayEl.style.cssText = 'position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; display: block;';
    paramConnectionsOverlayEl.setAttribute('aria-hidden', 'true');
    const topOverlayEl = document.createElement('canvas');
    topOverlayEl.style.cssText = 'position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; display: block;';
    topOverlayEl.setAttribute('aria-hidden', 'true');
    const overlayContainer = document.createElement('div');
    overlayContainer.style.cssText = 'position: absolute; inset: 0; z-index: 2; pointer-events: none;';
    overlayContainer.appendChild(paramConnectionsOverlayEl);
    overlayContainer.appendChild(topOverlayEl);
    container.parentElement?.appendChild(overlayContainer);

    const canvas = new NodeEditorCanvas(
      canvasEl,
      g,
      specs,
      undefined,
      overlayBridge ?? undefined,
      () => new Set(getVirtualNodeIdsFromAudioSetup(graphStore.audioSetup)),
      getTimelineState
    );
    canvas.setParameterConnectionsOverlay(paramConnectionsOverlayEl);
    canvas.setTopOverlayCanvas(topOverlayEl);
    // Use wrapper rect for param port screen→canvas so connection endpoints align with DOM nodes
    canvas.setConnectionRectProvider(() => container.parentElement?.getBoundingClientRect() ?? null);
    canvasInstance = canvas;

    canvas.setCallbacks({
      onNodeMoved: (nodeId, x, y) => {
        const node = graphStore.graph.nodes.find((n: NodeInstance) => n.id === nodeId);
        if (node) {
          graphStore.updateNodePosition(nodeId, { x, y });
          syncViewStateFromCanvas(canvas);
          notifyGraphChanged();
        }
      },
      onNodeSelected: (nodeId, multiSelect) => {
        if (multiSelect) {
          // For marquee selection, canvas already has correct selection - sync from it
          syncViewStateFromCanvas(canvas);
          const ids = canvas.getViewState().selectedNodeIds;
          // Update liveViewState immediately so DomNodeLayer shows selection without waiting for sync loop
          liveViewState = { ...liveViewState, selectedNodeIds: ids };
          callbacks.onSelectionChanged?.(ids);
          return;
        }
        const newSelectedIds = nodeId ? [nodeId] : [];
        graphStore.updateViewState({ selectedNodeIds: newSelectedIds });
        syncViewStateFromCanvas(canvas);
        callbacks.onSelectionChanged?.(newSelectedIds);
      },
      onConnectionCreated: (sourceNodeId, sourcePort, targetNodeId, targetPort?, targetParameter?) => {
        const conn: Connection = {
          id: generateId('conn'),
          sourceNodeId,
          sourcePort,
          targetNodeId,
          targetPort,
          targetParameter,
        };
        const result = addConnectionWithValidation(graphStore.graph, conn, validationSpecs);
        syncViewStateFromCanvas(canvas);
        applyAddConnectionResult(result);
      },
      onConnectionSelected: () => {},
      onNodeDeleted: (nodeId) => {
        syncViewStateFromCanvas(canvas);
        graphStore.removeNode(nodeId);
        notifyGraphChanged();
      },
      onConnectionDeleted: (connectionId) => {
        syncViewStateFromCanvas(canvas);
        graphStore.removeConnection(connectionId);
        callbacks.onConnectionRemoved?.(connectionId);
        notifyGraphChanged();
      },
      onParameterChanged: (nodeId, paramName, value) => {
        handleParameterChange(nodeId, paramName, value, canvas);
      },
      onFileParameterChanged: async (nodeId, paramName, file) => {
        try {
          await callbacks.onFileParameterChanged?.(nodeId, paramName, file);
          syncViewStateFromCanvas(canvas);
          canvas.setGraph(graphStore.graph);
          canvas.render();
        } catch (err) {
          console.error('[NodeEditorCanvasWrapper] onFileParameterChanged error:', err);
          throw err;
        }
      },
      onFileDialogOpen: callbacks.onFileDialogOpen,
      onFileDialogClose: callbacks.onFileDialogClose,
      onParameterInputModeChanged: (nodeId, paramName, mode: ParameterInputMode) => {
        graphStore.updateNodeParameterInputMode(nodeId, paramName, mode);
        syncViewStateFromCanvas(canvas);
        canvas.setGraph(graphStore.graph);
        notifyGraphChanged();
      },
      onNodeLabelChanged: (nodeId, label) => {
        graphStore.updateNodeLabel(nodeId, label);
        syncViewStateFromCanvas(canvas);
        canvas.setGraph(graphStore.graph);
        notifyGraphChanged();
      },
      onTypeLabelClick: () => {},
      onNodeContextMenu: callbacks.onNodeContextMenu,
      onCopySelected: () => {
        const ids = graphStore.graph.viewState?.selectedNodeIds ?? [];
        if (ids.length === 0) return;
        const g = graphStore.graph;
        const nodes = g.nodes.filter((n) => ids.includes(n.id));
        const selectedSet = new Set(ids);
        const connections = g.connections.filter(
          (c) => selectedSet.has(c.sourceNodeId) && selectedSet.has(c.targetNodeId)
        );
        copyPasteManager.copy(nodes, connections);
      },
      onPaste: () => {
        if (!copyPasteManager.hasClipboard()) return;
        const c = canvas as unknown as {
          canvas: HTMLCanvasElement;
          screenToCanvas(sx: number, sy: number): { x: number; y: number };
        };
        const r = c.canvas.getBoundingClientRect();
        const pos = c.screenToCanvas(r.left + r.width / 2, r.top + r.height / 2);
        const data = copyPasteManager.paste(pos.x, pos.y);
        if (!data) return;
        syncViewStateFromCanvas(canvas);
        let newGraph = addNodes(graphStore.graph, data.nodes);
        newGraph = addConnections(newGraph, data.connections);
        newGraph = updateViewState(newGraph, { selectedNodeIds: data.nodes.map((n) => n.id) });
        graphStore.setGraph(newGraph);
        callbacks.onSelectionChanged?.(data.nodes.map((n) => n.id));
        notifyGraphChanged();
        canvas.requestRender();
      },
      onDuplicateSelected: () => {
        const ids = graphStore.graph.viewState?.selectedNodeIds ?? [];
        if (ids.length === 0) return;
        const g = graphStore.graph;
        const nodes = g.nodes.filter((n) => ids.includes(n.id));
        const selectedSet = new Set(ids);
        const connections = g.connections.filter(
          (c) => selectedSet.has(c.sourceNodeId) && selectedSet.has(c.targetNodeId)
        );
        copyPasteManager.copy(nodes, connections);
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;
        const metrics = canvas.getNodeMetrics();
        for (const n of nodes) {
          const m = metrics.get(n.id);
          const w = m?.width ?? 0;
          const h = m?.height ?? 0;
          minX = Math.min(minX, n.position.x);
          minY = Math.min(minY, n.position.y);
          maxX = Math.max(maxX, n.position.x + w);
          maxY = Math.max(maxY, n.position.y + h);
        }
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const offset = 24;
        const data = copyPasteManager.paste(centerX + offset, centerY + offset);
        if (!data) return;
        syncViewStateFromCanvas(canvas);
        let newGraph = addNodes(graphStore.graph, data.nodes);
        newGraph = addConnections(newGraph, data.connections);
        newGraph = updateViewState(newGraph, { selectedNodeIds: data.nodes.map((n) => n.id) });
        graphStore.setGraph(newGraph);
        callbacks.onSelectionChanged?.(data.nodes.map((n) => n.id));
        notifyGraphChanged();
        canvas.requestRender();
      },
      hasClipboard: () => copyPasteManager.hasClipboard(),
      isDialogVisible: callbacks.isDialogVisible
    });

    function addNodeToGraph(nodeType: string, x: number, y: number): NodeInstance | null {
      const spec = nodeSpecsMap.get(nodeType);
      if (!spec) return null;
      const parameters: Record<string, ParameterValue> = {};
      for (const [paramName, paramSpec] of Object.entries(spec.parameters)) {
        parameters[paramName] = (paramSpec as { default?: ParameterValue }).default as ParameterValue;
      }
      const tempNode: NodeInstance = {
        id: 'temp',
        type: nodeType,
        position: { x: 0, y: 0 },
        parameters
      };
      const metrics = canvas.getNodeRenderer().calculateMetrics(tempNode, spec);
      const adjustedX = x - metrics.width / 2;
      const adjustedY = y - metrics.headerHeight / 2;
      const node: NodeInstance = {
        id: generateId('node'),
        type: nodeType,
        position: { x: adjustedX, y: adjustedY },
        parameters
      };
      syncViewStateFromCanvas(canvas);
      graphStore.addNode(node);
      const finalMetrics = canvas.getNodeRenderer().calculateMetrics(node, spec);
      canvas.getNodeMetrics().set(node.id, finalMetrics);
      canvas.setGraph(graphStore.graph);
      notifyGraphChanged();
      return node;
    }

    canvasEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'copy';
    });
    canvasEl.addEventListener('drop', (e) => {
      e.preventDefault();
      const nodeType = e.dataTransfer?.getData('text/plain');
      if (nodeType) {
        const pos = (canvas as unknown as { screenToCanvas(x: number, y: number): { x: number; y: number } }).screenToCanvas(e.clientX, e.clientY);
        addNodeToGraph(nodeType, pos.x, pos.y);
      }
    });

    apiProp = buildApi(canvas, addNodeToGraph, nodeSpecsMap);

    return () => {
      canvas.setConnectionRectProvider(null);
      canvas.setTopOverlayCanvas(null);
      canvas.setParameterConnectionsOverlay(null);
      canvas.destroy();
      overlayContainer.removeChild(topOverlayEl);
      overlayContainer.removeChild(paramConnectionsOverlayEl);
      container.parentElement?.removeChild(overlayContainer);
      container.removeChild(canvasEl);
      canvasInstance = null;
      apiProp = null;
    };
  });

  // Apply graph to canvas when prop changes. preserveViewState: true so reactive updates
  // (e.g. parameter change) don't overwrite pan/zoom with stale graph.viewState from the store.
  $effect(() => {
    const canvas = canvasInstance;
    const g = graph;
    if (!canvas) return;
    canvas.setGraph(g, { preserveViewState: true });
  });

  // Forward connection clicks from DOM layer to canvas. Parameter connections render over node
  // bodies; DOM nodes capture clicks before the canvas. Capture-phase intercept when on a connection.
  $effect(() => {
    const wrapper = wrapperEl;
    const api = apiProp;
    const tool = activeTool;
    const space = isSpacebarPressed;
    if (!wrapper || !api?.hitTestConnection) return;
    const handler = (e: MouseEvent) => {
      if (tool !== 'cursor' || space || e.button !== 0) return;
      const connId = api.hitTestConnection?.(e.clientX, e.clientY);
      if (connId && api.forwardMouseDown) {
        e.preventDefault();
        e.stopPropagation();
        (e as MouseEvent & { _connectionClickForward?: string })._connectionClickForward = connId;
        api.forwardMouseDown(e);
      }
    };
    wrapper.addEventListener('mousedown', handler, true);
    return () => wrapper.removeEventListener('mousedown', handler, true);
  });

</script>

<div
  bind:this={wrapperEl}
  class="node-editor-canvas-wrapper"
  style="width: 100%; height: 100%; position: relative; overflow: hidden;"
  use:wheelNonPassive={(e) => apiProp?.handleWheel?.(e)}
>
  <div
    bind:this={containerEl}
    style="position: absolute; inset: 0; z-index: 0;"
  ></div>
  <!-- Hand tool overlay: captures pointer events over nodes so panning works everywhere -->
  <div
    class="hand-tool-overlay"
    class:active={effectiveHandTool}
    class:panning={isHandPanning}
    role="presentation"
    aria-hidden="true"
    onmousedown={(e) => {
      if (effectiveHandTool && apiProp?.forwardMouseDown) {
        e.preventDefault();
        e.stopPropagation();
        isHandPanning = true;
        const onUp = () => {
          isHandPanning = false;
          document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mouseup', onUp);
        apiProp.forwardMouseDown(e);
      }
    }}
  ></div>
  <DomNodeLayer
    graph={graph}
    nodeSpecs={nodeSpecs}
    audioSetup={graphStore.audioSetup}
    getAudioManager={() => apiProp?.getAudioManager?.() ?? undefined}
    getTimelineCurrentTime={getTimelineCurrentTime}
    overlayBridge={overlayBridge}
    onPortPointerDownForConnection={(sx, sy, pointerId) => apiProp?.startConnectionFromPort?.(sx, sy, pointerId)}
    onPortClickForSignalPicker={handlePortClickForSignalPicker}
    onHeaderPortPointerDown={(sx, sy, pointerId) => apiProp?.startConnectionFromPort?.(sx, sy, pointerId)}
    viewState={{
      zoom: liveViewState.zoom,
      panX: liveViewState.panX,
      panY: liveViewState.panY,
      selectedNodeIds: liveViewState.selectedNodeIds
    }}
    canvasApi={apiProp}
    onNodeMoved={(nodeId, x, y) => {
      // Sync view state before graph update so setGraph (triggered by $effect) doesn't overwrite
      // canvas pan/zoom with stale graph.viewState (e.g. 0,0 when user had panned)
      if (canvasInstance) syncViewStateFromCanvas(canvasInstance);
      graphStore.updateNodePosition(nodeId, { x, y });
      canvasInstance?.requestRender?.();
      notifyGraphChanged();
    }}
    onNodeSelected={(nodeId, multiSelect) => {
      if (canvasInstance) syncViewStateFromCanvas(canvasInstance);
      let newIds: string[];
      if (multiSelect) {
        const current = new Set(graphStore.viewState.selectedNodeIds ?? []);
        if (current.has(nodeId)) current.delete(nodeId);
        else current.add(nodeId);
        newIds = Array.from(current);
        graphStore.updateViewState({ selectedNodeIds: newIds });
        callbacks.onSelectionChanged?.(newIds);
      } else {
        newIds = nodeId ? [nodeId] : [];
        graphStore.updateViewState({ selectedNodeIds: newIds });
        callbacks.onSelectionChanged?.(newIds);
      }
      // Push selection to canvas so sync loop (which reads from canvas) doesn't overwrite liveViewState
      canvasInstance?.setSelectionFromDOM?.(newIds);
      canvasInstance?.requestRender?.();
    }}
    onNodeLabelChanged={(nodeId, label) => {
      graphStore.updateNodeLabel(nodeId, label);
      notifyGraphChanged();
      canvasInstance?.requestRender?.();
    }}
    onParameterInputModeChanged={(nodeId, paramName, mode) => {
      if (canvasInstance) syncViewStateFromCanvas(canvasInstance);
      graphStore.updateNodeParameterInputMode(nodeId, paramName, mode);
      canvasInstance?.setGraph?.(graphStore.graph);
      canvasInstance?.requestRender?.();
      notifyGraphChanged();
    }}
    onParameterChange={(nodeId, paramName, value) => {
      handleParameterChange(nodeId, paramName, value, canvasInstance);
      notifyGraphChanged();
    }}
    onNodeContextMenu={(nodeId, clientX, clientY) => {
      const node = graph.nodes.find((n) => n.id === nodeId);
      if (node) callbacks.onNodeContextMenu?.(clientX, clientY, nodeId, node.type);
    }}
  />
</div>

<style>
  .hand-tool-overlay {
    position: absolute;
    inset: 0;
    z-index: 10;
    pointer-events: none;
    cursor: grab;

    &.active {
      pointer-events: auto;
    }

    &.panning {
      cursor: all-scroll;
    }
  }
</style>

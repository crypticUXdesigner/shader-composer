/**
 * CanvasInitializer - Performs post-construction setup for NodeEditorCanvas (managers, layers, orchestrator, etc.).
 * Extracted from NodeEditorCanvas constructor to reduce its size.
 */

import { ViewStateManager, SelectionManager, SmartGuidesManager, EdgeScrollManager, KeyboardShortcutHandler, UIElementManager, HitTestManager, ConnectionStateManager, MetricsManager, OverlayManager } from './canvas';
import { CanvasResizeLifecycle } from './CanvasResizeLifecycle';
import { createCanvasStateSync } from './CanvasStateSync';
import { createNodeEditorCanvasStateBridge } from './NodeEditorCanvasStateBridge';
import { createCanvasLayerSystem } from './CanvasLayerSetup';
import { CanvasOverlayRenderer } from './CanvasOverlayRenderer';
import { RenderingOrchestrator } from './canvas/RenderingOrchestrator';
import { EffectiveValueUpdateRunner } from './EffectiveValueUpdateRunner';

/** Canvas instance during init (read/write). Avoids circular dependency on NodeEditorCanvas. */
export type CanvasInitTarget = Record<string, unknown>;

export function initializeCanvas(
  c: CanvasInitTarget,
  graph: { viewState?: { zoom?: number; panX?: number; panY?: number; selectedNodeIds?: string[] }; nodes: unknown[] },
  overlayBridge?: import('../../types/editor').CanvasOverlayBridge
): void {
  const state = c.state as { zoom: number; panX: number; panY: number };
  c.viewStateManager = new ViewStateManager({ zoom: state.zoom, panX: state.panX, panY: state.panY });
  c.selectionManager = new SelectionManager(graph.viewState?.selectedNodeIds);
  c.smartGuidesManager = new SmartGuidesManager();
  c.edgeScrollManager = new EdgeScrollManager();
  c.keyboardShortcutHandler = new KeyboardShortcutHandler();
  c.uiElementManager = new UIElementManager(overlayBridge);

  c.hitTestManager = new HitTestManager({
    graph: c.graph as import('../../data-model/types').NodeGraph,
    nodeSpecs: c.nodeSpecs as Map<string, import('../../types/nodeSpec').NodeSpec>,
    nodeMetrics: c.nodeMetrics as Map<string, import('./NodeRenderer').NodeRenderMetrics>,
    screenToCanvas: (sx: number, sy: number) => (c.screenToCanvas as (x: number, y: number) => { x: number; y: number })(sx, sy),
    getViewState: () => (c.getViewStateInternal as () => { panX: number; panY: number; zoom: number })(),
    ctx: c.ctx as CanvasRenderingContext2D,
    canvas: c.canvas as HTMLCanvasElement,
    viewStateManager: c.viewStateManager as ViewStateManager,
    getParamPortPositionsFromDOM: () => (c.getParamPortPositionsFromDOM as () => Map<string, { x: number; y: number }>)(),
    getHeaderOutputPortPositionsFromDOM: () => (c.getHeaderOutputPortPositionsFromDOM as () => Map<string, { x: number; y: number }>)(),
    getConnectionHitTestRect: () => (c.getCanvasRectForConnections as () => DOMRect)()
  });

  c.connectionStateManager = new ConnectionStateManager({
    graph: c.graph as import('../../data-model/types').NodeGraph,
    nodeSpecs: c.nodeSpecs as Map<string, import('../../types/nodeSpec').NodeSpec>,
    nodeMetrics: c.nodeMetrics as Map<string, import('./NodeRenderer').NodeRenderMetrics>,
    screenToCanvas: (sx: number, sy: number) => (c.screenToCanvas as (x: number, y: number) => { x: number; y: number })(sx, sy),
    ctx: c.ctx as CanvasRenderingContext2D,
    hitTestPort: (sx: number, sy: number) => (c.hitTestManager as HitTestManager).hitTestPort(sx, sy)
  });

  // stateSync must exist before createCanvasLayerSystem (it calls getSelectionState → stateBridge.getSelectionState)
  c.stateSync = createCanvasStateSync(
    {
      viewStateManager: c.viewStateManager as ViewStateManager,
      selectionManager: c.selectionManager as SelectionManager,
      connectionStateManager: c.connectionStateManager as ConnectionStateManager
    },
    c.state as { zoom: number; panX: number; panY: number; selectedNodeIds: Set<string>; selectedConnectionIds: Set<string> }
  );

  c.stateBridge = createNodeEditorCanvasStateBridge(
    c.stateSync as ReturnType<typeof createCanvasStateSync>,
    c.interactionState as import('./CanvasInteractionState').CanvasInteractionState
  );

  c.metricsManager = new MetricsManager({
    graph: c.graph as import('../../data-model/types').NodeGraph,
    nodeSpecs: c.nodeSpecs as Map<string, import('../../types/nodeSpec').NodeSpec>,
    nodeRenderer: c.nodeRenderer as import('./NodeRenderer').NodeRenderer,
    nodeMetrics: c.nodeMetrics as Map<string, import('./NodeRenderer').NodeRenderMetrics>,
    hitTestManager: c.hitTestManager as HitTestManager,
    connectionStateManager: c.connectionStateManager as ConnectionStateManager
  });

  const layerResult = createCanvasLayerSystem({
    canvas: c.canvas as HTMLCanvasElement,
    graph: c.graph as import('../../data-model/types').NodeGraph,
    getGraph: () => c.graph as import('../../data-model/types').NodeGraph,
    nodeSpecs: c.nodeSpecs as Map<string, import('../../types/nodeSpec').NodeSpec>,
    nodeMetrics: c.nodeMetrics as Map<string, import('./NodeRenderer').NodeRenderMetrics>,
    nodeRenderer: c.nodeRenderer as import('./NodeRenderer').NodeRenderer,
    viewStateManager: c.viewStateManager as ViewStateManager,
    getViewStateInternal: () => (c.getViewStateInternal as () => { panX: number; panY: number; zoom: number })(),
    getSelectionState: () => (c.getSelectionState as () => { selectedNodeIds: Set<string>; selectedConnectionIds: Set<string> })(),
    connectionStateManager: c.connectionStateManager as ConnectionStateManager,
    getDraggedNodeIds: () => Array.from((c.draggedNodeIds as Set<string>)),
    renderState: c.renderState as import('./rendering/RenderState').RenderState,
    getValidVirtualNodeIds: c.getValidVirtualNodeIds as (() => Set<string>) | undefined,
    audioManager: c.audioManager as import('../../runtime/types').IAudioManager | undefined,
    recalculateMetricsForNodes: (nodeIds: string[]) => {
      const g = c.graph as { nodes: { id: string; type: string }[] };
      const specs = c.nodeSpecs as Map<string, import('../../types/nodeSpec').NodeSpec>;
      const metrics = c.nodeMetrics as Map<string, import('./NodeRenderer').NodeRenderMetrics>;
      const renderer = c.nodeRenderer as { calculateMetrics: (node: unknown, spec: import('../../types/nodeSpec').NodeSpec) => import('./NodeRenderer').NodeRenderMetrics };
      for (const nodeId of nodeIds) {
        const node = g.nodes.find((n: { id: string }) => n.id === nodeId);
        if (node) {
          const spec = specs.get(node.type);
          if (spec) {
            const m = renderer.calculateMetrics(node, spec);
            metrics.set(nodeId, m);
          }
        }
      }
    },
    getIsDraggingNode: () => (c.interactionManager ? ((c.getCurrentSmartGuides as () => { vertical: unknown[]; horizontal: unknown[] })().vertical.length > 0 || (c.getCurrentSmartGuides as () => { vertical: unknown[]; horizontal: unknown[] })().horizontal.length > 0 || (c.interactionState as { getInteractionState: () => { isDraggingNode: boolean } }).getInteractionState().isDraggingNode) : (c.interactionState as { getInteractionState: () => { isDraggingNode: boolean } }).getInteractionState().isDraggingNode),
    getSelectionRectangle: () => (c.getSelectionRectangle as () => { x: number; y: number; width: number; height: number } | null)(),
    renderSmartGuides: () => (c.renderSmartGuides as (ctx?: CanvasRenderingContext2D) => void)(),
    renderSelectionRectangle: () => (c.renderSelectionRectangle as (ctx?: CanvasRenderingContext2D) => void)(),
    getParamPortPositionsFromDOM: () => (c.getParamPortPositionsFromDOM as () => Map<string, { x: number; y: number }>)(),
    getHeaderOutputPortPositionsFromDOM: () => (c.getHeaderOutputPortPositionsFromDOM as () => Map<string, { x: number; y: number }>)(),
    getOrchestrator: () => c.renderingOrchestrator as import('./canvas/RenderingOrchestrator').RenderingOrchestrator
  });
  c.layerManager = layerResult.layerManager;
  c.connectionLayerRenderer = layerResult.connectionLayerRenderer;
  c.parameterConnectionLayerRenderer = layerResult.parameterConnectionLayerRenderer;
  c.overlayLayerRenderer = layerResult.overlayLayerRenderer;

  c.overlayRenderer = new CanvasOverlayRenderer({
    parameterConnectionsOverlayCanvas: c.parameterConnectionsOverlayCanvas as HTMLCanvasElement | null,
    topOverlayCanvas: c.topOverlayCanvas as HTMLCanvasElement | null,
    getViewStateInternal: () => (c.getViewStateInternal as () => { panX: number; panY: number; zoom: number })(),
    renderParameterConnectionLayer: (ctx: CanvasRenderingContext2D) => (c.parameterConnectionLayerRenderer as { render: (ctx: CanvasRenderingContext2D, state: unknown) => void })?.render(ctx, c.renderState),
    getIsConnecting: () => (c.connectionStateManager as ConnectionStateManager).getIsConnecting(),
    renderTemporaryConnection: (ctx: CanvasRenderingContext2D) => (c.connectionStateManager as ConnectionStateManager).renderTemporaryConnection(ctx),
    renderSmartGuides: (ctx?: CanvasRenderingContext2D) => (c.renderSmartGuides as (ctx?: CanvasRenderingContext2D) => void)(ctx),
    renderSelectionRectangle: (ctx?: CanvasRenderingContext2D) => (c.renderSelectionRectangle as (ctx?: CanvasRenderingContext2D) => void)(ctx),
    getCurrentSmartGuides: () => (c.getCurrentSmartGuides as () => { vertical: Array<{ x: number; startY: number; endY: number }>; horizontal: Array<{ y: number; startX: number; endX: number }> })(),
    getIsDraggingNode: () => (c.interactionState as { getInteractionState: () => { isDraggingNode: boolean } }).getInteractionState().isDraggingNode,
    getSelectionRectangle: () => (c.getSelectionRectangle as () => { x: number; y: number; width: number; height: number } | null)()
  });

  c.resizeLifecycle = new CanvasResizeLifecycle({
    canvas: c.canvas as HTMLCanvasElement,
    ctx: c.ctx as CanvasRenderingContext2D,
    viewStateManager: c.viewStateManager as ViewStateManager,
    getViewStateInternal: () => (c.getViewStateInternal as () => { panX: number; panY: number; zoom: number })(),
    renderState: c.renderState as import('./rendering/RenderState').RenderState,
    fillBackground: () => (c.renderingOrchestrator as { fillBackground: () => void }).fillBackground(),
    requestRender: () => (c.renderingOrchestrator as { requestRender: () => void }).requestRender(),
    onResizeProcessed: () => (c.overlayRenderer as CanvasOverlayRenderer).invalidateOverlayDimensions()
  });

  c.renderingOrchestrator = new RenderingOrchestrator({
    canvas: c.canvas as HTMLCanvasElement,
    ctx: c.ctx as CanvasRenderingContext2D,
    graph: c.graph as import('../../data-model/types').NodeGraph,
    nodeSpecs: c.nodeSpecs as Map<string, import('../../types/nodeSpec').NodeSpec>,
    nodeMetrics: c.nodeMetrics as Map<string, import('./NodeRenderer').NodeRenderMetrics>,
    nodeRenderer: c.nodeRenderer as import('./NodeRenderer').NodeRenderer,
    layerManager: c.layerManager as import('./rendering/LayerManager').LayerManager,
    renderState: c.renderState as import('./rendering/RenderState').RenderState,
    viewStateManager: c.viewStateManager as ViewStateManager,
    connectionStateManager: c.connectionStateManager as ConnectionStateManager,
    audioManager: c.audioManager as import('../../runtime/types').IAudioManager | undefined,
    getViewStateInternal: () => (c.getViewStateInternal as () => { panX: number; panY: number; zoom: number })(),
    getSelectionState: () => (c.getSelectionState as () => { selectedNodeIds: Set<string>; selectedConnectionIds: Set<string> })(),
    getCachedViewportDimensions: () => (c.resizeLifecycle as CanvasResizeLifecycle).getCachedViewportDimensions(),
    renderSmartGuides: () => (c.renderSmartGuides as () => void)(),
    renderSelectionRectangle: () => (c.renderSelectionRectangle as () => void)(),
    getCurrentSmartGuides: () => (c.getCurrentSmartGuides as () => { vertical: Array<{ x: number; startY: number; endY: number }>; horizontal: Array<{ y: number; startX: number; endX: number }> })(),
    getIsDraggingNode: () => (c.interactionState as { getInteractionState: () => { isDraggingNode: boolean } }).getInteractionState().isDraggingNode,
    getDraggingNodeId: () => (c.interactionState as { getInteractionState: () => { draggingNodeId: string | null } }).getInteractionState().draggingNodeId,
    getSelectionRectangle: () => (c.getSelectionRectangle as () => { x: number; y: number; width: number; height: number } | null)(),
    processPendingResize: () => (c.resizeLifecycle as CanvasResizeLifecycle).handleResize(),
    renderParameterConnectionsOverlay: () => (c.overlayRenderer as CanvasOverlayRenderer).renderParameterConnectionsToOverlay(),
    renderTopOverlay: () => (c.overlayRenderer as CanvasOverlayRenderer).renderTopOverlayToCanvas()
  });

  c.effectiveValueUpdateRunner = new EffectiveValueUpdateRunner({
    getGraph: () => c.graph as import('../../data-model/types').NodeGraph,
    nodeSpecs: c.nodeSpecs as Map<string, import('../../types/nodeSpec').NodeSpec>,
    markNodesDirty: (nodeIds: string[]) => (c.renderState as { markNodesDirty: (ids: string[]) => void }).markNodesDirty(nodeIds),
    requestRender: () => (c.renderingOrchestrator as { requestRender: () => void }).requestRender(),
    getTimelineState: (c as { getTimelineStateCallback(): (() => import('../../runtime/types').TimelineState | null) | undefined }).getTimelineStateCallback?.()
  });
  (c.effectiveValueUpdateRunner as EffectiveValueUpdateRunner).start();

  c.overlayManager = new OverlayManager({
    uiElementManager: c.uiElementManager as UIElementManager,
    hitTestManager: c.hitTestManager as HitTestManager,
    nodeSpecs: c.nodeSpecs as Map<string, import('../../types/nodeSpec').NodeSpec>,
    nodeMetrics: c.nodeMetrics as Map<string, import('./NodeRenderer').NodeRenderMetrics>,
    graph: c.graph as import('../../data-model/types').NodeGraph,
    nodeRenderer: c.nodeRenderer as import('./NodeRenderer').NodeRenderer,
    ctx: c.ctx as CanvasRenderingContext2D,
    onParameterChanged: c.onParameterChanged as (nodeId: string, paramName: string, value: unknown) => void | undefined,
    onNodeLabelChanged: c.onNodeLabelChanged as (nodeId: string, label: string | undefined) => void | undefined,
    onFileParameterChanged: c.onFileParameterChanged as (nodeId: string, paramName: string, file: File) => void | undefined,
    onFileDialogOpen: c.onFileDialogOpen as (() => void) | undefined,
    onFileDialogClose: c.onFileDialogClose as (() => void) | undefined,
    getOnConnectionCreated: () => c.onConnectionCreated as (() => void) | undefined,
    getOnConnectionRemoved: () => c.onConnectionDeleted as (() => void) | undefined,
    updateNodeMetrics: () => (c.metricsManager as MetricsManager).updateNodeMetrics(),
    render: () => (c.renderingOrchestrator as { render: () => void }).render()
  });

}

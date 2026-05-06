/**
 * NodeEditorCanvasPostInit - Post-constructor setup (handlers, listeners, initial fit).
 * Extracted from NodeEditorCanvas (03A further refactor) to reduce its size.
 */

import type { NodeGraph } from '../../data-model/types';
import type { createCanvasStateSync } from './CanvasStateSync';
import type { NodeRenderer, NodeRenderMetrics } from './NodeRenderer';

/** Canvas instance after initializeCanvas; used by post-init. */
export type NodeEditorCanvasPostInitTarget = {
  graph: NodeGraph;
  viewStateManager: { getState: () => { panX: number; panY: number; zoom: number } };
  nodeSpecs: Map<string, import('../../types/nodeSpec').NodeSpec>;
  nodeMetrics: Map<string, NodeRenderMetrics>;
  nodeRenderer: NodeRenderer;
  stateSync: ReturnType<typeof createCanvasStateSync>;
  interactionState: import('./CanvasInteractionState').CanvasInteractionState;
  metricsManager: { updateNodeMetrics: () => void };
  renderingOrchestrator: { markFullRedraw: () => void };
  resizeLifecycle: { startObserving: () => void; resize: () => void };
  setupManagerContexts: () => void;
  setupInteractionHandlers: () => void;
  initializeEventHandlers: () => void;
  setupEventListeners: () => void;
  fitToView: () => void;
  onNodeDeleted?: (nodeId: string) => void;
  onConnectionDeleted?: (connectionId: string) => void;
  onCopySelected?: () => void;
  onPaste?: () => void;
  onDuplicateSelected?: () => void;
  hasClipboard?: () => boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  getOnNodeDeleted?: () => ((nodeId: string) => void) | undefined;
  getOnConnectionDeleted?: () => ((connectionId: string) => void) | undefined;
  getOnCopySelected?: () => (() => void) | undefined;
  getOnPaste?: () => (() => void) | undefined;
  getOnDuplicateSelected?: () => (() => void) | undefined;
  getHasClipboard?: () => (() => boolean) | undefined;
  getOnUndo?: () => (() => void) | undefined;
  getOnRedo?: () => (() => void) | undefined;
  // Refs only (satisfy noUnusedLocals)
  draggedNodeIds: Set<string>;
  getValidVirtualNodeIds?: () => Set<string>;
  onFileParameterChanged?: (nodeId: string, paramName: string, file: File) => void;
  onFileDialogOpen?: () => void;
  onFileDialogClose?: () => void;
  onNodeLabelChanged?: (nodeId: string, label: string | undefined) => void;
  onTypeLabelClick?: (portType: string, screenX: number, screenY: number, typeLabelBounds?: unknown) => void;
  getParamPortPositionsFromDOM?: () => Map<string, { x: number; y: number }>;
  getHeaderOutputPortPositionsFromDOM?: () => Map<string, { x: number; y: number }>;
  getCanvasRectForConnections?: () => DOMRect;
  renderSelectionRectangle?: (ctx?: CanvasRenderingContext2D) => void;
  getConnectionState?: () => unknown;
  setConnectionState?: (state: unknown) => void;
  getPanState?: () => unknown;
  setPanState?: (state: unknown) => void;
  getInteractionState?: () => unknown;
  setInteractionState?: (state: unknown) => void;
  updateMousePosition?: (x: number, y: number) => void;
  detachDocumentListeners?: () => void;
  onSpacebarStateChange?: (isPressed: boolean) => void;
  isDialogVisible?: () => boolean;
  connectionLayerRenderer?: unknown;
  parameterConnectionLayerRenderer?: unknown;
  isSpacePressed?: boolean;
  onNodeMoved?: (nodeId: string, x: number, y: number) => void;
  onNodeSelected?: (nodeId: string | null, multiSelect: boolean) => void;
  onConnectionSelected?: (connectionId: string | null, multiSelect: boolean) => void;
  onParameterChanged?: (nodeId: string, paramName: string, value: unknown) => void;
  onParameterInputModeChanged?: (nodeId: string, paramName: string, mode: unknown) => void;
  connectionStateManager?: unknown;
  getSelectionState?: () => { selectedNodeIds: Set<string>; selectedConnectionIds: Set<string> };
  canvasToScreen?: (canvasX: number, canvasY: number) => { x: number; y: number };
  setDraggedNodeIds?: (nodeIds: string[]) => void;
  setPanStateInternal?: (state: unknown) => void;
  setSelectionRectangleInternal?: (rect: unknown) => void;
  renderState?: unknown;
  screenToCanvas?: (screenX: number, screenY: number) => { x: number; y: number };
};

/**
 * Satisfy noUnusedLocals for refs used by CanvasInitializer / EventHandlerDeps / buildManagerContextDeps.
 * Call once after all setup so the compiler does not warn on intentionally unused private methods/refs.
 */
export function satisfyCanvasRefsForInitializer(c: NodeEditorCanvasPostInitTarget): void {
  void [
    c.draggedNodeIds,
    c.getValidVirtualNodeIds,
    c.onFileParameterChanged,
    c.onFileDialogOpen,
    c.onFileDialogClose,
    c.onNodeLabelChanged,
    c.onTypeLabelClick,
    c.getParamPortPositionsFromDOM,
    c.getHeaderOutputPortPositionsFromDOM,
    c.getCanvasRectForConnections,
    c.renderSelectionRectangle,
    c.getConnectionState,
    c.setConnectionState,
    c.getPanState,
    c.setPanState,
    c.getInteractionState,
    c.setInteractionState,
    c.updateMousePosition,
    c.detachDocumentListeners,
    c.onNodeDeleted,
    c.onConnectionDeleted,
    c.onSpacebarStateChange,
    c.isDialogVisible,
    c.onCopySelected,
    c.onPaste,
    c.onDuplicateSelected,
    c.hasClipboard,
    c.onUndo,
    c.onRedo,
    c.connectionLayerRenderer,
    c.parameterConnectionLayerRenderer,
    c.isSpacePressed,
    c.onNodeMoved,
    c.onNodeSelected,
    c.onConnectionSelected,
    c.onParameterChanged,
    c.onParameterInputModeChanged,
    c.connectionStateManager,
    c.getSelectionState,
    c.canvasToScreen,
    c.setDraggedNodeIds,
    c.setPanStateInternal,
    c.setSelectionRectangleInternal,
    c.renderState,
    c.screenToCanvas
  ];
}

/**
 * Run post-constructor initialization: state bridge, getter refs, manager contexts, interaction handlers,
 * metrics, event handlers/listeners, resize, initial fit.
 */
export function runNodeEditorCanvasPostInit(c: NodeEditorCanvasPostInitTarget): void {
  (c as unknown as { getOnNodeDeleted: () => typeof c.onNodeDeleted }).getOnNodeDeleted = () => c.onNodeDeleted;
  (c as unknown as { getOnConnectionDeleted: () => typeof c.onConnectionDeleted }).getOnConnectionDeleted = () => c.onConnectionDeleted;
  (c as unknown as { getOnCopySelected: () => typeof c.onCopySelected }).getOnCopySelected = () => c.onCopySelected;
  (c as unknown as { getOnPaste: () => typeof c.onPaste }).getOnPaste = () => c.onPaste;
  (c as unknown as { getOnDuplicateSelected: () => typeof c.onDuplicateSelected }).getOnDuplicateSelected = () => c.onDuplicateSelected;
  (c as unknown as { getHasClipboard: () => typeof c.hasClipboard }).getHasClipboard = () => c.hasClipboard;
  (c as unknown as { getOnUndo: () => typeof c.onUndo }).getOnUndo = () => c.onUndo;
  (c as unknown as { getOnRedo: () => typeof c.onRedo }).getOnRedo = () => c.onRedo;

  c.setupManagerContexts();
  c.setupInteractionHandlers();
  c.metricsManager.updateNodeMetrics();
  c.initializeEventHandlers();
  c.setupEventListeners();
  c.resizeLifecycle.startObserving();
  c.resizeLifecycle.resize();

  const graph = c.graph;
  const hasCustomViewState =
    graph.viewState &&
    ((graph.viewState.zoom !== undefined && graph.viewState.zoom !== 1.0) ||
      (graph.viewState.panX !== undefined && graph.viewState.panX !== 0) ||
      (graph.viewState.panY !== undefined && graph.viewState.panY !== 0));
  if (!hasCustomViewState && graph.nodes.length > 0) {
    requestAnimationFrame(() => c.fitToView());
  } else {
    c.renderingOrchestrator.markFullRedraw();
  }
}

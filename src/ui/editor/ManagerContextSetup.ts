/**
 * ManagerContextSetup - Sets up edge scroll, UI element, and keyboard shortcut manager contexts.
 * Extracted from NodeEditorCanvas to reduce its size.
 */

import type { CanvasState } from './NodeEditorCanvas';
import type { NodeInstance } from '../../data-model/types';

export interface ManagerContextSetupDeps {
  canvas: HTMLCanvasElement;
  state: CanvasState;
  viewStateManager: {
    addPan: (dx: number, dy: number) => void;
    getState: () => { panX: number; panY: number; zoom: number };
    screenToCanvas: (sx: number, sy: number, rect: DOMRect) => { x: number; y: number };
    canvasToScreen: (cx: number, cy: number, rect: DOMRect) => { x: number; y: number };
  };
  selectionManager: {
    getState: () => { selectedNodeIds: Set<string>; selectedConnectionIds: Set<string> };
    clear: () => void;
  };
  edgeScrollManager: { setContext: (ctx: import('./canvas/EdgeScrollManager').EdgeScrollContext) => void };
  uiElementManager: {
    setContext: (ctx: import('./canvas/UIElementManager').UIElementContext) => void;
    isAnyUIActive: () => boolean;
  };
  keyboardShortcutHandler: { initialize: (ctx: import('./canvas/KeyboardShortcutHandler').KeyboardShortcutContext) => void };
  renderingOrchestrator: { requestRender: () => void; render: () => void };
  connectionStateManager: { getIsConnecting: () => boolean };
  renderState: { markNodesDirty: (nodeIds: string[]) => void; markFullRedraw: () => void };
  graph: { nodes: NodeInstance[] };
  screenToCanvas: (screenX: number, screenY: number) => { x: number; y: number };
  calculateSmartGuides: (
    draggingNode: NodeInstance,
    proposedX: number,
    proposedY: number
  ) => { snappedX: number; snappedY: number };
  /** Getters so edge-scroll callback sees current drag state */
  getIsDraggingNode: () => boolean;
  getDraggingNodeId: () => string | null;
  getDraggingNodeInitialPos: () => { x: number; y: number } | null;
  getSelectedNodesInitialPositions: () => Map<string, { x: number; y: number }>;
  getDragOffsetX: () => number;
  getDragOffsetY: () => number;
  getCurrentMouse: () => { x: number; y: number };
  getIsPanning: () => boolean;
  /** Writable so setup can update canvas state when spacebar changes */
  isSpacePressed: boolean;
  onNodeMoved?: (nodeId: string, x: number, y: number) => void;
  onNodeDeleted?: (nodeId: string) => void;
  onConnectionDeleted?: (connectionId: string) => void;
  /** When set, used at invoke time so Delete key sees current callbacks (callbacks are set after setup). */
  getOnNodeDeleted?: () => ManagerContextSetupDeps['onNodeDeleted'];
  getOnConnectionDeleted?: () => ManagerContextSetupDeps['onConnectionDeleted'];
  /** When set, used at invoke time so Copy/Paste/Duplicate see current callbacks (set after setCallbacks). */
  getOnCopySelected?: () => (() => void) | undefined;
  getOnPaste?: () => (() => void) | undefined;
  getOnDuplicateSelected?: () => (() => void) | undefined;
  getHasClipboard?: () => (() => boolean) | undefined;
  onSpacebarStateChange?: (isPressed: boolean) => void;
  isDialogVisible?: () => boolean;
  onCopySelected?: () => void;
  onPaste?: () => void;
  onDuplicateSelected?: () => void;
  hasClipboard?: () => boolean;
}

/** Canvas-shaped source for building ManagerContextSetupDeps (avoids circular dependency). */
export interface ManagerContextSetupDepsSource {
  readonly canvas: HTMLCanvasElement;
  readonly state: CanvasState;
  readonly viewStateManager: ManagerContextSetupDeps['viewStateManager'];
  readonly selectionManager: ManagerContextSetupDeps['selectionManager'];
  readonly edgeScrollManager: ManagerContextSetupDeps['edgeScrollManager'];
  readonly uiElementManager: ManagerContextSetupDeps['uiElementManager'];
  readonly keyboardShortcutHandler: ManagerContextSetupDeps['keyboardShortcutHandler'];
  readonly renderingOrchestrator: ManagerContextSetupDeps['renderingOrchestrator'];
  readonly connectionStateManager: ManagerContextSetupDeps['connectionStateManager'];
  readonly renderState: ManagerContextSetupDeps['renderState'];
  readonly graph: ManagerContextSetupDeps['graph'];
  readonly interactionState: {
    getCurrentMouse(): { x: number; y: number };
    getInteractionState(): {
      isDraggingNode: boolean;
      draggingNodeId: string | null;
      draggingNodeInitialPos: { x: number; y: number } | null;
      selectedNodesInitialPositions: Map<string, { x: number; y: number }>;
      dragOffsetX: number;
      dragOffsetY: number;
    };
    getPanState(): { isPanning: boolean };
  };
  screenToCanvas(screenX: number, screenY: number): { x: number; y: number };
  calculateSmartGuides(node: NodeInstance, proposedX: number, proposedY: number): { snappedX: number; snappedY: number };
  isSpacePressed: boolean;
  onNodeMoved?: (nodeId: string, x: number, y: number) => void;
  onNodeDeleted?: (nodeId: string) => void;
  onConnectionDeleted?: (connectionId: string) => void;
  getOnNodeDeleted?: () => ManagerContextSetupDepsSource['onNodeDeleted'];
  getOnConnectionDeleted?: () => ManagerContextSetupDepsSource['onConnectionDeleted'];
  getOnCopySelected?: () => (() => void) | undefined;
  getOnPaste?: () => (() => void) | undefined;
  getOnDuplicateSelected?: () => (() => void) | undefined;
  getHasClipboard?: () => (() => boolean) | undefined;
  onSpacebarStateChange?: (isPressed: boolean) => void;
  isDialogVisible?: () => boolean;
  onCopySelected?: () => void;
  onPaste?: () => void;
  onDuplicateSelected?: () => void;
  hasClipboard?: () => boolean;
}

export function buildManagerContextDeps(source: ManagerContextSetupDepsSource): ManagerContextSetupDeps {
  const ist = source.interactionState;
  return {
    canvas: source.canvas,
    state: source.state,
    getCurrentMouse: () => ist.getCurrentMouse(),
    viewStateManager: source.viewStateManager,
    selectionManager: source.selectionManager,
    edgeScrollManager: source.edgeScrollManager,
    uiElementManager: source.uiElementManager,
    keyboardShortcutHandler: source.keyboardShortcutHandler,
    renderingOrchestrator: source.renderingOrchestrator,
    connectionStateManager: source.connectionStateManager,
    renderState: source.renderState,
    graph: source.graph,
    screenToCanvas: (x, y) => source.screenToCanvas(x, y),
    calculateSmartGuides: (node, px, py) => source.calculateSmartGuides(node, px, py),
    getIsDraggingNode: () => ist.getInteractionState().isDraggingNode,
    getDraggingNodeId: () => ist.getInteractionState().draggingNodeId,
    getDraggingNodeInitialPos: () => ist.getInteractionState().draggingNodeInitialPos,
    getSelectedNodesInitialPositions: () => ist.getInteractionState().selectedNodesInitialPositions,
    getDragOffsetX: () => ist.getInteractionState().dragOffsetX,
    getDragOffsetY: () => ist.getInteractionState().dragOffsetY,
    getIsPanning: () => ist.getPanState().isPanning,
    isSpacePressed: source.isSpacePressed,
    onNodeMoved: source.onNodeMoved,
    onNodeDeleted: source.onNodeDeleted,
    onConnectionDeleted: source.onConnectionDeleted,
    getOnNodeDeleted: source.getOnNodeDeleted ?? (() => source.onNodeDeleted),
    getOnConnectionDeleted: source.getOnConnectionDeleted ?? (() => source.onConnectionDeleted),
    getOnCopySelected: source.getOnCopySelected ?? (() => source.onCopySelected),
    getOnPaste: source.getOnPaste ?? (() => source.onPaste),
    getOnDuplicateSelected: source.getOnDuplicateSelected ?? (() => source.onDuplicateSelected),
    getHasClipboard: source.getHasClipboard ?? (() => source.hasClipboard),
    onSpacebarStateChange: source.onSpacebarStateChange,
    /** Getter so keyboard handler sees current callback (set by setCallbacks after init). */
    isDialogVisible: () => source.isDialogVisible?.() ?? false,
    onCopySelected: source.onCopySelected,
    onPaste: source.onPaste,
    onDuplicateSelected: source.onDuplicateSelected,
    hasClipboard: source.hasClipboard
  };
}

export function setupManagerContexts(deps: ManagerContextSetupDeps): void {
  deps.edgeScrollManager.setContext({
    getCanvasRect: () => deps.canvas.getBoundingClientRect(),
    getMousePosition: () => deps.getCurrentMouse(),
    onPanChanged: (deltaX: number, deltaY: number) => {
      deps.viewStateManager.addPan(deltaX, deltaY);
      const newState = deps.viewStateManager.getState();
      deps.state.panX = newState.panX;
      deps.state.panY = newState.panY;

      const isDraggingNode = deps.getIsDraggingNode();
      const draggingNodeId = deps.getDraggingNodeId();
      const draggingNodeInitialPos = deps.getDraggingNodeInitialPos();
      if (isDraggingNode && draggingNodeId && draggingNodeInitialPos) {
        const node = deps.graph.nodes.find((n) => n.id === draggingNodeId);
        if (node) {
          const mouse = deps.getCurrentMouse();
          const canvasPos = deps.screenToCanvas(
            mouse.x - deps.getDragOffsetX(),
            mouse.y - deps.getDragOffsetY()
          );
          const { snappedX, snappedY } = deps.calculateSmartGuides(
            node,
            canvasPos.x,
            canvasPos.y
          );
          const deltaX2 = snappedX - draggingNodeInitialPos.x;
          const deltaY2 = snappedY - draggingNodeInitialPos.y;
          const movedNodeIds: string[] = [];
          for (const [nodeId, initialPos] of deps.getSelectedNodesInitialPositions().entries()) {
            const selectedNode = deps.graph.nodes.find((n) => n.id === nodeId);
            if (selectedNode) {
              selectedNode.position.x = Math.round(initialPos.x + deltaX2);
              selectedNode.position.y = Math.round(initialPos.y + deltaY2);
              movedNodeIds.push(nodeId);
              deps.onNodeMoved?.(nodeId, selectedNode.position.x, selectedNode.position.y);
            }
          }
          deps.renderState.markNodesDirty(movedNodeIds);
        }
      }
      deps.renderState.markFullRedraw();
      deps.renderingOrchestrator.requestRender();
    }
  });

  deps.uiElementManager.setContext({
    getCanvas: () => deps.canvas,
    getZoom: () => deps.viewStateManager.getState().zoom,
    getPanZoom: () => {
      const s = deps.viewStateManager.getState();
      return { panX: s.panX, panY: s.panY, zoom: s.zoom };
    },
    screenToCanvas: (screenX: number, screenY: number) =>
      deps.viewStateManager.screenToCanvas(screenX, screenY, deps.canvas.getBoundingClientRect()),
    canvasToScreen: (canvasX: number, canvasY: number) =>
      deps.viewStateManager.canvasToScreen(canvasX, canvasY, deps.canvas.getBoundingClientRect())
  });

  deps.keyboardShortcutHandler.initialize({
    isInputActive: () => deps.uiElementManager.isAnyUIActive(),
    isDialogVisible: () => deps.isDialogVisible?.() ?? false,
    onDeleteSelected: () => {
      const selection = deps.selectionManager.getState();
      const onNodeDeleted = deps.getOnNodeDeleted?.() ?? deps.onNodeDeleted;
      const onConnectionDeleted = deps.getOnConnectionDeleted?.() ?? deps.onConnectionDeleted;
      for (const nodeId of selection.selectedNodeIds) {
        onNodeDeleted?.(nodeId);
      }
      for (const connId of selection.selectedConnectionIds) {
        onConnectionDeleted?.(connId);
      }
      deps.selectionManager.clear();
      const newSelection = deps.selectionManager.getState();
      deps.state.selectedNodeIds = newSelection.selectedNodeIds;
      deps.state.selectedConnectionIds = newSelection.selectedConnectionIds;
      deps.renderingOrchestrator.render();
    },
    onSpacebarStateChange: (isPressed: boolean) => {
      deps.isSpacePressed = isPressed;
      deps.onSpacebarStateChange?.(isPressed);
    },
    setCursor: (cursor: string) => {
      deps.canvas.style.cursor = cursor;
    },
    isPanning: deps.getIsPanning,
    isDraggingNode: deps.getIsDraggingNode,
    isConnecting: () => deps.connectionStateManager.getIsConnecting(),
    onCopySelected: () => deps.getOnCopySelected?.()?.(),
    onPaste: () => deps.getOnPaste?.()?.(),
    onDuplicateSelected: () => deps.getOnDuplicateSelected?.()?.(),
    hasClipboard: () => deps.getHasClipboard?.()?.() ?? false
  });
}

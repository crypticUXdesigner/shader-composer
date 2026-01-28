/**
 * Handler Context Builder
 * 
 * Provides a fluent API for constructing HandlerContext objects.
 * This simplifies the creation of handler contexts and reduces boilerplate code.
 */

import type { HandlerContext } from '../../interactions/HandlerContext';
import type { CanvasState } from '../NodeEditorCanvas';
import type { NodeGraph } from '../../../types/nodeGraph';
import type { NodeSpec } from '../../../types/nodeSpec';
import type { NodeInstance } from '../../../types/nodeGraph';
import type { NodeRenderMetrics } from '../NodeRenderer';
import { RenderLayer } from '../rendering/RenderState';
import type { ToolType } from '../BottomBar';

/**
 * Dependencies needed to build a HandlerContext.
 * These are passed from NodeEditorCanvas to the builder.
 */
export interface HandlerContextDependencies {
  // State access
  getViewStateInternal: () => { zoom: number; panX: number; panY: number };
  getSelectionState: () => { selectedNodeIds: Set<string>; selectedConnectionIds: Set<string> };
  graph: NodeGraph;
  /** When set, used so getGraph() always returns the current graph (e.g. after setGraph). */
  getGraph?: () => NodeGraph;
  nodeSpecs: Map<string, NodeSpec>;
  
  // Managers
  viewStateManager: { setViewState: (state: { zoom: number; panX: number; panY: number }) => void };
  selectionManager: {
    getState: () => { selectedNodeIds: Set<string>; selectedConnectionIds: Set<string> };
    deselectNode: (nodeId: string) => void;
    selectNode: (nodeId: string, multiSelect: boolean) => void;
    deselectConnection: (connectionId: string) => void;
    selectConnection: (connectionId: string, multiSelect: boolean) => void;
  };
  hitTestManager: {
    hitTestNode: (screenX: number, screenY: number) => string | null;
    hitTestPort: (screenX: number, screenY: number) => {
      nodeId: string;
      port: string;
      isOutput: boolean;
      parameter?: string;
    } | null;
    hitTestParameter: (screenX: number, screenY: number) => {
      nodeId: string;
      paramName: string;
      isString?: boolean;
    } | null;
    hitTestBezierControlPoint: (screenX: number, screenY: number) => {
      nodeId: string;
      controlIndex: number;
    } | null;
    hitTestConnection: (screenX: number, screenY: number) => string | null;
  };
  connectionStateManager: {
    setState: (state: Partial<{
      isConnecting: boolean;
      connectionStartNodeId: string | null;
      connectionStartPort: string | null;
      connectionStartParameter: string | null;
      connectionStartIsOutput: boolean;
      connectionMouseX: number;
      connectionMouseY: number;
      hoveredPort: {
        nodeId: string;
        port: string;
        isOutput: boolean;
        parameter?: string;
      } | null;
    }>) => void;
  };
  
  // Coordinate conversion
  screenToCanvas: (screenX: number, screenY: number) => { x: number; y: number };
  canvasToScreen: (canvasX: number, canvasY: number) => { x: number; y: number };
  
  // Rendering
  requestRender: () => void;
  render: () => void;
  
  // UI updates
  canvas: HTMLCanvasElement;
  
  // Node operations
  nodeMetrics: Map<string, NodeRenderMetrics>;
  nodeComponents: Map<string, { invalidateMetrics: () => void }>;
  nodeRenderer: { invalidateMetrics: (nodeId: string) => void };
  calculateSmartGuides: (draggingNode: NodeInstance, proposedX: number, proposedY: number) => {
    snappedX: number;
    snappedY: number;
    guides: {
      vertical: Array<{ x: number; startY: number; endY: number }>;
      horizontal: Array<{ y: number; startX: number; endX: number }>;
    };
  };
  renderState: {
    markNodesDirty: (nodeIds: string[]) => void;
    markConnectionsDirty: (connectionIds: string[]) => void;
    markLayerDirty: (layer: RenderLayer) => void;
  };
  
  // State setters (these modify NodeEditorCanvas instance properties)
  setSmartGuides: (guides: {
    vertical: Array<{ x: number; startY: number; endY: number }>;
    horizontal: Array<{ y: number; startX: number; endX: number }>;
  }) => void;
  setDraggedNodeIds: (nodeIds: string[]) => void;
  setPanStateInternal: (state: {
    isPanning: boolean;
    potentialBackgroundPan: boolean;
    panStartX: number;
    panStartY: number;
    backgroundDragStartX: number;
    backgroundDragStartY: number;
  }) => void;
  setSelectionRectangleInternal: (rect: { x: number; y: number; width: number; height: number } | null) => void;
  
  // Callbacks (optional). Prefer getters when callbacks may be set after context creation.
  onNodeMoved?: (nodeId: string, x: number, y: number) => void;
  onNodeSelected?: (nodeId: string | null, multiSelect: boolean) => void;
  onConnectionCreated?: (sourceNodeId: string, sourcePort: string, targetNodeId: string, targetPort?: string, targetParameter?: string) => void;
  getOnConnectionCreated?: () => HandlerContextDependencies['onConnectionCreated'];
  onConnectionSelected?: (connectionId: string | null, multiSelect: boolean) => void;
  onParameterChanged?: (nodeId: string, paramName: string, value: number | number[][]) => void;
  getOnParameterChanged?: () => HandlerContextDependencies['onParameterChanged'];
  onParameterInputModeChanged?: (nodeId: string, paramName: string, mode: import('../../../types/nodeSpec').ParameterInputMode) => void;
  getOnParameterInputModeChanged?: () => HandlerContextDependencies['onParameterInputModeChanged'];
  
  // Keyboard state
  isSpacePressed: boolean;
  
  // Tool state - use getter function to always get current value
  getActiveTool: () => ToolType;
}

/**
 * Builder for creating HandlerContext instances.
 * Provides a fluent API for setting context properties.
 */
export class HandlerContextBuilder {
  private deps: HandlerContextDependencies;

  constructor(dependencies: HandlerContextDependencies) {
    this.deps = dependencies;
  }

  /**
   * Builds and returns a complete HandlerContext instance.
   */
  build(): HandlerContext {
    return {
      getState: () => {
        const viewState = this.deps.getViewStateInternal();
        const selection = this.deps.getSelectionState();
        return {
          zoom: viewState.zoom,
          panX: viewState.panX,
          panY: viewState.panY,
          selectedNodeIds: new Set(selection.selectedNodeIds),
          selectedConnectionIds: new Set(selection.selectedConnectionIds)
        };
      },
      setState: (updater) => {
        const viewState = this.deps.getViewStateInternal();
        const selection = this.deps.getSelectionState();
        const currentState: CanvasState = {
          zoom: viewState.zoom,
          panX: viewState.panX,
          panY: viewState.panY,
          selectedNodeIds: new Set(selection.selectedNodeIds),
          selectedConnectionIds: new Set(selection.selectedConnectionIds)
        };
        const newState = updater(currentState);
        this.deps.viewStateManager.setViewState({
          zoom: newState.zoom,
          panX: newState.panX,
          panY: newState.panY
        });
        // Update selection
        const currentSelection = this.deps.selectionManager.getState();
        const nodesToAdd = Array.from(newState.selectedNodeIds).filter(id => !currentSelection.selectedNodeIds.has(id));
        const nodesToRemove = Array.from(currentSelection.selectedNodeIds).filter(id => !newState.selectedNodeIds.has(id));
        const connsToAdd = Array.from(newState.selectedConnectionIds).filter(id => !currentSelection.selectedConnectionIds.has(id));
        const connsToRemove = Array.from(currentSelection.selectedConnectionIds).filter(id => !newState.selectedConnectionIds.has(id));
        
        // Remove old selections
        for (const nodeId of nodesToRemove) {
          this.deps.selectionManager.deselectNode(nodeId);
        }
        for (const connId of connsToRemove) {
          this.deps.selectionManager.deselectConnection(connId);
        }
        
        // Add new selections
        for (const nodeId of nodesToAdd) {
          this.deps.selectionManager.selectNode(nodeId, true);
        }
        for (const connId of connsToAdd) {
          this.deps.selectionManager.selectConnection(connId, true);
        }
        this.deps.getViewStateInternal(); // Sync to state
        this.deps.getSelectionState(); // Sync to state
      },
      getGraph: () => (this.deps.getGraph != null ? this.deps.getGraph!() : this.deps.graph),
      getNodeSpecs: () => this.deps.nodeSpecs,
      screenToCanvas: (screenX, screenY) => this.deps.screenToCanvas(screenX, screenY),
      canvasToScreen: (canvasX, canvasY) => this.deps.canvasToScreen(canvasX, canvasY),
      requestRender: () => this.deps.requestRender(),
      render: () => this.deps.render(),
      setCursor: (cursor) => { this.deps.canvas.style.cursor = cursor; },
      onNodeMoved: this.deps.onNodeMoved,
      onNodeSelected: this.deps.onNodeSelected,
      onConnectionCreated: (...args) => {
        const fn = this.deps.getOnConnectionCreated?.() ?? this.deps.onConnectionCreated;
        if (fn) fn(...args);
      },
      onParameterChanged: (nodeId, paramName, value) => {
        const fn = this.deps.getOnParameterChanged?.() ?? this.deps.onParameterChanged;
        if (fn) fn(nodeId, paramName, value);
      },
      onParameterInputModeChanged: (nodeId, paramName, mode) => {
        const fn = this.deps.getOnParameterInputModeChanged?.() ?? this.deps.onParameterInputModeChanged;
        if (fn) fn(nodeId, paramName, mode);
      },
      isSpacePressed: () => this.deps.isSpacePressed,
      hitTestNode: (screenX, screenY) => this.deps.hitTestManager.hitTestNode(screenX, screenY),
      getNodeMetrics: (nodeId) => this.deps.nodeMetrics.get(nodeId),
      calculateSmartGuides: (draggingNode, proposedX, proposedY) => this.deps.calculateSmartGuides(draggingNode, proposedX, proposedY),
      invalidateNodeMetrics: (nodeId) => {
        this.deps.nodeMetrics.delete(nodeId);
        this.deps.nodeRenderer.invalidateMetrics(nodeId);
        const component = this.deps.nodeComponents.get(nodeId);
        if (component) {
          component.invalidateMetrics();
        }
      },
      setSmartGuides: (guides) => {
        this.deps.setSmartGuides(guides);
      },
      setDraggedNodeIds: (nodeIds: string[]) => {
        this.deps.setDraggedNodeIds(nodeIds);
      },
      markNodesDirty: (nodeIds) => {
        this.deps.renderState.markNodesDirty(nodeIds);
      },
      markConnectionsDirty: (connectionIds) => {
        this.deps.renderState.markConnectionsDirty(connectionIds);
      },
      markLayerDirty: (layer) => {
        this.deps.renderState.markLayerDirty(layer);
      },
      hitTestPort: (screenX, screenY) => this.deps.hitTestManager.hitTestPort(screenX, screenY),
      hitTestParameter: (screenX, screenY) => this.deps.hitTestManager.hitTestParameter(screenX, screenY),
      hitTestBezierControlPoint: (screenX, screenY) => this.deps.hitTestManager.hitTestBezierControlPoint(screenX, screenY),
      hitTestConnection: (screenX, screenY) => this.deps.hitTestManager.hitTestConnection(screenX, screenY),
      onConnectionSelected: this.deps.onConnectionSelected,
      setConnectionState: (state) => {
        this.deps.connectionStateManager.setState(state);
      },
      setPanState: (state) => {
        this.deps.setPanStateInternal(state);
      },
      getCanvasRect: () => this.deps.canvas.getBoundingClientRect(),
      getActiveTool: () => this.deps.getActiveTool(),
      setSelectionRectangle: (rect) => {
        this.deps.setSelectionRectangleInternal(rect);
        this.deps.renderState.markLayerDirty(RenderLayer.Overlays);
        this.deps.requestRender();
      }
    };
  }
}

/**
 * CanvasLayerSetup - Creates and registers all canvas layers.
 * Extracted from NodeEditorCanvas to reduce its size and separate layer coordination.
 */

import type { NodeGraph, NodeInstance, Connection } from '../../data-model/types';
import type { NodeSpec } from '../../types/nodeSpec';
import type { NodeRenderMetrics } from './NodeRenderer';
import type { RenderState } from './rendering/RenderState';
import { LayerManager } from './rendering/LayerManager';
import {
  ConnectionLayerRenderer,
  ParameterConnectionLayerRenderer,
  NodeLayerRenderer,
  PortLayerRenderer,
  OverlayLayerRenderer
} from './rendering/layers';
import type { IAudioManager } from '../../runtime/types';

export interface CanvasLayerSetupDeps {
  canvas: HTMLCanvasElement;
  graph: NodeGraph;
  /** When provided, used at render time so layers see the current graph after setGraph(). */
  getGraph?: () => NodeGraph;
  nodeSpecs: Map<string, NodeSpec>;
  nodeMetrics: Map<string, NodeRenderMetrics>;
  nodeRenderer: {
    calculateMetrics: (node: NodeInstance, spec: NodeSpec) => NodeRenderMetrics;
  };
  viewStateManager: { getState: () => { panX: number; panY: number; zoom: number } };
  getViewStateInternal: () => { panX: number; panY: number; zoom: number };
  getSelectionState: () => { selectedNodeIds: Set<string>; selectedConnectionIds: Set<string> };
  connectionStateManager: {
    getHoveredPort: () => { nodeId: string; port: string; isOutput: boolean; parameter?: string } | null;
    getIsConnecting: () => boolean;
    getConnectionStartNodeId: () => string | null;
    getConnectionStartPort: () => string | null;
    getConnectionStartParameter: () => string | null;
    renderTemporaryConnection: () => void;
  };
  getDraggedNodeIds: () => string[];
  renderState: RenderState;
  getValidVirtualNodeIds?: () => Set<string>;
  audioManager?: IAudioManager;
  recalculateMetricsForNodes: (nodeIds: string[]) => void;
  getIsDraggingNode: () => boolean;
  getSelectionRectangle: () => { x: number; y: number; width: number; height: number } | null;
  renderSmartGuides: () => void;
  renderSelectionRectangle: () => void;
  getParamPortPositionsFromDOM: () => Map<string, { x: number; y: number }>;
  getHeaderOutputPortPositionsFromDOM: () => Map<string, { x: number; y: number }>;
  /** Resolved after orchestrator is created; used by layers that need isNodeVisible/renderNode at render time. */
  getOrchestrator: () => {
    isNodeVisible: (node: NodeInstance, metrics: NodeRenderMetrics) => boolean;
    isConnectionVisible: (conn: Connection) => boolean;
    renderNode: (node: NodeInstance, skipPorts: boolean) => void;
    renderNodePorts: () => void;
  } | null;
}

export interface CanvasLayerSetupResult {
  layerManager: LayerManager;
  connectionLayerRenderer: ConnectionLayerRenderer;
  parameterConnectionLayerRenderer: ParameterConnectionLayerRenderer;
  overlayLayerRenderer: OverlayLayerRenderer;
}

export function createCanvasLayerSystem(deps: CanvasLayerSetupDeps): CanvasLayerSetupResult {
  const layerManager = new LayerManager();

  const connectionLayerRenderer = new ConnectionLayerRenderer({
    graph: deps.graph,
    getGraph: deps.getGraph ?? (() => deps.graph),
    nodeSpecs: deps.nodeSpecs,
    nodeMetrics: deps.nodeMetrics,
    getSelectedConnectionIds: () => deps.getSelectionState().selectedConnectionIds,
    isConnectionVisible: (conn) => deps.getOrchestrator()?.isConnectionVisible(conn) ?? true,
    isNodeVisible: (node, metrics) => deps.getOrchestrator()?.isNodeVisible(node, metrics) ?? true,
    recalculateMetricsForNodes: (nodeIds) => deps.recalculateMetricsForNodes(nodeIds),
    getDraggedNodeIds: deps.getDraggedNodeIds,
    getPanZoom: () => deps.getViewStateInternal(),
    getViewportDimensions: () => ({ width: deps.canvas.width, height: deps.canvas.height }),
    renderState: deps.renderState
  });
  layerManager.register(connectionLayerRenderer);

  const parameterConnectionLayerRenderer = new ParameterConnectionLayerRenderer({
    graph: deps.graph,
    getGraph: deps.getGraph ?? (() => deps.graph),
    nodeSpecs: deps.nodeSpecs,
    nodeMetrics: deps.nodeMetrics,
    getSelectedConnectionIds: () => deps.getSelectionState().selectedConnectionIds,
    getValidVirtualNodeIds: deps.getValidVirtualNodeIds,
    isConnectionVisible: (conn) => deps.getOrchestrator()?.isConnectionVisible(conn) ?? true,
    isNodeVisible: (node, metrics) => deps.getOrchestrator()?.isNodeVisible(node, metrics) ?? true,
    recalculateMetricsForNodes: (nodeIds) => deps.recalculateMetricsForNodes(nodeIds),
    getDraggedNodeIds: deps.getDraggedNodeIds,
    getPanZoom: () => deps.getViewStateInternal(),
    getViewportDimensions: () => ({ width: deps.canvas.width, height: deps.canvas.height }),
    renderState: deps.renderState,
    getParamPortPositionsFromDOM: deps.getParamPortPositionsFromDOM,
    getHeaderOutputPortPositionsFromDOM: deps.getHeaderOutputPortPositionsFromDOM
  });

  layerManager.register(
    new NodeLayerRenderer({
      graph: deps.graph,
      getGraph: deps.getGraph ?? (() => deps.graph),
      nodeSpecs: deps.nodeSpecs,
      nodeMetrics: deps.nodeMetrics,
      selectedNodeIds: deps.getSelectionState().selectedNodeIds,
      hoveredPort: deps.connectionStateManager.getHoveredPort(),
      isConnecting: deps.connectionStateManager.getIsConnecting(),
      connectionStartNodeId: deps.connectionStateManager.getConnectionStartNodeId(),
      connectionStartPort: deps.connectionStateManager.getConnectionStartPort(),
      connectionStartParameter: deps.connectionStateManager.getConnectionStartParameter(),
      audioManager: deps.audioManager,
      renderNode: (node, skipPorts) => deps.getOrchestrator()?.renderNode(node, skipPorts),
      isNodeVisible: (node, metrics) => deps.getOrchestrator()?.isNodeVisible(node, metrics) ?? true,
      getPanZoom: () => deps.getViewStateInternal(),
      renderState: deps.renderState
    })
  );

  layerManager.register(
    new PortLayerRenderer({
      graph: deps.graph,
      nodeSpecs: deps.nodeSpecs,
      nodeMetrics: deps.nodeMetrics,
      hoveredPort: deps.connectionStateManager.getHoveredPort(),
      isConnecting: deps.connectionStateManager.getIsConnecting(),
      connectionStartNodeId: deps.connectionStateManager.getConnectionStartNodeId(),
      connectionStartPort: deps.connectionStateManager.getConnectionStartPort(),
      connectionStartParameter: deps.connectionStateManager.getConnectionStartParameter(),
      renderNodePorts: () => deps.getOrchestrator()?.renderNodePorts(),
      isNodeVisible: (node, metrics) => deps.getOrchestrator()?.isNodeVisible(node, metrics) ?? true
    })
  );

  const overlayLayerRenderer = new OverlayLayerRenderer({
    getIsConnecting: () => deps.connectionStateManager.getIsConnecting(),
    getIsDraggingNode: deps.getIsDraggingNode,
    getSelectionRectangle: deps.getSelectionRectangle,
    renderTemporaryConnection: () => deps.connectionStateManager.renderTemporaryConnection(),
    renderSmartGuides: deps.renderSmartGuides,
    renderSelectionRectangle: deps.renderSelectionRectangle
  });
  layerManager.register(overlayLayerRenderer);

  return {
    layerManager,
    connectionLayerRenderer,
    parameterConnectionLayerRenderer,
    overlayLayerRenderer
  };
}

/**
 * applyGraphUpdate - Applies a new graph to the canvas and updates all dependent managers.
 * Extracted from NodeEditorCanvas.setGraph to reduce its size.
 */

import type { NodeGraph } from '../../data-model/types';
import { GraphChangeDetector } from '../../utils/changeDetection/GraphChangeDetector';
import type { ConnectionLayerRenderer } from './rendering/layers/ConnectionLayerRenderer';
import type { ParameterConnectionLayerRenderer } from './rendering/layers/ParameterConnectionLayerRenderer';

export interface GraphUpdateContext {
  getGraph: () => NodeGraph;
  setGraph: (graph: NodeGraph) => void;
  connectionLayerRenderer: ConnectionLayerRenderer | null;
  parameterConnectionLayerRenderer: ParameterConnectionLayerRenderer | null;
  viewStateManager: {
    getState: () => { zoom: number; panX: number; panY: number };
    setViewState: (state: { zoom?: number; panX?: number; panY?: number }) => void;
  };
  selectionManager: { selectNodes: (nodeIds: string[], clearFirst: boolean) => void };
  getViewStateInternal: () => void;
  getSelectionState: () => void;
  metricsManager: { updateDependencies: (deps: { graph: NodeGraph }) => void; updateNodeMetrics: () => void };
  hitTestManager: { updateDependencies: (deps: { graph: NodeGraph }) => void };
  overlayManager: { updateDependencies: (deps: { graph: NodeGraph }) => void };
  renderingOrchestrator: { updateDependencies: (deps: { graph: NodeGraph }) => void; requestRender: () => void };
  connectionStateManager: { updateDependencies: (deps: { graph: NodeGraph; nodeMetrics: Map<string, import('./NodeRenderer').NodeRenderMetrics> }) => void };
  renderState: { updateGraph: (graph: NodeGraph) => void; markFullRedraw: () => void };
  nodeMetrics: Map<string, import('./NodeRenderer').NodeRenderMetrics>;
}

export interface ApplyGraphUpdateOptions {
  /** When true, do not apply graph.viewState to the canvas (keeps current pan/zoom/selection). Use for reactive updates (e.g. parameter change) to avoid overwriting view with stale store state. */
  preserveViewState?: boolean;
}

/** Canvas-like source for building GraphUpdateContext. Used by NodeEditorCanvas.setGraph. */
export interface GraphUpdateContextSource {
  getGraph(): NodeGraph;
  setGraphInternal(graph: NodeGraph): void;
  connectionLayerRenderer: GraphUpdateContext['connectionLayerRenderer'];
  parameterConnectionLayerRenderer: GraphUpdateContext['parameterConnectionLayerRenderer'];
  viewStateManager: GraphUpdateContext['viewStateManager'];
  selectionManager: GraphUpdateContext['selectionManager'];
  getViewStateInternal: () => void;
  getSelectionState: () => void;
  metricsManager: GraphUpdateContext['metricsManager'];
  hitTestManager: GraphUpdateContext['hitTestManager'];
  overlayManager: GraphUpdateContext['overlayManager'];
  renderingOrchestrator: GraphUpdateContext['renderingOrchestrator'];
  connectionStateManager: GraphUpdateContext['connectionStateManager'];
  renderState: GraphUpdateContext['renderState'];
  nodeMetrics: GraphUpdateContext['nodeMetrics'];
}

export function buildGraphUpdateContext(from: GraphUpdateContextSource): GraphUpdateContext {
  return {
    getGraph: () => from.getGraph(),
    setGraph: (g) => from.setGraphInternal(g),
    connectionLayerRenderer: from.connectionLayerRenderer,
    parameterConnectionLayerRenderer: from.parameterConnectionLayerRenderer,
    viewStateManager: from.viewStateManager,
    selectionManager: from.selectionManager,
    getViewStateInternal: () => from.getViewStateInternal(),
    getSelectionState: () => from.getSelectionState(),
    metricsManager: from.metricsManager,
    hitTestManager: from.hitTestManager,
    overlayManager: from.overlayManager,
    renderingOrchestrator: from.renderingOrchestrator,
    connectionStateManager: from.connectionStateManager,
    renderState: from.renderState,
    nodeMetrics: from.nodeMetrics
  };
}

export function applyGraphUpdate(
  ctx: GraphUpdateContext,
  graph: NodeGraph,
  options?: ApplyGraphUpdateOptions
): void {
  const changeResult = GraphChangeDetector.detectChanges(ctx.getGraph(), graph, {
    trackAffectedNodes: false,
    includeConnectionIds: true
  });

  for (const connId of changeResult.removedConnectionIds) {
    ctx.connectionLayerRenderer?.invalidateConnection(connId);
    ctx.parameterConnectionLayerRenderer?.invalidateConnection(connId);
  }

  const oldLen = ctx.getGraph()?.connections.length ?? 0;
  if (
    changeResult.isConnectionsChanged &&
    Math.abs(oldLen - graph.connections.length) > 5
  ) {
    ctx.connectionLayerRenderer?.clearCache();
    ctx.parameterConnectionLayerRenderer?.clearCache();
  }

  ctx.setGraph(graph);
  if (!options?.preserveViewState && graph.viewState) {
    const currentViewState = ctx.viewStateManager.getState();
    ctx.viewStateManager.setViewState({
      zoom: Math.max(0.10, graph.viewState.zoom ?? currentViewState.zoom),
      panX: graph.viewState.panX ?? currentViewState.panX,
      panY: graph.viewState.panY ?? currentViewState.panY
    });
    if (graph.viewState.selectedNodeIds) {
      ctx.selectionManager.selectNodes(graph.viewState.selectedNodeIds, true);
    }
    ctx.getViewStateInternal();
    ctx.getSelectionState();
  }
  ctx.metricsManager.updateDependencies({ graph });
  ctx.metricsManager.updateNodeMetrics();
  ctx.hitTestManager.updateDependencies({ graph });
  ctx.overlayManager.updateDependencies({ graph });
  ctx.renderingOrchestrator.updateDependencies({ graph });
  ctx.connectionStateManager.updateDependencies({ graph: graph, nodeMetrics: ctx.nodeMetrics });
  ctx.renderState.updateGraph(graph);
  ctx.renderState.markFullRedraw();
  ctx.renderingOrchestrator.requestRender();
}

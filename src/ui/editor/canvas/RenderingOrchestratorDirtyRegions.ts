/**
 * Viewport and dirty-region helpers for RenderingOrchestrator.
 * Extracted to keep RenderingOrchestrator under ~450 lines.
 */

import type { Connection, NodeInstance } from '../../../data-model/types';
import type { NodeRenderMetrics } from '../NodeRenderer';
import { RenderLayer } from '../rendering/RenderState';
import { getCSSVariableAsNumber } from '../../../utils/cssTokens';
import { isRectVisibleWithMargin, type Viewport } from '../../../utils/viewport';
import type { RenderingOrchestratorDependencies } from './RenderingOrchestrator';

export function getViewport(deps: RenderingOrchestratorDependencies): Viewport {
  const cached = deps.getCachedViewportDimensions();
  const width = cached.width || deps.canvas.getBoundingClientRect().width;
  const height = cached.height || deps.canvas.getBoundingClientRect().height;
  const viewState = deps.getViewStateInternal();
  return {
    x: viewState.panX,
    y: viewState.panY,
    width,
    height,
    zoom: viewState.zoom
  };
}

export function isNodeVisible(
  deps: RenderingOrchestratorDependencies,
  node: NodeInstance,
  metrics: NodeRenderMetrics
): boolean {
  const viewport = getViewport(deps);
  return isRectVisibleWithMargin(
    node.position.x,
    node.position.y,
    metrics.width,
    metrics.height,
    viewport,
    100
  );
}

export function isConnectionVisible(
  deps: RenderingOrchestratorDependencies,
  conn: Connection
): boolean {
  const sourceNode = deps.graph.nodes.find(n => n.id === conn.sourceNodeId);
  const targetNode = deps.graph.nodes.find(n => n.id === conn.targetNodeId);
  if (!sourceNode || !targetNode) return false;
  const sourceMetrics = deps.nodeMetrics.get(sourceNode.id);
  const targetMetrics = deps.nodeMetrics.get(targetNode.id);
  if (!sourceMetrics || !targetMetrics) return true;
  return isNodeVisible(deps, sourceNode, sourceMetrics) || isNodeVisible(deps, targetNode, targetMetrics);
}

export function calculateNodeDirtyRegion(
  deps: RenderingOrchestratorDependencies,
  nodeId: string
): { x: number; y: number; width: number; height: number } | null {
  const node = deps.graph.nodes.find(n => n.id === nodeId);
  if (!node) return null;
  const metrics = deps.nodeMetrics.get(nodeId);
  if (!metrics) return null;
  const canvasX = node.position.x;
  const canvasY = node.position.y;
  const canvasWidth = metrics.width;
  const canvasHeight = metrics.height;
  const rect = deps.canvas.getBoundingClientRect();
  const screenTopLeft = deps.viewStateManager.canvasToScreen(canvasX, canvasY, rect);
  const screenBottomRight = deps.viewStateManager.canvasToScreen(canvasX + canvasWidth, canvasY + canvasHeight, rect);
  const screenX = screenTopLeft.x;
  const screenY = screenTopLeft.y;
  const screenWidth = screenBottomRight.x - screenX;
  const screenHeight = screenBottomRight.y - screenY;
  const hasConnectedParams = deps.graph.connections.some(
    conn => conn.targetNodeId === nodeId && conn.targetParameter
  );
  const padding = hasConnectedParams ? 100 : 50;
  return {
    x: Math.max(0, screenX - padding),
    y: Math.max(0, screenY - padding),
    width: Math.min(deps.canvas.width, screenWidth + padding * 2),
    height: Math.min(deps.canvas.height, screenHeight + padding * 2)
  };
}

export function calculateConnectionDirtyRegion(
  deps: RenderingOrchestratorDependencies,
  connection: Connection
): { x: number; y: number; width: number; height: number } | null {
  const sourceNode = deps.graph.nodes.find(n => n.id === connection.sourceNodeId);
  const targetNode = deps.graph.nodes.find(n => n.id === connection.targetNodeId);
  if (!sourceNode || !targetNode) return null;
  const sourceMetrics = deps.nodeMetrics.get(connection.sourceNodeId);
  const targetMetrics = deps.nodeMetrics.get(connection.targetNodeId);
  if (!sourceMetrics || !targetMetrics) return null;
  let sourcePortPos: { x: number; y: number } | undefined;
  let targetPortPos: { x: number; y: number } | undefined;
  if (connection.targetParameter) {
    sourcePortPos = sourceMetrics.portPositions.get(`output:${connection.sourcePort}`);
    targetPortPos = targetMetrics.parameterInputPortPositions.get(connection.targetParameter);
  } else {
    sourcePortPos = sourceMetrics.portPositions.get(`output:${connection.sourcePort}`);
    targetPortPos = targetMetrics.portPositions.get(`input:${connection.targetPort}`);
  }
  if (!sourcePortPos || !targetPortPos) return null;
  const sourceX = sourcePortPos.x;
  const sourceY = sourcePortPos.y;
  const targetX = targetPortPos.x;
  const targetY = targetPortPos.y;
  const cp1X = sourceX + 100;
  const cp1Y = sourceY;
  const cp2X = targetX - 100;
  const cp2Y = targetY;
  const rect = deps.canvas.getBoundingClientRect();
  const sourceScreen = deps.viewStateManager.canvasToScreen(sourceX, sourceY, rect);
  const targetScreen = deps.viewStateManager.canvasToScreen(targetX, targetY, rect);
  const cp1Screen = deps.viewStateManager.canvasToScreen(cp1X, cp1Y, rect);
  const cp2Screen = deps.viewStateManager.canvasToScreen(cp2X, cp2Y, rect);
  const minX = Math.min(sourceScreen.x, targetScreen.x, cp1Screen.x, cp2Screen.x);
  const maxX = Math.max(sourceScreen.x, targetScreen.x, cp1Screen.x, cp2Screen.x);
  const minY = Math.min(sourceScreen.y, targetScreen.y, cp1Screen.y, cp2Screen.y);
  const maxY = Math.max(sourceScreen.y, targetScreen.y, cp1Screen.y, cp2Screen.y);
  const maxLineWidth = getCSSVariableAsNumber('connection-width-selected', 3);
  const padding = Math.max(50, maxLineWidth * 2);
  return {
    x: Math.max(0, minX - padding),
    y: Math.max(0, minY - padding),
    width: Math.min(deps.canvas.width, maxX - minX + padding * 2),
    height: Math.min(deps.canvas.height, maxY - minY + padding * 2)
  };
}

export function recalculateMetricsForDirtyNodes(deps: RenderingOrchestratorDependencies): void {
  const dirtyNodes = deps.renderState.getDirtyNodes();
  for (const nodeId of dirtyNodes) {
    const node = deps.graph.nodes.find(n => n.id === nodeId);
    if (!node) continue;
    const spec = deps.nodeSpecs.get(node.type);
    if (!spec) continue;
    const oldMetrics = deps.nodeMetrics.get(nodeId);
    if (oldMetrics) {
      deps.nodeRenderer.clearNodeCache(node, spec, oldMetrics);
    }
    const metrics = deps.nodeRenderer.calculateMetrics(node, spec);
    deps.nodeMetrics.set(nodeId, metrics);
  }
}

export function updateDirtyRegions(deps: RenderingOrchestratorDependencies): void {
  const dirtyNodes = deps.renderState.getDirtyNodes();
  const dirtyConnections = deps.renderState.getDirtyConnections();
  for (const nodeId of dirtyNodes) {
    const hasParamConnections = deps.graph.connections.some(
      conn => conn.targetNodeId === nodeId && conn.targetParameter
    );
    if (hasParamConnections) {
      deps.renderState.markLayerDirty(RenderLayer.ParameterConnections);
    }
  }
  for (const nodeId of dirtyNodes) {
    const region = calculateNodeDirtyRegion(deps, nodeId);
    if (region) {
      const maxRegionSize = Math.max(deps.canvas.width, deps.canvas.height) * 2;
      if (region.width <= maxRegionSize && region.height <= maxRegionSize) {
        deps.renderState.addDirtyRegion(region);
      } else {
        deps.renderState.markFullRedraw();
        return;
      }
    }
  }
  for (const connId of dirtyConnections) {
    const connection = deps.graph.connections.find(c => c.id === connId);
    if (connection) {
      const region = calculateConnectionDirtyRegion(deps, connection);
      if (region) {
        const maxRegionSize = Math.max(deps.canvas.width, deps.canvas.height) * 2;
        if (region.width <= maxRegionSize && region.height <= maxRegionSize) {
          deps.renderState.addDirtyRegion(region);
        } else {
          deps.renderState.markFullRedraw();
          return;
        }
      }
    }
  }
}

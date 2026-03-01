/**
 * ViewFitter - Fit-to-view and set-zoom logic for the canvas.
 * Extracted from NodeEditorCanvas to reduce its size.
 */

import type { NodeGraph } from '../../data-model/types';
import type { NodeRenderMetrics } from './NodeRenderer';

export interface ViewFitterDeps {
  canvas: HTMLCanvasElement;
  graph: NodeGraph;
  nodeMetrics: Map<string, NodeRenderMetrics>;
  viewStateManager: { setViewState: (state: { zoom: number; panX: number; panY: number }) => void };
  screenToCanvas: (screenX: number, screenY: number) => { x: number; y: number };
  getViewState: () => void;
  renderState: { markFullRedraw: () => void };
  requestRender: () => void;
}

const MIN_ZOOM = 0.10;
const MAX_ZOOM = 1.0;

export function fitToView(deps: ViewFitterDeps): void {
  if (deps.graph.nodes.length === 0) return;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of deps.graph.nodes) {
    const metrics = deps.nodeMetrics.get(node.id);
    if (!metrics) continue;
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + metrics.width);
    maxY = Math.max(maxY, node.position.y + metrics.height);
  }

  if (minX === Infinity || minY === Infinity) return;

  const padding = 0.2;
  const contentWidth = maxX - minX;
  const contentHeight = maxY - minY;
  const paddedWidth = contentWidth * (1 + padding * 2);
  const paddedHeight = contentHeight * (1 + padding * 2);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const rect = deps.canvas.getBoundingClientRect();
  const zoomX = rect.width / paddedWidth;
  const zoomY = rect.height / paddedHeight;
  const zoom = Math.max(MIN_ZOOM, Math.min(zoomX, zoomY));
  const panX = rect.width / 2 - centerX * zoom;
  const panY = rect.height / 2 - centerY * zoom;

  deps.viewStateManager.setViewState({ zoom, panX, panY });
  deps.getViewState();
  deps.renderState.markFullRedraw();
  deps.requestRender();
}

export function setZoom(
  deps: ViewFitterDeps,
  zoom: number,
  centerX?: number,
  centerY?: number
): void {
  const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
  const rect = deps.canvas.getBoundingClientRect();
  const screenX = centerX ?? rect.width / 2;
  const screenY = centerY ?? rect.height / 2;
  const canvasPos = deps.screenToCanvas(screenX, screenY);
  const newPanX = screenX - canvasPos.x * newZoom;
  const newPanY = screenY - canvasPos.y * newZoom;

  deps.viewStateManager.setViewState({ zoom: newZoom, panX: newPanX, panY: newPanY });
  deps.getViewState();
  deps.renderState.markFullRedraw();
  deps.requestRender();
}

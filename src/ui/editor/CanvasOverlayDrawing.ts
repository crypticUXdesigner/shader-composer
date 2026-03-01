/**
 * CanvasOverlayDrawing - Renders selection rectangle and smart guides to a 2D context.
 * Extracted from NodeEditorCanvas to reduce its size.
 */

import { getCSSColor } from '../../utils/cssTokens';

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SmartGuides {
  vertical: Array<{ x: number; startY: number; endY: number }>;
  horizontal: Array<{ y: number; startX: number; endX: number }>;
}

export function renderSelectionRectangle(
  ctx: CanvasRenderingContext2D,
  rect: SelectionRect | null,
  getViewState: () => { zoom: number }
): void {
  if (!rect) return;
  const { x, y, width, height } = rect;
  const fillColor = getCSSColor('selection-rectangle-fill', 'rgba(100, 150, 255, 0.1)');
  const strokeColor = getCSSColor('selection-rectangle-stroke', getCSSColor('color-blue-60', '#4a9eff'));
  ctx.fillStyle = fillColor;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = strokeColor;
  const viewState = getViewState();
  ctx.lineWidth = 1 / viewState.zoom;
  ctx.setLineDash([4 / viewState.zoom, 4 / viewState.zoom]);
  ctx.strokeRect(x, y, width, height);
  ctx.setLineDash([]);
}

export function renderSmartGuides(
  ctx: CanvasRenderingContext2D,
  guides: SmartGuides,
  viewState: { panX: number; panY: number; zoom: number },
  canvasRect: DOMRect,
  renderGuides: (
    ctx: CanvasRenderingContext2D,
    guides: SmartGuides,
    viewState: { panX: number; panY: number; zoom: number },
    rect: DOMRect
  ) => void
): void {
  if (guides.vertical.length === 0 && guides.horizontal.length === 0) return;
  renderGuides(ctx, guides, viewState, canvasRect);
}

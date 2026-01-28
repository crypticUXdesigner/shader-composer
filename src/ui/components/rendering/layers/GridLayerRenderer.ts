/**
 * GridLayerRenderer - Renders the canvas grid
 */

import type { LayerRenderer } from '../LayerRenderer';
import { RenderLayer } from '../RenderState';
import type { RenderState } from '../RenderState';
import { getCSSColor, getCSSVariableAsNumber } from '../../../../utils/cssTokens';

export interface GridLayerContext {
  canvas: HTMLCanvasElement;
  getState: () => {
    panX: number;
    panY: number;
    zoom: number;
  };
}

export class GridLayerRenderer implements LayerRenderer {
  layer = RenderLayer.Grid;
  private context: GridLayerContext;
  
  constructor(context: GridLayerContext) {
    this.context = context;
  }
  
  shouldRender(_state: RenderState): boolean {
    // Grid always renders (position changes with pan/zoom)
    // Always render to match old behavior - grid should always be visible
    return true;
  }
  
  render(ctx: CanvasRenderingContext2D, _state: RenderState): void {
    const state = this.context.getState();
    const gridSize = getCSSVariableAsNumber('canvas-grid-size', 50);
    const gridColor = getCSSColor('canvas-grid-color', getCSSColor('color-gray-50', '#111317'));
    const dotRadius = getCSSVariableAsNumber('canvas-grid-dot-radius', 1.5);

    ctx.fillStyle = gridColor;

    const rect = this.context.canvas.getBoundingClientRect();
    const startX = Math.floor((-state.panX) / (state.zoom * gridSize)) * gridSize;
    const startY = Math.floor((-state.panY) / (state.zoom * gridSize)) * gridSize;
    const endX = startX + rect.width / state.zoom + gridSize;
    const endY = startY + rect.height / state.zoom + gridSize;

    ctx.beginPath();
    for (let x = startX; x < endX; x += gridSize) {
      for (let y = startY; y < endY; y += gridSize) {
        ctx.moveTo(x + dotRadius, y);
        ctx.arc(x, y, dotRadius / state.zoom, 0, Math.PI * 2);
      }
    }
    ctx.fill();
  }
}

/**
 * LayerRenderer - Interface for rendering a specific layer
 * 
 * Each layer renderer is responsible for rendering one layer of the canvas.
 * Layers are rendered in order (Background -> Grid -> Connections -> Nodes -> Ports -> Overlays)
 */

import type { RenderState, RenderLayer } from './RenderState';

export interface LayerRenderer {
  /**
   * The layer this renderer handles
   */
  layer: RenderLayer;
  
  /**
   * Render the layer
   * @param ctx Canvas rendering context
   * @param state Current render state
   */
  render(ctx: CanvasRenderingContext2D, state: RenderState): void;
  
  /**
   * Check if this layer should be rendered
   * @param state Current render state
   * @returns true if layer should be rendered
   */
  shouldRender(state: RenderState): boolean;
}

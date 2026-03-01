/**
 * LayerManager - Manages and orchestrates layer rendering
 * 
 * Registers layer renderers and renders them in the correct order.
 */

import type { LayerRenderer } from './LayerRenderer';
import { RenderLayer } from './RenderState';
import type { RenderState } from './RenderState';

export class LayerManager {
  private layers: Map<RenderLayer, LayerRenderer> = new Map();
  
  /**
   * Register a layer renderer
   */
  register(renderer: LayerRenderer): void {
    this.layers.set(renderer.layer, renderer);
  }
  
  /**
   * Unregister a layer renderer
   */
  unregister(layer: RenderLayer): void {
    this.layers.delete(layer);
  }
  
  /**
   * Get a layer renderer
   */
  getLayer(layer: RenderLayer): LayerRenderer | undefined {
    return this.layers.get(layer);
  }
  
  /**
   * Render all layers in order
   */
  render(ctx: CanvasRenderingContext2D, state: RenderState): void {
    // Render layers in order (sorted by enum value)
    const sortedLayers = Array.from(this.layers.keys()).sort((a, b) => a - b);
    
    for (const layer of sortedLayers) {
      const renderer = this.layers.get(layer);
      if (renderer && renderer.shouldRender(state)) {
        renderer.render(ctx, state);
      }
    }
  }
  
  /**
   * Check if a layer is registered
   */
  hasLayer(layer: RenderLayer): boolean {
    return this.layers.has(layer);
  }
  
  /**
   * Get all registered layers
   */
  getRegisteredLayers(): RenderLayer[] {
    return Array.from(this.layers.keys());
  }
}

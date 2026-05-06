/**
 * OverlayLayerRenderer - Renders overlays (temporary connections, selection rectangle, etc.)
 */

import type { LayerRenderer } from '../LayerRenderer';
import { RenderLayer } from '../RenderState';
import type { RenderState } from '../RenderState';

export interface OverlayLayerContext {
  getIsConnecting: () => boolean;
  getIsDraggingNode: () => boolean;
  getSelectionRectangle: () => { x: number; y: number; width: number; height: number } | null;
  renderTemporaryConnection: () => void;
  renderSelectionRectangle: () => void;
}

export class OverlayLayerRenderer implements LayerRenderer {
  layer = RenderLayer.Overlays;
  private context: OverlayLayerContext;
  
  constructor(context: OverlayLayerContext) {
    this.context = context;
  }
  
  shouldRender(state: RenderState): boolean {
    return (this.context.getIsConnecting() || 
            this.context.getIsDraggingNode() || 
            this.context.getSelectionRectangle() !== null) || 
           state.isLayerDirty(this.layer) || 
           state.needsFullRedraw();
  }
  
  render(_ctx: CanvasRenderingContext2D, _state: RenderState): void {
    if (this.context.getIsConnecting()) {
      this.context.renderTemporaryConnection();
    }
    
    if (this.context.getSelectionRectangle() !== null) {
      this.context.renderSelectionRectangle();
    }
  }
}

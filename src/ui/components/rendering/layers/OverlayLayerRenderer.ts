/**
 * OverlayLayerRenderer - Renders overlays (temporary connections, smart guides, etc.)
 */

import type { LayerRenderer } from '../LayerRenderer';
import { RenderLayer } from '../RenderState';
import type { RenderState } from '../RenderState';

export interface OverlayLayerContext {
  getIsConnecting: () => boolean;
  getIsDraggingNode: () => boolean;
  getSelectionRectangle: () => { x: number; y: number; width: number; height: number } | null;
  renderTemporaryConnection: () => void;
  renderSmartGuides: () => void;
  renderSelectionRectangle: () => void;
}

export class OverlayLayerRenderer implements LayerRenderer {
  layer = RenderLayer.Overlays;
  private context: OverlayLayerContext;
  
  constructor(context: OverlayLayerContext) {
    this.context = context;
  }
  
  shouldRender(state: RenderState): boolean {
    // Overlays render when connecting, dragging, or selecting
    return (this.context.getIsConnecting() || 
            this.context.getIsDraggingNode() || 
            this.context.getSelectionRectangle() !== null) || 
           state.isLayerDirty(this.layer) || 
           state.needsFullRedraw();
  }
  
  render(_ctx: CanvasRenderingContext2D, _state: RenderState): void {
    // Render temporary connection line (if connecting)
    if (this.context.getIsConnecting()) {
      this.context.renderTemporaryConnection();
    }
    
    // Render smart guides (if dragging node)
    if (this.context.getIsDraggingNode()) {
      this.context.renderSmartGuides();
    }
    
    // Render selection rectangle (if selecting)
    if (this.context.getSelectionRectangle() !== null) {
      this.context.renderSelectionRectangle();
    }
  }
}

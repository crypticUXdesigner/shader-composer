/**
 * Canvas Zoom Handler
 * 
 * Handles canvas zooming via mouse wheel with throttling for performance.
 * 
 * Performance optimization: Throttles wheel events to display refresh rate to prevent FPS drops.
 * This prevents browser freezing during rapid zooming by:
 * 1. Accumulating wheel deltas in handle() (called at wheel event rate, ~10-20+ events/sec)
 * 2. Applying zoom updates via requestAnimationFrame (called at display refresh rate, ~60fps)
 * 3. Applying proportional zoom based on accumulated delta magnitude for responsive feel
 * 
 * Same throttling pattern as CanvasPanHandler for consistency.
 */

import { InteractionType } from '../InteractionTypes';
import type { InteractionEvent, InteractionHandler } from '../InteractionHandler';
import type { HandlerContext } from '../HandlerContext';

interface PendingZoom {
  deltaY: number;
  mouseX: number;
  mouseY: number;
}

export class CanvasZoomHandler implements InteractionHandler {
  priority = 20; // Higher priority - zoom is specific interaction
  
  // Throttling: accumulate wheel events and apply them via requestAnimationFrame
  private pendingZoom: PendingZoom | null = null;
  private zoomAnimationFrame: number | null = null;
  
  constructor(private context: HandlerContext) {}
  
  canHandle(event: InteractionEvent): boolean {
    return event.type === InteractionType.CanvasZoom && event.deltaY !== undefined;
  }
  
  handle(event: InteractionEvent): void {
    if (event.deltaY === undefined) return;
    
    // Accumulate wheel deltas - store the latest mouse position and sum deltas
    if (this.pendingZoom) {
      // Accumulate deltaY (sum for smoother zoom)
      this.pendingZoom.deltaY += event.deltaY;
      // Update to latest mouse position
      this.pendingZoom.mouseX = event.screenPosition.x;
      this.pendingZoom.mouseY = event.screenPosition.y;
    } else {
      // First wheel event in this batch
      this.pendingZoom = {
        deltaY: event.deltaY,
        mouseX: event.screenPosition.x,
        mouseY: event.screenPosition.y
      };
    }
    
    // Schedule zoom update via requestAnimationFrame (throttles to display refresh rate)
    if (this.zoomAnimationFrame === null) {
      this.zoomAnimationFrame = requestAnimationFrame(() => {
        this.applyZoom();
        this.zoomAnimationFrame = null;
      });
    }
  }
  
  private applyZoom(): void {
    if (!this.pendingZoom) return;
    
    const { deltaY, mouseX, mouseY } = this.pendingZoom;
    this.pendingZoom = null; // Clear pending zoom
    
    const state = this.context.getState();
    
    // Get canvas bounding rect to convert screen coordinates to canvas-relative coordinates
    // This is critical when the side panel is open, as the canvas is offset
    const rect = this.context.getCanvasRect?.();
    if (!rect) {
      // Fallback: if getCanvasRect is not available, we can't properly handle zoom
      // This shouldn't happen in normal operation, but handle gracefully
      return;
    }
    
    // Convert screen coordinates to canvas-relative coordinates
    // panX and panY are stored as canvas-relative, not screen coordinates
    const canvasRelativeX = mouseX - rect.left;
    const canvasRelativeY = mouseY - rect.top;
    
    // Get mouse position in canvas coordinates before zoom
    const canvasPos = this.context.screenToCanvas(mouseX, mouseY);
    
    // Calculate zoom factor (scroll down = zoom out, scroll up = zoom in)
    // Apply proportional zoom based on accumulated delta magnitude
    // This makes fast scrolling feel more responsive while still throttling to display refresh rate
    // Normalize deltaY: typical wheel event is ~100, so we scale proportionally
    const normalizedDelta = Math.abs(deltaY) / 100;
    const baseZoomFactor = deltaY > 0 ? 0.9 : 1.1;
    
    // Apply zoom factor using exponential scaling for efficiency
    // This ensures fast scrolling zooms proportionally faster without loops
    const zoomFactor = Math.pow(baseZoomFactor, normalizedDelta);
    const newZoom = Math.max(0.10, Math.min(1.0, state.zoom * zoomFactor));
    
    // Calculate new pan to keep mouse position fixed in canvas space
    // Use canvas-relative coordinates, not screen coordinates
    const newPanX = canvasRelativeX - canvasPos.x * newZoom;
    const newPanY = canvasRelativeY - canvasPos.y * newZoom;
    
    // Update state
    this.context.setState((prevState) => ({
      ...prevState,
      zoom: newZoom,
      panX: newPanX,
      panY: newPanY
    }));
    
    // Zooming changes viewport - everything needs to be redrawn
    this.context.requestRender();
  }
}

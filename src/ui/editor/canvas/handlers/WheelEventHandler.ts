/**
 * WheelEventHandler
 * 
 * Handles wheel events for zooming the node editor canvas.
 * Extracted from NodeEditorCanvas to improve separation of concerns.
 */

import type { HandlerContext } from '../../../interactions/HandlerContext';
import type { InteractionManager } from '../../../interactions/InteractionManager';
import { InteractionType } from '../../../interactions/InteractionTypes';
import type { InteractionEvent, InteractionEventTarget } from '../../../interactions/InteractionHandler';
import type { ViewStateManager } from '../ViewStateManager';
import type { RenderState } from '../../rendering/RenderState';

export interface WheelEventHandlerDependencies {
  handlerContext: HandlerContext;
  interactionManager: InteractionManager | null;
  viewStateManager: ViewStateManager;
  renderState: RenderState;
  canvas: HTMLCanvasElement;
  createInteractionEvent: (type: InteractionType, e: WheelEvent, target?: InteractionEventTarget) => InteractionEvent;
  getViewStateInternal: () => { panX: number; panY: number; zoom: number };
}

export class WheelEventHandler {
  private deps: WheelEventHandlerDependencies;
  
  constructor(dependencies: WheelEventHandlerDependencies) {
    this.deps = dependencies;
  }
  
  /**
   * Handle wheel event for zooming
   */
  handleWheel(e: WheelEvent): void {
    e.preventDefault();
    
    // Try new interaction handler system first (Phase 2.4)
    if (this.deps.interactionManager) {
      const event = this.deps.createInteractionEvent(InteractionType.CanvasZoom, e);
      if (this.deps.interactionManager.handle(event)) {
        return; // Event handled by handler
      }
    }
    
    // Fallback to old implementation
    const rect = this.deps.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Zoom at mouse position
    const viewState = this.deps.getViewStateInternal();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    this.deps.viewStateManager.setZoomAtPoint(
      viewState.zoom * zoomFactor,
      mouseX,
      mouseY,
      (x, y) => this.deps.viewStateManager.screenToCanvas(x, y, rect)
    );
    this.deps.getViewStateInternal(); // Sync to state
    // Zoom changes viewport - everything needs to be redrawn
    this.deps.renderState.markFullRedraw();
    this.deps.handlerContext.requestRender();
  }
}

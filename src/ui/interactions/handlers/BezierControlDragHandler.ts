/**
 * Bezier Control Drag Handler
 * 
 * Handles bezier control point dragging:
 * - Click and drag on bezier control points to adjust curve
 * - Updates x1, y1, x2, y2 parameters together
 * - Throttles parameter updates for smooth performance (Phase 3.4)
 */

import { InteractionType } from '../InteractionTypes';
import type { InteractionEvent, InteractionHandler } from '../InteractionHandler';
import type { HandlerContext } from '../HandlerContext';
import { getCSSVariableAsNumber } from '../../../utils/cssTokens';
import { Throttler } from '../../../utils/Throttler';

export class BezierControlDragHandler implements InteractionHandler {
  priority = 35; // High priority - bezier control dragging is specific interaction
  
  private isDraggingBezierControl: boolean = false;
  private draggingBezierNodeId: string | null = null;
  private draggingBezierControlIndex: number | null = null;
  private dragBezierStartValues: { x1: number; y1: number; x2: number; y2: number } | null = null;
  
  // Phase 3.4: Throttle parameter updates for smooth performance
  private bezierThrottler: Throttler;
  
  constructor(private context: HandlerContext) {
    // Throttle at ~60fps (16ms) for smooth updates
    this.bezierThrottler = new Throttler(16);
  }
  
  canHandle(event: InteractionEvent): boolean {
    // If we're currently dragging a bezier control, we can handle end events
    if (this.isDraggingBezierControl) {
      return true;
    }
    
    if (event.type === InteractionType.BezierControlDrag) {
      return true;
    }
    
    // Check if spacebar is pressed - if so, don't handle (let pan handler take it)
    if (this.context.isSpacePressed?.()) {
      return false;
    }
    
    // Check if clicking on a bezier control point
    const bezierHit = this.context.hitTestBezierControlPoint?.(event.screenPosition.x, event.screenPosition.y);
    if (bezierHit) {
      return true;
    }
    
    return false;
  }
  
  onStart(event: InteractionEvent): void {
    const bezierHit = this.context.hitTestBezierControlPoint?.(event.screenPosition.x, event.screenPosition.y);
    if (!bezierHit) return;
    
    const graph = this.context.getGraph();
    const node = graph.nodes.find(n => n.id === bezierHit.nodeId);
    const nodeSpecs = this.context.getNodeSpecs();
    const spec = nodeSpecs.get(node?.type || '');
    
    if (!node || !spec) return;
    
    this.isDraggingBezierControl = true;
    this.draggingBezierNodeId = bezierHit.nodeId;
    this.draggingBezierControlIndex = bezierHit.controlIndex;
    
    // Store initial parameter values
    const x1 = (node.parameters.x1 ?? spec.parameters.x1?.default ?? 0) as number;
    const y1 = (node.parameters.y1 ?? spec.parameters.y1?.default ?? 0) as number;
    const x2 = (node.parameters.x2 ?? spec.parameters.x2?.default ?? 1) as number;
    const y2 = (node.parameters.y2 ?? spec.parameters.y2?.default ?? 1) as number;
    this.dragBezierStartValues = { x1, y1, x2, y2 };
    
    this.context.setCursor('move');
  }
  
  onUpdate(event: InteractionEvent): void {
    if (!this.isDraggingBezierControl || 
        this.draggingBezierNodeId === null || 
        this.draggingBezierControlIndex === null || 
        !this.dragBezierStartValues) {
      return;
    }
    
    const graph = this.context.getGraph();
    const node = graph.nodes.find(n => n.id === this.draggingBezierNodeId);
    const nodeSpecs = this.context.getNodeSpecs();
    const spec = nodeSpecs.get(node?.type || '');
    const metrics = this.context.getNodeMetrics?.(this.draggingBezierNodeId);
    
    if (!node || !spec || !metrics) return;
    
    // Get bezier editor position
    const x1Pos = metrics.parameterGridPositions.get('x1');
    if (!x1Pos) return;
    
    const bezierEditorX = x1Pos.cellX;
    const bezierEditorY = x1Pos.cellY;
    const bezierEditorWidth = x1Pos.cellWidth;
    const bezierEditorHeight = x1Pos.cellHeight;
    const bezierEditorPadding = getCSSVariableAsNumber('bezier-editor-padding', 12);
    
    // Calculate drawing area
    const drawX = bezierEditorX + bezierEditorPadding;
    const drawY = bezierEditorY + bezierEditorPadding;
    const drawWidth = bezierEditorWidth - bezierEditorPadding * 2;
    const drawHeight = bezierEditorHeight - bezierEditorPadding * 2;
    
    // Convert mouse position to canvas coordinates
    const canvasPos = this.context.screenToCanvas(event.screenPosition.x, event.screenPosition.y);
    
    // Calculate new control point position (clamped to editor bounds)
    let newX = (canvasPos.x - drawX) / drawWidth;
    let newY = 1 - (canvasPos.y - drawY) / drawHeight; // Flip Y for parameter space
    
    // Clamp to [0, 1]
    newX = Math.max(0, Math.min(1, newX));
    newY = Math.max(0, Math.min(1, newY));
    
    // Update the appropriate parameters based on control index
    if (this.draggingBezierControlIndex === 0) {
      // Control point 1 (x1, y1)
      node.parameters.x1 = newX;
      node.parameters.y1 = newY;
      
      // Throttle callback and render requests (Phase 3.4)
      // Throttle parameter updates
      this.bezierThrottler.schedule(`${this.draggingBezierNodeId}:x1`, newX, () => {
        this.context.onParameterChanged?.(this.draggingBezierNodeId!, 'x1', newX);
      });
      this.bezierThrottler.schedule(`${this.draggingBezierNodeId}:y1`, newY, () => {
        this.context.onParameterChanged?.(this.draggingBezierNodeId!, 'y1', newY);
      });
      this.context.requestRender();
    } else if (this.draggingBezierControlIndex === 1) {
      // Control point 2 (x2, y2)
      node.parameters.x2 = newX;
      node.parameters.y2 = newY;
      
      // Throttle callback and render requests (Phase 3.4)
      // Throttle parameter updates
      this.bezierThrottler.schedule(`${this.draggingBezierNodeId}:x2`, newX, () => {
        this.context.onParameterChanged?.(this.draggingBezierNodeId!, 'x2', newX);
      });
      this.bezierThrottler.schedule(`${this.draggingBezierNodeId}:y2`, newY, () => {
        this.context.onParameterChanged?.(this.draggingBezierNodeId!, 'y2', newY);
      });
      this.context.requestRender();
    }
  }
  
  onEnd(_event: InteractionEvent): void {
    // Flush any pending throttled updates before ending drag
    if (this.bezierThrottler.hasPending()) {
      // Force flush to ensure final values are applied
      this.bezierThrottler.flush();
    }
    
    // Clean up drag state
    this.isDraggingBezierControl = false;
    this.draggingBezierNodeId = null;
    this.draggingBezierControlIndex = null;
    this.dragBezierStartValues = null;
    
    this.context.setCursor('default');
  }
  
  handle(_event: InteractionEvent): void {
    // This method is called for immediate handling
    // For bezier control dragging, we use onStart/onUpdate/onEnd lifecycle
    // This is a no-op as dragging is handled through lifecycle methods
  }
}

/**
 * Selection Tool Handler
 * 
 * Handles rectangle selection when the selection tool is active.
 * Selects nodes that intersect with the selection rectangle.
 */

import type { InteractionEvent, InteractionHandler } from '../InteractionHandler';
import type { HandlerContext } from '../HandlerContext';

export class SelectionToolHandler implements InteractionHandler {
  priority = 25; // Higher than CanvasPanHandler but lower than node-specific interactions
  
  private isSelecting: boolean = false;
  private selectionStartX: number = 0;
  private selectionStartY: number = 0;
  private selectionCurrentX: number = 0;
  private selectionCurrentY: number = 0;
  
  constructor(private context: HandlerContext) {}
  
  canHandle(event: InteractionEvent): boolean {
    // Only handle if selection tool is active
    const activeTool = this.context.getActiveTool?.();
    if (activeTool !== 'select') {
      return false;
    }
    
    // If we're currently selecting, continue handling
    if (this.isSelecting) {
      return true;
    }
    
    // Can handle left mouse button clicks
    if (event.button === 0) {
      return true;
    }
    
    return false;
  }
  
  onStart(event: InteractionEvent): void {
    const canvasPos = this.context.screenToCanvas(event.screenPosition.x, event.screenPosition.y);
    
    this.isSelecting = true;
    this.selectionStartX = canvasPos.x;
    this.selectionStartY = canvasPos.y;
    this.selectionCurrentX = canvasPos.x;
    this.selectionCurrentY = canvasPos.y;
    
    // Clear previous selection if not holding shift
    if (!event.modifiers.shift) {
      const state = this.context.getState();
      const newState = { ...state };
      newState.selectedNodeIds.clear();
      // Mark connections as dirty before clearing so they re-render correctly
      if (newState.selectedConnectionIds.size > 0) {
        const previouslySelected = Array.from(newState.selectedConnectionIds);
        this.context.markConnectionsDirty?.(previouslySelected);
      }
      newState.selectedConnectionIds.clear();
      this.context.setState(() => newState);
      this.context.onNodeSelected?.(null, false);
    }
    
    // Update selection rectangle
    this.updateSelectionRectangle();
    
    this.context.setCursor('crosshair');
  }
  
  onUpdate(event: InteractionEvent): void {
    if (!this.isSelecting) return;
    
    const canvasPos = this.context.screenToCanvas(event.screenPosition.x, event.screenPosition.y);
    this.selectionCurrentX = canvasPos.x;
    this.selectionCurrentY = canvasPos.y;
    
    // Update selection rectangle
    this.updateSelectionRectangle();
    
    // Update node selection based on rectangle
    this.updateNodeSelection();
  }
  
  onEnd(_event: InteractionEvent): void {
    if (!this.isSelecting) return;
    
    // Final selection update
    this.updateNodeSelection();
    
    this.isSelecting = false;
    
    // Clear selection rectangle
    this.context.setSelectionRectangle?.(null);
    
    this.context.setCursor('default');
    this.context.requestRender();
  }
  
  handle(_event: InteractionEvent): void {
    // This method is called for immediate handling
    // For selection, we use onStart/onUpdate/onEnd lifecycle
  }
  
  /**
   * Update the selection rectangle visual
   */
  private updateSelectionRectangle(): void {
    const x = Math.min(this.selectionStartX, this.selectionCurrentX);
    const y = Math.min(this.selectionStartY, this.selectionCurrentY);
    const width = Math.abs(this.selectionCurrentX - this.selectionStartX);
    const height = Math.abs(this.selectionCurrentY - this.selectionStartY);
    
    this.context.setSelectionRectangle?.({
      x,
      y,
      width,
      height
    });
    
    this.context.requestRender();
  }
  
  /**
   * Update node selection based on current rectangle
   */
  private updateNodeSelection(): void {
    const x = Math.min(this.selectionStartX, this.selectionCurrentX);
    const y = Math.min(this.selectionStartY, this.selectionCurrentY);
    const width = Math.abs(this.selectionCurrentX - this.selectionStartX);
    const height = Math.abs(this.selectionCurrentY - this.selectionStartY);
    
    // Skip if rectangle is too small
    if (width < 1 || height < 1) {
      return;
    }
    
    const graph = this.context.getGraph();
    const state = this.context.getState();
    const newState = { ...state };
    
    // Get all nodes that intersect with the selection rectangle
    const selectedNodeIds = new Set<string>(newState.selectedNodeIds);
    
    for (const node of graph.nodes) {
      const metrics = this.context.getNodeMetrics?.(node.id);
      if (!metrics) continue;
      
      // Check if node intersects with selection rectangle
      const nodeLeft = node.position.x;
      const nodeTop = node.position.y;
      const nodeRight = nodeLeft + metrics.width;
      const nodeBottom = nodeTop + metrics.height;
      
      const rectRight = x + width;
      const rectBottom = y + height;
      
      // Check for intersection
      const intersects = !(
        nodeRight < x ||
        nodeLeft > rectRight ||
        nodeBottom < y ||
        nodeTop > rectBottom
      );
      
      if (intersects) {
        selectedNodeIds.add(node.id);
      } else if (!state.selectedNodeIds.has(node.id)) {
        // Only remove if it wasn't previously selected (to support shift+drag)
        // If shift is held, we keep previously selected nodes
        // If shift is not held, we clear selection on start, so this is fine
      }
    }
    
    // Track which nodes changed selection state
    const nodesToMarkDirty: string[] = [];
    
    // Mark nodes that were previously selected but are no longer selected
    for (const nodeId of state.selectedNodeIds) {
      if (!selectedNodeIds.has(nodeId)) {
        nodesToMarkDirty.push(nodeId);
      }
    }
    
    // Mark nodes that are newly selected
    for (const nodeId of selectedNodeIds) {
      if (!state.selectedNodeIds.has(nodeId)) {
        nodesToMarkDirty.push(nodeId);
      }
    }
    
    newState.selectedNodeIds = selectedNodeIds;
    this.context.setState(() => newState);
    
    // Mark affected nodes as dirty so they re-render with new selection state
    if (nodesToMarkDirty.length > 0) {
      this.context.markNodesDirty?.(nodesToMarkDirty);
    }
    
    // Notify about selection change
    if (selectedNodeIds.size > 0) {
      const firstSelected = Array.from(selectedNodeIds)[0];
      this.context.onNodeSelected?.(firstSelected, selectedNodeIds.size > 1);
    }
    
    // Request render to show selection changes
    this.context.requestRender();
  }
}

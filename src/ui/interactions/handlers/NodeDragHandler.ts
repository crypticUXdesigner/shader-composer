/**
 * Node Drag Handler
 * 
 * Handles node dragging interactions:
 * - Click and drag on node header to move nodes
 * - Multi-select dragging (move all selected nodes together)
 * - Smart guides and snapping
 */

import { InteractionType } from '../InteractionTypes';
import type { InteractionEvent, InteractionHandler } from '../InteractionHandler';
import type { HandlerContext } from '../HandlerContext';
import { RenderLayer } from '../../components/rendering/RenderState';

export class NodeDragHandler implements InteractionHandler {
  priority = 50; // High priority - node dragging is specific interaction
  
  private isDraggingNode: boolean = false;
  private draggingNodeId: string | null = null;
  private dragOffsetX: number = 0;
  private dragOffsetY: number = 0;
  private draggingNodeInitialPos: { x: number; y: number } | null = null;
  private selectedNodesInitialPositions: Map<string, { x: number; y: number }> = new Map();
  private potentialNodeDrag: boolean = false;
  private potentialNodeDragId: string | null = null;
  private nodeDragStartX: number = 0;
  private nodeDragStartY: number = 0;
  private readonly nodeDragThreshold: number = 5; // pixels
  
  // Edge scrolling state
  private edgeScrollAnimationFrame: number | null = null;
  private edgeScrollVelocityX: number = 0;
  private edgeScrollVelocityY: number = 0;
  private readonly EDGE_SCROLL_ZONE = 0.1; // 10% of width/height
  private readonly MAX_EDGE_SCROLL_SPEED = 800; // pixels per second
  private currentMouseX: number = 0;
  private currentMouseY: number = 0;
  
  constructor(private context: HandlerContext) {}
  
  canHandle(event: InteractionEvent): boolean {
    // If we're currently dragging or have a potential drag, we can handle end events
    if (this.isDraggingNode || this.potentialNodeDrag) {
      return true;
    }
    
    // Can handle if clicking on a node header (not spacebar pressed)
    if (event.type === InteractionType.NodeDrag) {
      return true;
    }
    
    // Check if spacebar is pressed - if so, don't handle (let pan handler take it)
    if (this.context.isSpacePressed?.()) {
      return false;
    }
    
    // Check if clicking on a node
    const nodeId = this.context.hitTestNode?.(event.screenPosition.x, event.screenPosition.y);
    if (nodeId) {
      return true;
    }
    
    return false;
  }
  
  onStart(event: InteractionEvent): void {
    const nodeId = this.context.hitTestNode?.(event.screenPosition.x, event.screenPosition.y);
    if (!nodeId) return;
    
    const graph = this.context.getGraph();
    const node = graph.nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    const metrics = this.context.getNodeMetrics?.(nodeId);
    if (!metrics) return;
    
    const canvasPos = this.context.screenToCanvas(event.screenPosition.x, event.screenPosition.y);
    const headerHeight = metrics.headerHeight;
    
    // Check if clicking on node header (for dragging)
    if (canvasPos.y - node.position.y < headerHeight) {
      // Handle selection first (for multi-select with shift-click)
      const state = this.context.getState();
      const multiSelect = event.modifiers.shift;
      
      if (!multiSelect) {
        // Single click: clear selection and select only this node
        if (!state.selectedNodeIds.has(nodeId)) {
          const newState = { ...state };
          newState.selectedNodeIds = new Set([nodeId]);
          // Mark connections as dirty before clearing so they re-render correctly
          if (newState.selectedConnectionIds.size > 0) {
            const previouslySelected = Array.from(newState.selectedConnectionIds);
            this.context.markConnectionsDirty?.(previouslySelected);
          }
          newState.selectedConnectionIds.clear();
          this.context.setState(() => newState);
          this.context.onNodeSelected?.(nodeId, false);
        }
      } else {
        // Shift-click: toggle selection
        const newState = { ...state };
        if (newState.selectedNodeIds.has(nodeId)) {
          newState.selectedNodeIds.delete(nodeId);
        } else {
          newState.selectedNodeIds.add(nodeId);
        }
        this.context.setState(() => newState);
        this.context.onNodeSelected?.(nodeId, true);
      }
      
      // Set up potential drag (with threshold)
      this.potentialNodeDrag = true;
      this.potentialNodeDragId = nodeId;
      this.nodeDragStartX = event.screenPosition.x;
      this.nodeDragStartY = event.screenPosition.y;
      
      const nodeScreenPos = this.context.canvasToScreen(node.position.x, node.position.y);
      this.dragOffsetX = event.screenPosition.x - nodeScreenPos.x;
      this.dragOffsetY = event.screenPosition.y - nodeScreenPos.y;
      
      this.context.setCursor('grab');
      this.context.render();
    } else {
      // Clicked on node body - just select node
      const state = this.context.getState();
      const multiSelect = event.modifiers.shift;
      const newState = { ...state };
      
      // Track which nodes changed selection state
      const nodesToMarkDirty: string[] = [];
      
      if (!multiSelect) {
        // Mark previously selected nodes as dirty (they're being deselected)
        if (newState.selectedNodeIds.size > 0) {
          nodesToMarkDirty.push(...Array.from(newState.selectedNodeIds));
        }
        newState.selectedNodeIds.clear();
        // Mark connections as dirty before clearing so they re-render correctly
        if (newState.selectedConnectionIds.size > 0) {
          const previouslySelected = Array.from(newState.selectedConnectionIds);
          this.context.markConnectionsDirty?.(previouslySelected);
        }
        newState.selectedConnectionIds.clear();
      }
      
      const wasSelected = newState.selectedNodeIds.has(nodeId);
      if (wasSelected) {
        newState.selectedNodeIds.delete(nodeId);
      } else {
        newState.selectedNodeIds.add(nodeId);
      }
      
      // Mark the clicked node as dirty (its selection state changed)
      nodesToMarkDirty.push(nodeId);
      
      this.context.setState(() => newState);
      
      // Mark affected nodes as dirty so they re-render with new selection state
      if (nodesToMarkDirty.length > 0) {
        this.context.markNodesDirty?.(nodesToMarkDirty);
      }
      
      this.context.onNodeSelected?.(nodeId, multiSelect);
      this.context.render();
    }
  }
  
  onUpdate(event: InteractionEvent): void {
    // Store current mouse position for edge scrolling
    this.currentMouseX = event.screenPosition.x;
    this.currentMouseY = event.screenPosition.y;
    
    // Check if we should start node dragging
    if (this.potentialNodeDrag && !this.isDraggingNode && this.potentialNodeDragId) {
      const dx = event.screenPosition.x - this.nodeDragStartX;
      const dy = event.screenPosition.y - this.nodeDragStartY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > this.nodeDragThreshold) {
        // Start dragging
        this.isDraggingNode = true;
        this.draggingNodeId = this.potentialNodeDragId;
        this.potentialNodeDrag = false;
        this.context.setCursor('grabbing');
        
        // Store initial positions for multi-node dragging
        const graph = this.context.getGraph();
        const draggedNode = graph.nodes.find(n => n.id === this.draggingNodeId);
        if (draggedNode) {
          this.draggingNodeInitialPos = { x: draggedNode.position.x, y: draggedNode.position.y };
          
          // Store initial positions of all selected nodes (including the dragged one)
          const state = this.context.getState();
          this.selectedNodesInitialPositions.clear();
          for (const selectedNodeId of state.selectedNodeIds) {
            const selectedNode = graph.nodes.find(n => n.id === selectedNodeId);
            if (selectedNode) {
              this.selectedNodesInitialPositions.set(selectedNodeId, {
                x: selectedNode.position.x,
                y: selectedNode.position.y
              });
            }
          }
        }
      }
    }
    
    // Update node positions if dragging
    if (this.isDraggingNode && this.draggingNodeId && this.draggingNodeInitialPos) {
      const graph = this.context.getGraph();
      const node = graph.nodes.find(n => n.id === this.draggingNodeId);
      if (!node) return;
      
      const canvasPos = this.context.screenToCanvas(
        event.screenPosition.x - this.dragOffsetX,
        event.screenPosition.y - this.dragOffsetY
      );
      
      // Calculate smart guides and snap position for the primary dragged node
      const { snappedX, snappedY, guides } = this.context.calculateSmartGuides?.(
        node,
        canvasPos.x,
        canvasPos.y
      ) ?? { snappedX: canvasPos.x, snappedY: canvasPos.y, guides: { vertical: [], horizontal: [] } };
      
      // Calculate the delta from initial position
      const deltaX = snappedX - this.draggingNodeInitialPos.x;
      const deltaY = snappedY - this.draggingNodeInitialPos.y;
      
      // Move all selected nodes by the same delta
      const movedNodeIds: string[] = [];
      
      for (const [nodeId, initialPos] of this.selectedNodesInitialPositions.entries()) {
        const selectedNode = graph.nodes.find(n => n.id === nodeId);
        if (selectedNode) {
          selectedNode.position.x = Math.round(initialPos.x + deltaX);
          selectedNode.position.y = Math.round(initialPos.y + deltaY);

          this.context.onNodeMoved?.(nodeId, selectedNode.position.x, selectedNode.position.y);
          movedNodeIds.push(nodeId);
        }
      }
      
      // Update smart guides
      this.context.setSmartGuides?.(guides);
      
      // Phase 3.4: Track dragged nodes for metrics recalculation before connection rendering
      this.context.setDraggedNodeIds?.(movedNodeIds);
      
      // Mark moved nodes and all related elements as dirty
      this.context.markNodesDirty?.(movedNodeIds);
      this.context.markLayerDirty?.(RenderLayer.Overlays); // Smart guides render in overlay layer
      
      // Mark all connections connected to moved nodes as dirty
      const connectionsToUpdate: string[] = [];
      for (const nodeId of movedNodeIds) {
        for (const conn of graph.connections) {
          if (conn.sourceNodeId === nodeId || conn.targetNodeId === nodeId) {
            connectionsToUpdate.push(conn.id);
          }
        }
      }
      if (connectionsToUpdate.length > 0) {
        this.context.markConnectionsDirty?.(connectionsToUpdate);
      }
      
      // Mark ports layer as dirty
      this.context.markLayerDirty?.(RenderLayer.Ports);
      this.context.markLayerDirty?.(RenderLayer.Connections);
      this.context.markLayerDirty?.(RenderLayer.ParameterConnections);
      
      this.context.requestRender();
    }
    
    // Check for edge scrolling when dragging
    if (this.isDraggingNode) {
      this.updateEdgeScrollVelocity(event.screenPosition.x, event.screenPosition.y);
      this.startEdgeScrolling();
    } else {
      this.stopEdgeScrolling();
    }
  }
  
  onEnd(_event: InteractionEvent): void {
    // Clean up drag state
    this.isDraggingNode = false;
    this.draggingNodeId = null;
    this.draggingNodeInitialPos = null;
    this.selectedNodesInitialPositions.clear();
    this.potentialNodeDrag = false;
    this.potentialNodeDragId = null;
    
    // Stop edge scrolling
    this.stopEdgeScrolling();
    
    // Clear smart guides
    this.context.setSmartGuides?.({ vertical: [], horizontal: [] });
    // Force overlays to redraw immediately so guide lines disappear on mouseup
    this.context.markLayerDirty?.(RenderLayer.Overlays);
    this.context.requestRender();
    
    // Phase 3.4: Clear dragged nodes tracking
    this.context.setDraggedNodeIds?.([]);
    
    this.context.setCursor('default');
  }
  
  handle(_event: InteractionEvent): void {
    // This method is called for immediate handling
    // For node dragging, we use onStart/onUpdate/onEnd lifecycle
    // This is a no-op as dragging is handled through lifecycle methods
  }
  
  /**
   * Calculate edge scroll velocity based on mouse position
   */
  private updateEdgeScrollVelocity(mouseX: number, mouseY: number): void {
    const rect = this.context.getCanvasRect?.();
    if (!rect) return;
    
    const canvasWidth = rect.width;
    const canvasHeight = rect.height;
    const scrollZoneWidth = canvasWidth * this.EDGE_SCROLL_ZONE;
    const scrollZoneHeight = canvasHeight * this.EDGE_SCROLL_ZONE;
    
    // Calculate distance from edges
    const distFromLeft = mouseX - rect.left;
    const distFromRight = rect.right - mouseX;
    const distFromTop = mouseY - rect.top;
    const distFromBottom = rect.bottom - mouseY;
    
    // Calculate velocity for X axis
    let velocityX = 0;
    if (distFromLeft < scrollZoneWidth) {
      // Near left edge - scroll right to reveal more content (positive velocity)
      const proximity = 1 - (distFromLeft / scrollZoneWidth);
      velocityX = this.MAX_EDGE_SCROLL_SPEED * proximity * proximity; // Quadratic for smoother acceleration
    } else if (distFromRight < scrollZoneWidth) {
      // Near right edge - scroll left to reveal more content (negative velocity)
      const proximity = 1 - (distFromRight / scrollZoneWidth);
      velocityX = -this.MAX_EDGE_SCROLL_SPEED * proximity * proximity;
    }
    
    // Calculate velocity for Y axis
    let velocityY = 0;
    if (distFromTop < scrollZoneHeight) {
      // Near top edge - scroll down to reveal more content (positive velocity)
      const proximity = 1 - (distFromTop / scrollZoneHeight);
      velocityY = this.MAX_EDGE_SCROLL_SPEED * proximity * proximity;
    } else if (distFromBottom < scrollZoneHeight) {
      // Near bottom edge - scroll up to reveal more content (negative velocity)
      const proximity = 1 - (distFromBottom / scrollZoneHeight);
      velocityY = -this.MAX_EDGE_SCROLL_SPEED * proximity * proximity;
    }
    
    this.edgeScrollVelocityX = velocityX;
    this.edgeScrollVelocityY = velocityY;
  }
  
  /**
   * Start edge scrolling animation loop
   */
  private startEdgeScrolling(): void {
    if (this.edgeScrollAnimationFrame !== null) {
      return; // Already running
    }
    
    let lastTime = performance.now();
    
    const animate = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
      lastTime = currentTime;
      
      // Update velocity based on current mouse position
      this.updateEdgeScrollVelocity(this.currentMouseX, this.currentMouseY);
      
      // Only scroll if there's velocity
      if (this.edgeScrollVelocityX !== 0 || this.edgeScrollVelocityY !== 0) {
        // Update pan based on velocity and delta time
        const state = this.context.getState();
        const newState = { ...state };
        newState.panX += this.edgeScrollVelocityX * deltaTime;
        newState.panY += this.edgeScrollVelocityY * deltaTime;
        this.context.setState(() => newState);
        
        // If dragging a node, update its position to stay under the mouse cursor
        if (this.isDraggingNode && this.draggingNodeId && this.draggingNodeInitialPos) {
          const graph = this.context.getGraph();
          const node = graph.nodes.find(n => n.id === this.draggingNodeId);
          if (node) {
            // Convert current mouse position to canvas coordinates
            const canvasPos = this.context.screenToCanvas(
              this.currentMouseX - this.dragOffsetX,
              this.currentMouseY - this.dragOffsetY
            );
            
            // Calculate smart guides and snap position
            const { snappedX, snappedY, guides } = this.context.calculateSmartGuides?.(
              node,
              canvasPos.x,
              canvasPos.y
            ) ?? { snappedX: canvasPos.x, snappedY: canvasPos.y, guides: { vertical: [], horizontal: [] } };
            
            // Calculate the delta from initial position
            const deltaX = snappedX - this.draggingNodeInitialPos.x;
            const deltaY = snappedY - this.draggingNodeInitialPos.y;
            
            // Move all selected nodes by the same delta
            const movedNodeIds: string[] = [];
            for (const [nodeId, initialPos] of this.selectedNodesInitialPositions.entries()) {
              const selectedNode = graph.nodes.find(n => n.id === nodeId);
              if (selectedNode) {
                selectedNode.position.x = Math.round(initialPos.x + deltaX);
                selectedNode.position.y = Math.round(initialPos.y + deltaY);

                this.context.onNodeMoved?.(nodeId, selectedNode.position.x, selectedNode.position.y);
                movedNodeIds.push(nodeId);
              }
            }
            
            // Update smart guides
            this.context.setSmartGuides?.(guides);
            this.context.setDraggedNodeIds?.(movedNodeIds);
            this.context.markNodesDirty?.(movedNodeIds);
            this.context.markLayerDirty?.(RenderLayer.Overlays); // Smart guides render in overlay layer
            
            // Mark connections as dirty
            const connectionsToUpdate: string[] = [];
            for (const nodeId of movedNodeIds) {
              for (const conn of graph.connections) {
                if (conn.sourceNodeId === nodeId || conn.targetNodeId === nodeId) {
                  connectionsToUpdate.push(conn.id);
                }
              }
            }
            if (connectionsToUpdate.length > 0) {
              this.context.markConnectionsDirty?.(connectionsToUpdate);
            }
            
            this.context.markLayerDirty?.(RenderLayer.Ports);
            this.context.markLayerDirty?.(RenderLayer.Connections);
            this.context.markLayerDirty?.(RenderLayer.ParameterConnections);
          }
        }
        
        this.context.requestRender();
      }
      
      // Continue animation if still dragging
      if (this.isDraggingNode) {
        this.edgeScrollAnimationFrame = requestAnimationFrame(animate);
      } else {
        this.edgeScrollAnimationFrame = null;
      }
    };
    
    this.edgeScrollAnimationFrame = requestAnimationFrame(animate);
  }
  
  /**
   * Stop edge scrolling animation
   */
  private stopEdgeScrolling(): void {
    if (this.edgeScrollAnimationFrame !== null) {
      cancelAnimationFrame(this.edgeScrollAnimationFrame);
      this.edgeScrollAnimationFrame = null;
    }
    this.edgeScrollVelocityX = 0;
    this.edgeScrollVelocityY = 0;
  }
}

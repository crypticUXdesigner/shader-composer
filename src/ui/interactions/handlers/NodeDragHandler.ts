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
import { RenderLayer } from '../../editor/rendering/RenderState';
import { createNodeDragEdgeScroll } from './NodeDragHandlerEdgeScroll';

export class NodeDragHandler implements InteractionHandler {
  priority = 50;

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
  private readonly nodeDragThreshold: number = 5;
  private currentMouseX: number = 0;
  private currentMouseY: number = 0;
  private edgeScroll: ReturnType<typeof createNodeDragEdgeScroll>;

  constructor(private context: HandlerContext) {
    this.edgeScroll = createNodeDragEdgeScroll({
      context: this.context,
      getDragState: () => this.getEdgeScrollDragState()
    });
  }

  private getEdgeScrollDragState() {
    return {
      isDraggingNode: this.isDraggingNode,
      draggingNodeId: this.draggingNodeId,
      draggingNodeInitialPos: this.draggingNodeInitialPos,
      selectedNodesInitialPositions: this.selectedNodesInitialPositions,
      currentMouseX: this.currentMouseX,
      currentMouseY: this.currentMouseY,
      dragOffsetX: this.dragOffsetX,
      dragOffsetY: this.dragOffsetY
    };
  }
  
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
      
      this.context.setCursor('default');
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
        
        // Determine which nodes to move:
        // - Dragged node is in selection: move all selected
        // - Shift-drag on unselected: move all selected + that node (selection updated in onStart)
        // - Drag unselected without shift: move only that single node
        const graph = this.context.getGraph();
        const state = this.context.getState();
        const draggedInSelection = state.selectedNodeIds.has(this.draggingNodeId!);
        const nodesToMove = draggedInSelection
          ? new Set(state.selectedNodeIds)
          : new Set([this.draggingNodeId!]);
        
        this.selectedNodesInitialPositions.clear();
        for (const nid of nodesToMove) {
          const n = graph.nodes.find(nd => nd.id === nid);
          if (n) {
            this.selectedNodesInitialPositions.set(nid, { x: n.position.x, y: n.position.y });
          }
        }
        
        const draggedNode = graph.nodes.find(n => n.id === this.draggingNodeId);
        if (draggedNode) {
          this.draggingNodeInitialPos = { x: draggedNode.position.x, y: draggedNode.position.y };
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
    
    if (this.isDraggingNode) {
      this.edgeScroll.updateVelocity(event.screenPosition.x, event.screenPosition.y);
      this.edgeScroll.start();
    } else {
      this.edgeScroll.stop();
    }
  }

  onEnd(_event: InteractionEvent): void {
    this.isDraggingNode = false;
    this.draggingNodeId = null;
    this.draggingNodeInitialPos = null;
    this.selectedNodesInitialPositions.clear();
    this.potentialNodeDrag = false;
    this.potentialNodeDragId = null;
    this.edgeScroll.stop();
    
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
    // Dragging is handled through onStart/onUpdate/onEnd lifecycle
  }
}

/**
 * RenderState - Tracks what needs to be re-rendered
 *
 * Implements dirty tracking to avoid full re-renders on every change.
 * Only marks specific nodes, connections, or layers as dirty.
 *
 * Layer order (enum) applies to the main canvas only. Nodes are DOM-rendered (no-op
 * on canvas). Only ParameterConnections are drawn to the overlay canvas (above
 * nodes); Connections (I/O) stay on the main canvas so they appear below nodes.
 * See NodeEditorCanvasWrapper (overlayContainer z-index) and
 * CanvasOverlayRenderer.renderParameterConnectionsToOverlay().
 */
export enum RenderLayer {
  Background = 0,
  Connections = 1,
  Nodes = 2,
  ParameterConnections = 3,
  Ports = 4,
  Overlays = 5,
  Temporary = 6
}

/**
 * DirtyRegion - Represents a rectangular region that needs re-rendering
 */
export interface DirtyRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class RenderState {
  private dirtyNodes: Set<string> = new Set();
  private dirtyConnections: Set<string> = new Set();
  private dirtyLayers: Set<RenderLayer> = new Set();
  private fullRedraw: boolean = false;
  private graph: { nodes: Array<{ id: string }>; connections: Array<{ id: string }> };
  // Phase 3.1: Dirty region tracking for incremental rendering
  private dirtyRegions: DirtyRegion[] = [];

  constructor(graph: { nodes: Array<{ id: string }>; connections: Array<{ id: string }> }) {
    this.graph = graph;
  }

  /**
   * Mark a node as dirty (needs re-rendering)
   */
  markNodeDirty(nodeId: string): void {
    this.dirtyNodes.add(nodeId);
    this.dirtyLayers.add(RenderLayer.Nodes);
    this.dirtyLayers.add(RenderLayer.Ports);
  }

  /**
   * Mark multiple nodes as dirty
   */
  markNodesDirty(nodeIds: string[]): void {
    for (const nodeId of nodeIds) {
      this.markNodeDirty(nodeId);
    }
  }

  /**
   * Mark a connection as dirty (needs re-rendering)
   */
  markConnectionDirty(connId: string): void {
    this.dirtyConnections.add(connId);
    this.dirtyLayers.add(RenderLayer.Connections);
    this.dirtyLayers.add(RenderLayer.ParameterConnections);
  }

  /**
   * Mark multiple connections as dirty
   */
  markConnectionsDirty(connIds: string[]): void {
    for (const connId of connIds) {
      this.markConnectionDirty(connId);
    }
  }

  /**
   * Mark a layer as dirty
   */
  markLayerDirty(layer: RenderLayer): void {
    this.dirtyLayers.add(layer);
  }

  /**
   * Mark all nodes and connections as dirty (full redraw)
   */
  markFullRedraw(): void {
    this.fullRedraw = true;
    this.dirtyLayers.clear();
    // Mark all layers as dirty
    Object.values(RenderLayer)
      .filter(v => typeof v === 'number')
      .forEach(layer => {
        this.dirtyLayers.add(layer as RenderLayer);
      });
  }

  /**
   * Get all dirty node IDs
   * Returns all node IDs if full redraw is requested
   */
  getDirtyNodes(): Set<string> {
    if (this.fullRedraw) {
      return new Set(this.graph.nodes.map(n => n.id));
    }
    return new Set(this.dirtyNodes);
  }

  /**
   * Get all dirty connection IDs
   * Returns all connection IDs if full redraw is requested
   */
  getDirtyConnections(): Set<string> {
    if (this.fullRedraw) {
      return new Set(this.graph.connections.map(c => c.id));
    }
    return new Set(this.dirtyConnections);
  }

  /**
   * Check if a specific node is dirty
   */
  isNodeDirty(nodeId: string): boolean {
    return this.fullRedraw || this.dirtyNodes.has(nodeId);
  }

  /**
   * Check if a specific connection is dirty
   */
  isConnectionDirty(connId: string): boolean {
    return this.fullRedraw || this.dirtyConnections.has(connId);
  }

  /**
   * Check if a layer is dirty
   */
  isLayerDirty(layer: RenderLayer): boolean {
    return this.fullRedraw || this.dirtyLayers.has(layer);
  }

  /**
   * Check if full redraw is needed
   */
  needsFullRedraw(): boolean {
    return this.fullRedraw;
  }

  /**
   * Clear all dirty state (call after rendering)
   */
  clear(): void {
    this.dirtyNodes.clear();
    this.dirtyConnections.clear();
    this.dirtyLayers.clear();
    this.fullRedraw = false;
    this.dirtyRegions = [];
  }
  
  /**
   * Phase 3.1: Add a dirty region (rectangular area that needs re-rendering)
   */
  addDirtyRegion(region: DirtyRegion): void {
    this.dirtyRegions.push(region);
  }
  
  /**
   * Phase 3.1: Get all dirty regions
   */
  getDirtyRegions(): DirtyRegion[] {
    return [...this.dirtyRegions];
  }
  
  /**
   * Check if a rectangle (in screen space) intersects any dirty region
   */
  intersectsDirtyRegion(rectX: number, rectY: number, rectWidth: number, rectHeight: number): boolean {
    if (this.dirtyRegions.length === 0) {
      return false;
    }
    
    for (const region of this.dirtyRegions) {
      // Check if rectangles overlap
      if (!(
        rectX + rectWidth < region.x ||
        region.x + region.width < rectX ||
        rectY + rectHeight < region.y ||
        region.y + region.height < rectY
      )) {
        return true; // Intersects
      }
    }
    
    return false;
  }

  /**
   * Check if a rectangle in canvas space intersects any dirty region (in screen space)
   * Converts canvas coordinates to screen coordinates using pan/zoom
   */
  intersectsDirtyRegionCanvasSpace(
    canvasX: number,
    canvasY: number,
    canvasWidth: number,
    canvasHeight: number,
    panX: number,
    panY: number,
    zoom: number
  ): boolean {
    if (this.dirtyRegions.length === 0) {
      return false;
    }
    
    // Convert canvas space to screen space
    const screenX = canvasX * zoom + panX;
    const screenY = canvasY * zoom + panY;
    const screenWidth = canvasWidth * zoom;
    const screenHeight = canvasHeight * zoom;
    
    return this.intersectsDirtyRegion(screenX, screenY, screenWidth, screenHeight);
  }

  /**
   * Phase 3.1: Merge overlapping dirty regions into minimal set of rectangles
   * Uses simple bounding box merging for performance
   */
  mergeDirtyRegions(): DirtyRegion[] {
    if (this.dirtyRegions.length === 0) {
      return [];
    }
    
    if (this.dirtyRegions.length === 1) {
      return [this.dirtyRegions[0]];
    }
    
    // Simple approach: merge overlapping regions
    const merged: DirtyRegion[] = [];
    const processed = new Set<number>();
    
    for (let i = 0; i < this.dirtyRegions.length; i++) {
      if (processed.has(i)) continue;
      
      let current = { ...this.dirtyRegions[i] };
      
      // Try to merge with other regions
      for (let j = i + 1; j < this.dirtyRegions.length; j++) {
        if (processed.has(j)) continue;
        
        const other = this.dirtyRegions[j];
        
        // Check if regions overlap or are adjacent
        if (this.regionsOverlapOrAdjacent(current, other)) {
          // Merge regions
          const minX = Math.min(current.x, other.x);
          const minY = Math.min(current.y, other.y);
          const maxX = Math.max(current.x + current.width, other.x + other.width);
          const maxY = Math.max(current.y + current.height, other.y + other.height);
          
          current = {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
          };
          
          processed.add(j);
        }
      }
      
      merged.push(current);
      processed.add(i);
    }
    
    return merged;
  }
  
  /**
   * Phase 3.1: Check if two regions overlap or are adjacent (within threshold)
   */
  private regionsOverlapOrAdjacent(a: DirtyRegion, b: DirtyRegion): boolean {
    const threshold = 10; // pixels - merge regions within this distance
    return !(
      a.x + a.width + threshold < b.x ||
      b.x + b.width + threshold < a.x ||
      a.y + a.height + threshold < b.y ||
      b.y + b.height + threshold < a.y
    );
  }

  /**
   * Update graph reference (when graph changes)
   */
  updateGraph(graph: { nodes: Array<{ id: string }>; connections: Array<{ id: string }> }): void {
    this.graph = graph;
    // Clear dirty state for nodes/connections that no longer exist
    const existingNodeIds = new Set(graph.nodes.map(n => n.id));
    const existingConnIds = new Set(graph.connections.map(c => c.id));
    
    for (const nodeId of this.dirtyNodes) {
      if (!existingNodeIds.has(nodeId)) {
        this.dirtyNodes.delete(nodeId);
      }
    }
    
    for (const connId of this.dirtyConnections) {
      if (!existingConnIds.has(connId)) {
        this.dirtyConnections.delete(connId);
      }
    }
  }
}

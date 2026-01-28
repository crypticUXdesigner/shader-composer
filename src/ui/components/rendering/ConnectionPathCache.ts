/**
 * ConnectionPathCache - Caches connection paths to avoid recalculating bezier curves
 * 
 * Caches Path2D objects for connections and only recalculates when port positions change.
 * Provides efficient invalidation by node ID to clear all connections involving a specific node.
 */

interface CachedConnectionPath {
  path: Path2D;
  sourcePos: { x: number; y: number };
  targetPos: { x: number; y: number };
  timestamp: number;
}

export class ConnectionPathCache {
  private cache: Map<string, CachedConnectionPath> = new Map();
  private maxCacheSize: number = 1000;
  
  /**
   * Get cached path for connection if positions haven't changed
   * @returns Path2D if cache hit, null if cache miss or positions changed
   */
  getPath(
    connectionId: string,
    sourcePos: { x: number; y: number },
    targetPos: { x: number; y: number }
  ): Path2D | null {
    const cached = this.cache.get(connectionId);
    if (!cached) return null;
    
    // Check if positions changed
    if (cached.sourcePos.x !== sourcePos.x || cached.sourcePos.y !== sourcePos.y ||
        cached.targetPos.x !== targetPos.x || cached.targetPos.y !== targetPos.y) {
      // Positions changed - invalidate cache
      this.cache.delete(connectionId);
      return null;
    }
    
    return cached.path;
  }
  
  /**
   * Cache path for connection
   */
  setPath(
    connectionId: string,
    path: Path2D,
    sourcePos: { x: number; y: number },
    targetPos: { x: number; y: number }
  ): void {
    // Enforce cache size limit
    if (this.cache.size >= this.maxCacheSize) {
      // Remove oldest entry (simple FIFO)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(connectionId, {
      path,
      sourcePos: { ...sourcePos },
      targetPos: { ...targetPos },
      timestamp: performance.now()
    });
  }
  
  /**
   * Invalidate cache for a specific connection
   */
  invalidate(connectionId: string): void {
    this.cache.delete(connectionId);
  }
  
  /**
   * Invalidate all connections involving a specific node
   * This is more efficient than clearing the entire cache when a node moves
   */
  invalidateNodeConnections(nodeId: string, connections: Array<{ id: string; sourceNodeId: string; targetNodeId: string }>): void {
    for (const conn of connections) {
      if (conn.sourceNodeId === nodeId || conn.targetNodeId === nodeId) {
        this.cache.delete(conn.id);
      }
    }
  }
  
  /**
   * Clear all cached paths
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Get cache statistics (for debugging/performance monitoring)
   */
  getStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize
    };
  }
}

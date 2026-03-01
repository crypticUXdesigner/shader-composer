/**
 * NodeCache - Offscreen canvas caching for node rendering
 * 
 * Caches static node visuals to offscreen canvases for significant performance improvements.
 * Separates static content (background, border, icon, text) from dynamic content (selection, hover).
 */

import type { NodeInstance } from '../../../data-model/types';
import type { NodeSpec } from '../../../types/nodeSpec';
import type { NodeRenderMetrics } from '../NodeRenderer';

/**
 * Cache entry for a node
 */
interface NodeCacheEntry {
  canvas: HTMLCanvasElement;
  cacheKey: string;
  width: number;
  height: number;
}

/**
 * NodeCache - Manages offscreen canvas caching for nodes
 */
export class NodeCache {
  private cache = new Map<string, NodeCacheEntry>();
  private maxCacheSize = 500; // Maximum number of cached nodes
  
  /**
   * Generate cache key for a node
   * Includes all factors that affect static rendering (excluding position and dynamic states)
   */
  generateCacheKey(
    node: NodeInstance,
    spec: NodeSpec,
    metrics: NodeRenderMetrics
  ): string {
    // Include factors that affect static rendering
    const parts = [
      node.type,
      node.label || spec.displayName,
      metrics.width,
      metrics.height,
      metrics.headerHeight,
      // Include parameter keys (order matters for layout)
      Object.keys(spec.parameters || {}).sort().join(','),
      // Include parameter values that affect static layout (not visual values)
      // Note: We don't include actual parameter values in the cache key
      // because they change frequently and affect rendering
    ];
    
    return parts.join('|');
  }
  
  /**
   * Get cached node canvas or create a new one
   */
  getCachedNode(
    node: NodeInstance,
    spec: NodeSpec,
    metrics: NodeRenderMetrics,
    renderStaticContent: (ctx: CanvasRenderingContext2D, width: number, height: number) => void
  ): HTMLCanvasElement {
    const cacheKey = this.generateCacheKey(node, spec, metrics);
    
    // Check if we have a cached version
    const cached = this.cache.get(cacheKey);
    if (cached && cached.width === metrics.width && cached.height === metrics.height) {
      return cached.canvas;
    }
    
    // Create new offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = metrics.width;
    canvas.height = metrics.height;
    const ctx = canvas.getContext('2d')!;
    
    // Render static content to offscreen canvas
    // Note: We render at (0, 0) since this is an offscreen canvas
    renderStaticContent(ctx, metrics.width, metrics.height);
    
    // Store in cache
    const entry: NodeCacheEntry = {
      canvas,
      cacheKey,
      width: metrics.width,
      height: metrics.height
    };
    
    this.cache.set(cacheKey, entry);
    
    // Enforce cache size limit (LRU eviction)
    if (this.cache.size > this.maxCacheSize) {
      // Remove oldest entries (simple FIFO for now)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    
    return canvas;
  }
  
  /**
   * Invalidate cache for a specific node
   */
  invalidateNode(node: NodeInstance, spec: NodeSpec, metrics: NodeRenderMetrics): void {
    const cacheKey = this.generateCacheKey(node, spec, metrics);
    this.cache.delete(cacheKey);
  }
  
  /**
   * Invalidate all cache entries
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize
    };
  }
}

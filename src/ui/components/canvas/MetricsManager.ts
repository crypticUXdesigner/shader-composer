/**
 * Metrics Manager
 * 
 * Manages metrics calculation coordination, cache invalidation, and component synchronization
 * for node rendering metrics in the node editor canvas.
 */

import type { NodeGraph } from '../../../types/nodeGraph';
import type { NodeSpec } from '../../../types/nodeSpec';
import type { NodeRenderMetrics } from '../NodeRenderer';
import type { NodeRenderer } from '../NodeRenderer';
import type { NodeComponent } from '../node/NodeComponent';
import type { HitTestManager } from './HitTestManager';
import type { ConnectionStateManager } from './ConnectionStateManager';

export interface MetricsManagerDependencies {
  graph: NodeGraph;
  nodeSpecs: Map<string, NodeSpec>;
  nodeRenderer: NodeRenderer;
  nodeComponents: Map<string, NodeComponent>;
  nodeMetrics: Map<string, NodeRenderMetrics>;
  hitTestManager: HitTestManager;
  connectionStateManager: ConnectionStateManager;
}

/**
 * Manages metrics calculation, cache invalidation, and component synchronization
 */
export class MetricsManager {
  private graph: NodeGraph;
  private nodeSpecs: Map<string, NodeSpec>;
  private nodeRenderer: NodeRenderer;
  private nodeComponents: Map<string, NodeComponent>;
  private nodeMetrics: Map<string, NodeRenderMetrics>;
  private hitTestManager: HitTestManager;
  private connectionStateManager: ConnectionStateManager;

  constructor(dependencies: MetricsManagerDependencies) {
    this.graph = dependencies.graph;
    this.nodeSpecs = dependencies.nodeSpecs;
    this.nodeRenderer = dependencies.nodeRenderer;
    this.nodeComponents = dependencies.nodeComponents;
    this.nodeMetrics = dependencies.nodeMetrics;
    this.hitTestManager = dependencies.hitTestManager;
    this.connectionStateManager = dependencies.connectionStateManager;
  }

  /**
   * Update dependencies (called when graph or other dependencies change)
   */
  updateDependencies(dependencies: Partial<MetricsManagerDependencies>): void {
    if (dependencies.graph !== undefined) this.graph = dependencies.graph;
    if (dependencies.nodeSpecs !== undefined) this.nodeSpecs = dependencies.nodeSpecs;
    if (dependencies.nodeRenderer !== undefined) this.nodeRenderer = dependencies.nodeRenderer;
    if (dependencies.nodeComponents !== undefined) this.nodeComponents = dependencies.nodeComponents;
    if (dependencies.nodeMetrics !== undefined) this.nodeMetrics = dependencies.nodeMetrics;
    if (dependencies.hitTestManager !== undefined) this.hitTestManager = dependencies.hitTestManager;
    if (dependencies.connectionStateManager !== undefined) this.connectionStateManager = dependencies.connectionStateManager;
  }

  /**
   * Recalculate metrics for all nodes in the graph
   * Clears existing metrics and recalculates for all nodes, then updates dependent managers
   */
  updateNodeMetrics(): void {
    this.nodeMetrics.clear();
    for (const node of this.graph.nodes) {
      const spec = this.nodeSpecs.get(node.type);
      if (spec) {
        const metrics = this.nodeRenderer.calculateMetrics(node, spec);
        this.nodeMetrics.set(node.id, metrics);
      }
    }
    // Update HitTestManager with new metrics
    this.hitTestManager.updateDependencies({
      graph: this.graph,
      nodeMetrics: this.nodeMetrics
    });
    // Update ConnectionStateManager with new metrics
    this.connectionStateManager.updateDependencies({
      graph: this.graph,
      nodeMetrics: this.nodeMetrics
    });
  }

  /**
   * Recalculate metrics for specific nodes (used for dirty node updates)
   * This ensures metrics are up-to-date when parameters change
   * 
   * OPTIMIZATION: Uses lazy recalculation - only recalculates when needed.
   * The NodeMetricsCalculator's optimized cache key ensures that value-only
   * parameter changes don't trigger expensive recalculations.
   */
  recalculateMetricsForDirtyNodes(nodeIds: Set<string>): void {
    for (const nodeId of nodeIds) {
      const node = this.graph.nodes.find(n => n.id === nodeId);
      if (!node) continue;
      
      const spec = this.nodeSpecs.get(node.type);
      if (!spec) continue;
      
      // Invalidate node cache (metrics or content may have changed)
      // The cache will be regenerated on next render with new metrics
      const oldMetrics = this.nodeMetrics.get(nodeId);
      if (oldMetrics) {
        this.nodeRenderer.clearNodeCache(node, spec, oldMetrics);
      }
      
      // Recalculate metrics - the NodeMetricsCalculator's optimized cache key
      // will handle value-only parameter changes efficiently (cache hits)
      // Only layout-affecting changes will trigger actual recalculation
      const metrics = this.nodeRenderer.calculateMetrics(node, spec);
      this.nodeMetrics.set(nodeId, metrics);
      
      // Also update component metrics if component exists
      const component = this.nodeComponents.get(nodeId);
      if (component) {
        component.invalidateMetrics();
        this.nodeMetrics.set(nodeId, component.getNodeMetrics());
      }
    }
  }

  /**
   * Recalculate metrics for specific nodes (used by connection layer renderers)
   * This is called before rendering connections to ensure dragged nodes have updated metrics
   */
  recalculateMetricsForNodes(nodeIds: string[]): void {
    for (const nodeId of nodeIds) {
      const node = this.graph.nodes.find(n => n.id === nodeId);
      if (!node) continue;
      
      const spec = this.nodeSpecs.get(node.type);
      if (!spec) continue;
      
      // Recalculate metrics for this node
      const metrics = this.nodeRenderer.calculateMetrics(node, spec);
      this.nodeMetrics.set(nodeId, metrics);
      
      // Update component metrics
      const component = this.nodeComponents.get(nodeId);
      if (component) {
        component.invalidateMetrics();
        component.calculateMetrics();
        this.nodeMetrics.set(nodeId, component.getNodeMetrics());
      }
    }
  }

  /**
   * Update metrics for a single node
   * Useful for incremental updates when a single node changes
   */
  updateMetricsForNode(nodeId: string): void {
    const node = this.graph.nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    const spec = this.nodeSpecs.get(node.type);
    if (!spec) return;
    
    // Recalculate metrics
    const metrics = this.nodeRenderer.calculateMetrics(node, spec);
    this.nodeMetrics.set(nodeId, metrics);
    
    // Update component metrics if component exists
    const component = this.nodeComponents.get(nodeId);
    if (component) {
      component.invalidateMetrics();
      this.nodeMetrics.set(nodeId, component.getNodeMetrics());
    }
    
    // Update dependent managers with new metrics
    this.hitTestManager.updateDependencies({
      graph: this.graph,
      nodeMetrics: this.nodeMetrics
    });
    this.connectionStateManager.updateDependencies({
      graph: this.graph,
      nodeMetrics: this.nodeMetrics
    });
  }

  /**
   * Invalidate metrics for a specific node
   * Removes metrics from cache and invalidates NodeRenderer and NodeComponent caches
   */
  invalidateNodeMetrics(nodeId: string): void {
    this.nodeMetrics.delete(nodeId);
    this.nodeRenderer.invalidateMetrics(nodeId);
    const component = this.nodeComponents.get(nodeId);
    if (component) {
      component.invalidateMetrics();
    }
  }

  /**
   * Invalidate all metrics (clear entire cache)
   * Useful when graph structure changes significantly
   */
  invalidateAllMetrics(): void {
    this.nodeMetrics.clear();
    // Note: NodeRenderer doesn't have a clearAllMetrics method, so we clear the cache
    this.nodeRenderer.clearCache();
    // Invalidate all component metrics
    for (const component of this.nodeComponents.values()) {
      component.invalidateMetrics();
    }
  }
}

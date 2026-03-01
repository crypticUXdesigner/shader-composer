/**
 * Handles metrics calculation for nodes. Nodes are rendered as DOM (DomNodeLayer).
 * Canvas drawing for nodes was removed in favor of Svelte DOM components.
 */

import type { NodeInstance } from '../../data-model/types';
import type { NodeSpec } from '../../types/nodeSpec';
import { getParameterEnumMappings } from '../../utils/parameterEnumMappings';
import { NodeMetricsCalculator } from './rendering/NodeMetricsCalculator';
import type { ElementMetrics } from './rendering/layout/LayoutElementRenderer';

export interface NodeRenderMetrics {
  width: number;
  height: number;
  headerHeight: number;
  portPositions: Map<string, { x: number; y: number; isOutput: boolean }>;
  
  // New: Parameter grid metrics
  parameterGridPositions: Map<string, {
    cellX: number;
    cellY: number;
    cellWidth: number;
    cellHeight: number;
    knobX: number;
    knobY: number;
    portX: number;
    portY: number;
    labelX: number;
    labelY: number;
    valueX: number;
    valueY: number;
  }>;
  
  // Keep for compatibility (may be deprecated)
  parameterPositions: Map<string, { x: number; y: number; width: number; height: number }>;
  parameterInputPortPositions: Map<string, { x: number; y: number }>;  // Parameter name Ã¢â€ â€™ port position
  
  // Layout system element metrics (only set when using parameterLayout)
  // Uses string keys (element type + index) for stable lookups across object instances
  elementMetrics?: Map<string, ElementMetrics>;
}

export class NodeRenderer {
  private metricsCalculator: NodeMetricsCalculator | null = null;
  
  constructor(ctx: CanvasRenderingContext2D) {
    this.metricsCalculator = new NodeMetricsCalculator(ctx);
  }
  
  /** No-op: nodes are DOM-rendered. Kept for API compatibility. */
  setCacheEnabled(_enabled: boolean): void {}
  
  /** No-op: nodes are DOM-rendered. Kept for API compatibility. */
  clearCache(): void {}
  
  /** No-op: nodes are DOM-rendered. Kept for API compatibility. */
  clearNodeCache(_node: NodeInstance, _spec: NodeSpec, _metrics: NodeRenderMetrics): void {}
  
  calculateMetrics(node: NodeInstance, spec: NodeSpec): NodeRenderMetrics {
    return this.metricsCalculator!.calculate(node, spec);
  }
  
  /**
   * Invalidate cached metrics for a node
   */
  invalidateMetrics(nodeId: string): void {
    this.metricsCalculator!.invalidate(nodeId);
  }
  
  /** Get enum label mappings for a parameter (used by OverlayManager for dropdown) */
  getEnumMappings(nodeId: string, paramName: string): Record<number, string> | null {
    return getParameterEnumMappings(nodeId, paramName);
  }
}


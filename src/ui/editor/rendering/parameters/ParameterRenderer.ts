/**
 * Base Parameter Renderer
 * 
 * Abstract base class for all parameter renderers.
 * Each parameter UI type (knob, bezier, range, toggle, enum) has its own renderer implementation.
 */

import type { NodeSpec, ParameterSpec } from '../../../../types/nodeSpec';

/**
 * Metrics for parameter cell layout
 */
export interface ParameterMetrics {
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
}

/**
 * State information for parameter rendering
 */
export interface ParameterRenderState {
  /** Whether this parameter has an input connection */
  isConnected: boolean;
  /** Whether this parameter is currently hovered */
  isHovered: boolean;
  /** Effective value (from audio/connection) or null if using static value */
  effectiveValue: number | null;
  /** Whether to skip rendering ports */
  skipPorts: boolean;
}

/**
 * Cell bounds for metrics calculation
 */
export interface CellBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Abstract base class for parameter renderers
 */
export abstract class ParameterRenderer {
  /**
   * Check if this renderer can handle the given parameter
   * @param spec Node specification
   * @param paramName Parameter name
   * @returns true if this renderer can handle the parameter
   */
  abstract canHandle(spec: NodeSpec, paramName: string): boolean;

  /**
   * Calculate metrics for this parameter
   * @param paramName Parameter name
   * @param paramSpec Parameter specification
   * @param cellBounds Cell bounds within the parameter grid
   * @returns Calculated metrics
   */
  abstract calculateMetrics(
    paramName: string,
    paramSpec: ParameterSpec,
    cellBounds: CellBounds
  ): ParameterMetrics;
  
  /**
   * Get UI type identifier (for registry and debugging)
   * @returns UI type string (e.g., 'knob', 'bezier', 'range', 'toggle', 'enum')
   */
  abstract getUIType(): string;
  
  /**
   * Get renderer priority (higher = checked first)
   * Default is 0. Override for specific renderers that should be checked before others.
   */
  getPriority(): number {
    return 0;
  }
}

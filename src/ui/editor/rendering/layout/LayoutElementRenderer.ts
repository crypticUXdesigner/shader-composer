/**
 * Base interface for layout element renderers
 * Each element type (auto-grid, grid, remap-range, bezier-editor, etc.) implements this
 * 
 * ## Coordinate System
 * 
 * All coordinates in the layout system use **absolute coordinates** relative to the canvas:
 * - `ElementMetrics.x, y`: Absolute canvas coordinates
 * - `ElementMetrics.width, height`: Element dimensions
 * - `parameterGridPositions`: All positions (cellX, cellY, knobX, knobY, etc.) are absolute
 * 
 * The `startY` parameter in `calculateMetrics()` is relative to the node body start (after header),
 * but it should be converted to absolute coordinates when setting `ElementMetrics.y`:
 * ```typescript
 * y: node.position.y + metrics.headerHeight + startY
 * ```
 * 
 * This ensures all rendering uses consistent absolute coordinates.
 */

import type { NodeInstance } from '../../../../data-model/types';
import type { NodeSpec, LayoutElement } from '../../../../types/nodeSpec';
import type { NodeRenderMetrics } from '../../NodeRenderer';

/** Rect for color map row buttons (swap/reverse hue) hit testing */
export interface ColorMapRowButtonRect {
  type: 'swap' | 'reverseHue';
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Rect for color picker swatch hit testing */
export interface ColorPickerSwatchRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Parameter grid position (cell and sub-positions) */
export interface ParameterGridPositionMetrics {
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
 * Metrics for a layout element
 */
export interface ElementMetrics {
  x: number;
  y: number;
  width: number;
  height: number;
  colorMapRowButtonRects?: ColorMapRowButtonRect[];
  colorPickerSwatchRects?: ColorPickerSwatchRect[];
  parameterGridPositions?: Map<string, ParameterGridPositionMetrics>;
  [key: string]: unknown;
}

/**
 * Base interface for layout element renderers
 */
export interface LayoutElementRenderer {
  /**
   * Check if this renderer can handle the given element type
   */
  canHandle(element: LayoutElement): boolean;
  
  /**
   * Calculate metrics for this element
   * @param element The layout element
   * @param node Node instance
   * @param spec Node specification
   * @param availableWidth Available width (node width - body padding * 2)
   * @param startY Starting Y position (relative to node body start, after header)
   * @param metrics Existing node metrics (for reference)
   * @returns Element metrics with absolute coordinates
   * 
   * Note: The returned `ElementMetrics` should use absolute coordinates:
   * - `x`: `node.position.x + gridPadding`
   * - `y`: `node.position.y + metrics.headerHeight + startY`
   * - All positions in `parameterGridPositions` should also be absolute
   */
  calculateMetrics(
    element: LayoutElement,
    node: NodeInstance,
    spec: NodeSpec,
    availableWidth: number,
    startY: number,
    metrics: NodeRenderMetrics
  ): ElementMetrics;
}

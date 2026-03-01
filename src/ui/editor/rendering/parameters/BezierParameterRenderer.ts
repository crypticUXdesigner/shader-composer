/**
 * Bezier Parameter Renderer
 * 
 * Renders bezier curve nodes with x1, y1, x2, y2 parameters as a single bezier curve editor.
 * This renderer handles all 4 parameters together as one UI element.
 */

import { ParameterRenderer, type ParameterMetrics, type CellBounds } from './ParameterRenderer';
import type { NodeSpec, ParameterSpec } from '../../../../types/nodeSpec';
import { getCSSVariableAsNumber } from '../../../../utils/cssTokens';

export class BezierParameterRenderer extends ParameterRenderer {
  getUIType(): string {
    return 'bezier';
  }
  
  canHandle(spec: NodeSpec, paramName: string): boolean {
    // Don't handle bezier parameters when using the layout system
    // The layout system uses BezierEditorElementRenderer for the bezier editor
    // and regular parameter renderers for the individual parameters
    if (spec.parameterLayout) {
      return false;
    }
    
    // Only handle bezier parameters (x1, y1, x2, y2)
    // We'll render the entire editor when called for x1
    if (paramName !== 'x1') return false;
    
    return spec.id === 'bezier-curve';
  }

  getPriority(): number {
    return 100; // Highest priority - checked first
  }
  
  calculateMetrics(
    _paramName: string,
    _paramSpec: ParameterSpec,
    cellBounds: CellBounds
  ): ParameterMetrics {
    // For bezier, the cell bounds represent the entire bezier editor
    // We use the same structure but the editor takes up the full cell
    const bezierEditorHeight = getCSSVariableAsNumber('bezier-editor-height', 200);
    const cellPadding = getCSSVariableAsNumber('param-cell-padding', 12);
    
    return {
      cellX: cellBounds.x,
      cellY: cellBounds.y,
      cellWidth: cellBounds.width,
      cellHeight: bezierEditorHeight, // Use bezier editor height
      portX: cellBounds.x + cellPadding,
      portY: cellBounds.y + bezierEditorHeight / 2, // Will be adjusted per parameter
      labelX: cellBounds.x + cellBounds.width / 2,
      labelY: cellBounds.y + cellPadding,
      knobX: cellBounds.x + cellBounds.width / 2, // Editor center
      knobY: cellBounds.y + bezierEditorHeight / 2, // Editor center
      valueX: cellBounds.x + cellBounds.width / 2,
      valueY: cellBounds.y + bezierEditorHeight
    };
  }
}

/**
 * Knob Parameter Renderer
 * 
 * Renders parameters as rotary knobs (default parameter UI type).
 */

import { ParameterRenderer, type ParameterMetrics, type CellBounds } from './ParameterRenderer';
import type { NodeSpec, ParameterSpec } from '../../../../types/nodeSpec';
import { getCSSVariableAsNumber } from '../../../../utils/cssTokens';

export class KnobParameterRenderer extends ParameterRenderer {
  getUIType(): string {
    return 'knob';
  }
  
  canHandle(_spec: NodeSpec, _paramName: string): boolean {
    // Knob is the default renderer, so it handles everything
    // unless another renderer claims it first (lower priority)
    return true;
  }
  
  getPriority(): number {
    return 0; // Lowest priority - checked last
  }
  
  calculateMetrics(
    _paramName: string,
    _paramSpec: ParameterSpec,
    cellBounds: CellBounds
  ): ParameterMetrics {
    const cellPadding = getCSSVariableAsNumber('param-cell-padding', 12);
    const labelFontSize = getCSSVariableAsNumber('param-label-font-size', 18);
    const extraSpacing = getCSSVariableAsNumber('param-label-knob-spacing', 20);
    const knobSize = getCSSVariableAsNumber('knob-size', 45);
    const valueSpacing = getCSSVariableAsNumber('knob-value-spacing', 4);
    
    // Calculate label position
    const labelX = cellBounds.x + cellBounds.width / 2;
    const labelY = cellBounds.y + cellPadding;
    
    // Calculate port position (top-left, aligned with label)
    const portX = cellBounds.x + cellPadding;
    // Port Y will be calculated during rendering based on actual label height
    
    // Calculate knob position (center horizontally, below label)
    const knobX = cellBounds.x + cellBounds.width / 2;
    const labelBottom = cellBounds.y + cellPadding + labelFontSize;
    const knobY = labelBottom + extraSpacing + knobSize / 2;
    
    // Calculate value display position (below knob)
    const valueX = knobX;
    const valueY = knobY + knobSize / 2 + valueSpacing;
    
    return {
      cellX: cellBounds.x,
      cellY: cellBounds.y,
      cellWidth: cellBounds.width,
      cellHeight: cellBounds.height,
      portX,
      portY: cellBounds.y + cellPadding + labelFontSize / 2, // Approximate, will be adjusted during render
      labelX,
      labelY,
      knobX,
      knobY,
      valueX,
      valueY
    };
  }
}

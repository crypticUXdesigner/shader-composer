/**
 * Input Parameter Renderer
 * 
 * Renders parameters as simple draggable input fields (no knob).
 * Used for parameters that should display just a number input instead of a rotary knob.
 */

import { ParameterRenderer, type ParameterMetrics, type CellBounds } from './ParameterRenderer';
import type { NodeSpec, ParameterSpec } from '../../../../types/nodeSpec';
import { getCSSVariableAsNumber } from '../../../../utils/cssTokens';

export class InputParameterRenderer extends ParameterRenderer {
  getUIType(): string {
    return 'input';
  }
  
  canHandle(_spec: NodeSpec, _paramName: string): boolean {
    // This renderer only handles parameters explicitly set to 'input' via parameterUI
    // It should not be selected automatically, only when explicitly requested
    return false;
  }
  
  getPriority(): number {
    return 40; // Lower than toggle/enum, but higher than knob
  }
  
  calculateMetrics(
    _paramName: string,
    _paramSpec: ParameterSpec,
    cellBounds: CellBounds
  ): ParameterMetrics {
    const cellPadding = getCSSVariableAsNumber('param-cell-padding', 12);
    const labelFontSize = getCSSVariableAsNumber('param-label-font-size', 18);
    const labelInputSpacing = getCSSVariableAsNumber('range-editor-param-label-spacing', 8);
    
    // Calculate label position
    const labelX = cellBounds.x + cellBounds.width / 2;
    const labelY = cellBounds.y + cellPadding;
    
    // Calculate port position (top-left, aligned with label)
    const portX = cellBounds.x + cellPadding;
    
    // Calculate input field position (where knob would be, but smaller)
    const labelBottom = cellBounds.y + cellPadding + labelFontSize;
    const inputFieldCenterY = labelBottom + labelInputSpacing;
    const inputFieldX = cellBounds.x + cellBounds.width / 2;
    
    // Value display is the same as input field (centered)
    const valueX = inputFieldX;
    const valueY = inputFieldCenterY;
    
    return {
      cellX: cellBounds.x,
      cellY: cellBounds.y,
      cellWidth: cellBounds.width,
      cellHeight: cellBounds.height,
      portX,
      portY: cellBounds.y + cellPadding + labelFontSize / 2, // Approximate, will be adjusted during render
      labelX,
      labelY,
      knobX: inputFieldX, // Input field center X (reusing knobX for positioning)
      knobY: inputFieldCenterY, // Input field center Y (reusing knobY for positioning)
      valueX,
      valueY
    };
  }
}

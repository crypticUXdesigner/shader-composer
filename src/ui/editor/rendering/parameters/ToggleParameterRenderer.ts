/**
 * Toggle Parameter Renderer
 * 
 * Renders boolean/int parameters (0/1) as toggle switches.
 */

import { ParameterRenderer, type ParameterMetrics, type CellBounds } from './ParameterRenderer';
import type { NodeSpec, ParameterSpec } from '../../../../types/nodeSpec';
import { getCSSVariableAsNumber } from '../../../../utils/cssTokens';

export class ToggleParameterRenderer extends ParameterRenderer {
  getUIType(): string {
    return 'toggle';
  }
  
  canHandle(spec: NodeSpec, paramName: string): boolean {
    // Toggle: single int parameter with min=0, max=1
    const param = spec.parameters[paramName];
    return param?.type === 'int' && param.min === 0 && param.max === 1;
  }
  
  getPriority(): number {
    return 50; // Higher than knob, lower than enum
  }
  
  calculateMetrics(
    _paramName: string,
    _paramSpec: ParameterSpec,
    cellBounds: CellBounds
  ): ParameterMetrics {
    const cellPadding = getCSSVariableAsNumber('param-cell-padding', 12);
    const labelFontSize = getCSSVariableAsNumber('param-label-font-size', 18);
    
    // Toggle is centered vertically in cell
    const toggleHeight = getCSSVariableAsNumber('toggle-height', 24);
    
    return {
      cellX: cellBounds.x,
      cellY: cellBounds.y,
      cellWidth: cellBounds.width,
      cellHeight: cellBounds.height,
      portX: cellBounds.x + cellPadding,
      portY: cellBounds.y + cellPadding + labelFontSize / 2,
      labelX: cellBounds.x + cellBounds.width / 2,
      labelY: cellBounds.y + cellPadding,
      knobX: cellBounds.x + cellBounds.width / 2, // Toggle center X
      knobY: cellBounds.y + cellBounds.height / 2, // Toggle center Y (vertically centered)
      valueX: cellBounds.x + cellBounds.width / 2,
      valueY: cellBounds.y + cellBounds.height / 2 + toggleHeight / 2 // Below toggle
    };
  }
}

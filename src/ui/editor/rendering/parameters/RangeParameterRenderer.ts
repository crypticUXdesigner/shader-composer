/**
 * Range Parameter Renderer
 * 
 * Renders range remap nodes with inMin, inMax, outMin, outMax, clamp parameters.
 * This renderer handles the slider UI and parameter grid together.
 */

import { ParameterRenderer, type ParameterMetrics, type CellBounds } from './ParameterRenderer';
import type { NodeSpec, ParameterSpec } from '../../../../types/nodeSpec';
import { getCSSVariableAsNumber } from '../../../../utils/cssTokens';

export class RangeParameterRenderer extends ParameterRenderer {
  getUIType(): string {
    return 'range';
  }
  
  canHandle(spec: NodeSpec, paramName: string): boolean {
    // Don't handle range parameters when using the layout system
    // The layout system uses RemapRangeElementRenderer for the remap range UI
    // and regular parameter renderers for the individual parameters
    if (spec.parameterLayout) {
      return false;
    }
    
    // Only handle range parameters (inMin, inMax, outMin, outMax)
    // We'll render the entire editor when called for inMin
    if (paramName !== 'inMin') return false;
    
    return (
      spec.parameters.inMin !== undefined &&
      spec.parameters.inMax !== undefined &&
      spec.parameters.outMin !== undefined &&
      spec.parameters.outMax !== undefined &&
      spec.parameters.inMin?.type === 'float' &&
      spec.parameters.inMax?.type === 'float' &&
      spec.parameters.outMin?.type === 'float' &&
      spec.parameters.outMax?.type === 'float'
    );
  }

  getPriority(): number {
    return 90; // High priority, but lower than bezier
  }
  
  calculateMetrics(
    _paramName: string,
    _paramSpec: ParameterSpec,
    cellBounds: CellBounds
  ): ParameterMetrics {
    // For range editor, the cell bounds represent the entire editor
    // (slider UI + parameter grid)
    const sliderUIHeight = getCSSVariableAsNumber('range-editor-height', 180);
    const gridGap = getCSSVariableAsNumber('param-grid-gap', 12);
    const rangeParamCellHeight = 120;
    const columns = 2;
    const allParams = ['inMax', 'outMax', 'inMin', 'outMin', 'clamp'];
    const rows = Math.ceil(allParams.length / columns);
    const paramGridHeight = rangeParamCellHeight * rows + gridGap * (rows - 1);
    const totalHeight = sliderUIHeight + gridGap + paramGridHeight;
    
    return {
      cellX: cellBounds.x,
      cellY: cellBounds.y,
      cellWidth: cellBounds.width,
      cellHeight: totalHeight,
      portX: cellBounds.x + getCSSVariableAsNumber('param-cell-padding', 12),
      portY: cellBounds.y + totalHeight / 2,
      labelX: cellBounds.x + cellBounds.width / 2,
      labelY: cellBounds.y + getCSSVariableAsNumber('param-cell-padding', 12),
      knobX: cellBounds.x + cellBounds.width / 2,
      knobY: cellBounds.y + sliderUIHeight / 2, // Center of slider UI
      valueX: cellBounds.x + cellBounds.width / 2,
      valueY: cellBounds.y + totalHeight
    };
  }
}

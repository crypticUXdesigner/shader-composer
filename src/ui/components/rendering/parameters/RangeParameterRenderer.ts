/**
 * Range Parameter Renderer
 * 
 * Renders range remap nodes with inMin, inMax, outMin, outMax, clamp parameters.
 * This renderer handles the slider UI and parameter grid together.
 */

import { ParameterRenderer, type ParameterMetrics, type ParameterRenderState, type CellBounds } from './ParameterRenderer';
import type { NodeInstance } from '../../../../types/nodeGraph';
import type { NodeSpec, ParameterSpec } from '../../../../types/nodeSpec';
import { getCSSColor, getCSSVariableAsNumber } from '../../../../utils/cssTokens';
import { drawRoundedRect } from '../RenderingUtils';
import { getParameterUIRegistry } from '../ParameterUIRegistry';

export class RangeParameterRenderer extends ParameterRenderer {
  getUIType(): string {
    return 'range';
  }
  
  canHandle(spec: NodeSpec, paramName: string): boolean {
    // Don't handle range parameters when using the layout system
    // The layout system uses SliderUIElementRenderer for the slider UI
    // and regular parameter renderers for the individual parameters
    if (spec.parameterLayout) {
      return false;
    }
    
    // Only handle range parameters (inMin, inMax, outMin, outMax)
    // We'll render the entire editor when called for inMin
    if (paramName !== 'inMin') return false;
    
    return this.isRangeEditorNode(spec);
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
  
  render(
    ctx: CanvasRenderingContext2D,
    node: NodeInstance,
    spec: NodeSpec,
    paramName: string,
    metrics: ParameterMetrics,
    state: ParameterRenderState
  ): void {
    // Only render when called for inMin (the first parameter)
    // This renders the entire range editor
    if (paramName !== 'inMin') return;
    
    const gridPadding = getCSSVariableAsNumber('node-body-padding', 18);
    const gridGap = getCSSVariableAsNumber('param-grid-gap', 12);
    const sliderUIHeight = getCSSVariableAsNumber('range-editor-height', 180);
    const rangeParamCellHeight = 120;
    
    // Get parameter values
    const inMin = (node.parameters.inMin ?? spec.parameters.inMin?.default ?? 0) as number;
    const inMax = (node.parameters.inMax ?? spec.parameters.inMax?.default ?? 1) as number;
    const outMin = (node.parameters.outMin ?? spec.parameters.outMin?.default ?? 0) as number;
    const outMax = (node.parameters.outMax ?? spec.parameters.outMax?.default ?? 1) as number;
    
    // Get parameter specs for min/max constraints
    const inMinSpec = spec.parameters.inMin;
    const inMaxSpec = spec.parameters.inMax;
    const outMinSpec = spec.parameters.outMin;
    const outMaxSpec = spec.parameters.outMax;
    const inMinValue = inMinSpec?.min ?? 0;
    const inMaxValue = inMaxSpec?.max ?? 1;
    const outMinValue = outMinSpec?.min ?? 0;
    const outMaxValue = outMaxSpec?.max ?? 1;
    
    // Calculate slider UI area
    const sliderUIX = metrics.cellX + gridPadding;
    const sliderUIY = metrics.cellY + gridPadding;
    const sliderUIWidth = metrics.cellWidth - gridPadding * 2;
    
    // Render slider UI
    this.renderSliderUI(
      ctx,
      sliderUIX,
      sliderUIY,
      sliderUIWidth,
      sliderUIHeight,
      inMin,
      inMax,
      outMin,
      outMax,
      inMinValue,
      inMaxValue,
      outMinValue,
      outMaxValue
    );
    
    // Calculate parameter grid area (below slider UI)
    const paramGridY = sliderUIY + sliderUIHeight + gridGap;
    const paramGridX = metrics.cellX + gridPadding;
    const paramGridWidth = metrics.cellWidth - gridPadding * 2;
    const columns = 2;
    const paramCellWidth = (paramGridWidth - gridGap) / columns;
    const allParams = ['inMax', 'outMax', 'inMin', 'outMin', 'clamp'];
    
    // Render parameter grid
    allParams.forEach((paramName, index) => {
      const row = Math.floor(index / columns);
      const col = index % columns;
      const paramCellX = paramGridX + col * (paramCellWidth + gridGap);
      const paramCellY = paramGridY + row * (rangeParamCellHeight + gridGap);
      
      const paramSpec = spec.parameters[paramName];
      if (!paramSpec) return;
      
      // Get renderer for this parameter (might be toggle for clamp, or knob for others)
      const registry = getParameterUIRegistry();
      const renderer = registry.getRenderer(spec, paramName);
      
      // Calculate metrics for this parameter cell
      const paramMetrics = renderer.calculateMetrics(
        paramName,
        paramSpec,
        {
          x: paramCellX,
          y: paramCellY,
          width: paramCellWidth,
          height: rangeParamCellHeight
        }
      );
      
      // Determine state for this parameter
      const isParamConnected = state.isConnected; // Would need to check actual connection state
      const isParamHovered = state.isHovered && paramName === 'inMin'; // Simplified
      const effectiveValue = null; // Would need to get from effectiveParameterValues
      
      // Render the parameter
      renderer.render(
        ctx,
        node,
        spec,
        paramName,
        paramMetrics,
        {
          isConnected: isParamConnected,
          isHovered: isParamHovered,
          effectiveValue,
          skipPorts: state.skipPorts
        }
      );
    });
  }
  
  private isRangeEditorNode(spec: NodeSpec): boolean {
    return spec.parameters.inMin !== undefined &&
           spec.parameters.inMax !== undefined &&
           spec.parameters.outMin !== undefined &&
           spec.parameters.outMax !== undefined &&
           spec.parameters.inMin?.type === 'float' &&
           spec.parameters.inMax?.type === 'float' &&
           spec.parameters.outMin?.type === 'float' &&
           spec.parameters.outMax?.type === 'float';
  }
  
  private renderSliderUI(
    ctx: CanvasRenderingContext2D,
    sliderUIX: number,
    sliderUIY: number,
    sliderUIWidth: number,
    sliderUIHeight: number,
    inMin: number,
    inMax: number,
    outMin: number,
    outMax: number,
    inMinValue: number,
    inMaxValue: number,
    outMinValue: number,
    outMaxValue: number
  ): void {
    const sliderUIPadding = 12;
    const editorBg = getCSSColor('range-editor-bg', getCSSColor('color-gray-20', '#020203'));
    const editorRadius = getCSSVariableAsNumber('range-editor-radius', 12);
    const editorPadding = getCSSVariableAsNumber('range-editor-padding', 12);
    const sliderBg = getCSSColor('range-editor-slider-bg', getCSSColor('color-gray-30', '#0a0b0d'));
    const sliderRadius = getCSSVariableAsNumber('range-editor-slider-radius', 30);
    const sliderTrackColor = getCSSColor('range-editor-slider-track-color', getCSSColor('color-gray-60', '#5a5f66'));
    const sliderInputActiveColor = getCSSColor('range-editor-slider-input-active-color', getCSSColor('color-green-90', '#6ee7b7'));
    const sliderOutputActiveColor = getCSSColor('range-editor-slider-output-active-color', getCSSColor('color-purple-90', '#8b5cf6'));
    const sliderWidth = getCSSVariableAsNumber('range-editor-slider-width', 18);
    const handleSize = getCSSVariableAsNumber('range-editor-handle-size', 12);
    const handleBg = getCSSColor('range-editor-handle-bg', getCSSColor('color-blue-90', '#6565dc'));
    const handleBorder = getCSSColor('range-editor-handle-border', getCSSColor('color-gray-130', '#ebeff0'));
    const connectionColor = getCSSColor('range-editor-connection-color', getCSSColor('color-blue-90', '#6565dc'));
    const connectionWidth = getCSSVariableAsNumber('range-editor-connection-width', 2);
    const connectionDash = getCSSVariableAsNumber('range-editor-connection-dash', 4);
    
    const sliderUIEditorX = sliderUIX + sliderUIPadding;
    const sliderUIEditorY = sliderUIY + sliderUIPadding;
    const sliderUIEditorWidth = sliderUIWidth - sliderUIPadding * 2;
    
    // Draw slider UI background
    ctx.fillStyle = editorBg;
    drawRoundedRect(ctx, sliderUIX, sliderUIY, sliderUIWidth, sliderUIHeight, editorRadius);
    ctx.fill();
    
    // Normalize values to 0-1 range for display
    const normalizeIn = (v: number) => (inMaxValue - inMinValue > 0) ? (v - inMinValue) / (inMaxValue - inMinValue) : 0;
    const normalizeOut = (v: number) => (outMaxValue - outMinValue > 0) ? (v - outMinValue) / (outMaxValue - outMinValue) : 0;
    const inMinNorm = Math.max(0, Math.min(1, normalizeIn(inMin)));
    const inMaxNorm = Math.max(0, Math.min(1, normalizeIn(inMax)));
    const outMinNorm = Math.max(0, Math.min(1, normalizeOut(outMin)));
    const outMaxNorm = Math.max(0, Math.min(1, normalizeOut(outMax)));
    
    // Calculate slider positions
    const topMargin = 12;
    const bottomMargin = 12;
    const sliderHeight = sliderUIHeight - sliderUIPadding * 2 - topMargin - bottomMargin;
    const inputSliderLeftEdge = sliderUIEditorX + editorPadding;
    const inputSliderCenter = inputSliderLeftEdge + sliderWidth / 2;
    const inputSliderRightEdge = inputSliderCenter + sliderWidth / 2;
    const outputSliderRightEdge = sliderUIEditorX + sliderUIEditorWidth - editorPadding;
    const outputSliderCenter = outputSliderRightEdge - sliderWidth / 2;
    const outputSliderLeftEdge = outputSliderCenter - sliderWidth / 2;
    const sliderY = sliderUIEditorY + topMargin;
    
    // Draw input range slider (vertical)
    this.drawVerticalRangeSlider(
      ctx,
      inputSliderCenter,
      sliderY,
      sliderWidth,
      sliderHeight,
      inMinNorm,
      inMaxNorm,
      sliderBg,
      sliderTrackColor,
      sliderInputActiveColor,
      handleSize,
      handleBg,
      handleBorder,
      sliderRadius,
      false,
      false
    );
    
    // Draw output range slider (vertical)
    this.drawVerticalRangeSlider(
      ctx,
      outputSliderCenter,
      sliderY,
      sliderWidth,
      sliderHeight,
      outMinNorm,
      outMaxNorm,
      sliderBg,
      sliderTrackColor,
      sliderOutputActiveColor,
      handleSize,
      handleBg,
      handleBorder,
      sliderRadius,
      false,
      false
    );
    
    // Draw connection lines and gradient fill
    const inputTopY = sliderY + (1 - inMaxNorm) * sliderHeight;
    const inputBottomY = sliderY + (1 - inMinNorm) * sliderHeight;
    const outputTopY = sliderY + (1 - outMaxNorm) * sliderHeight;
    const outputBottomY = sliderY + (1 - outMinNorm) * sliderHeight;
    
    const gradientX1 = inputSliderRightEdge;
    const gradientX2 = outputSliderLeftEdge;
    const areaGradient = ctx.createLinearGradient(gradientX1, 0, gradientX2, 0);
    areaGradient.addColorStop(0, sliderInputActiveColor);
    areaGradient.addColorStop(1, sliderOutputActiveColor);
    
    // Draw filled quadrilateral
    ctx.fillStyle = areaGradient;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(inputSliderRightEdge, inputTopY);
    ctx.lineTo(outputSliderLeftEdge, outputTopY);
    ctx.lineTo(outputSliderLeftEdge, outputBottomY);
    ctx.lineTo(inputSliderRightEdge, inputBottomY);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1.0;
    
    // Draw connection lines
    ctx.strokeStyle = connectionColor;
    ctx.lineWidth = connectionWidth;
    ctx.setLineDash([connectionDash, connectionDash]);
    ctx.globalAlpha = 0.5;
    this.drawArrow(ctx, inputSliderRightEdge, inputTopY, outputSliderLeftEdge, outputTopY, connectionColor, connectionWidth);
    this.drawArrow(ctx, inputSliderRightEdge, inputBottomY, outputSliderLeftEdge, outputBottomY, connectionColor, connectionWidth);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1.0;
  }
  
  private drawVerticalRangeSlider(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    minNorm: number,
    maxNorm: number,
    bgColor: string,
    trackColor: string,
    activeColor: string,
    _handleSize: number,
    _handleBg: string,
    _handleBorder: string,
    radius: number,
    isHovered: boolean = false,
    isDragging: boolean = false
  ): void {
    const trackX = x;
    const trackWidth = width;
    const trackLeft = trackX - trackWidth / 2;
    
    // Draw full slider track background
    ctx.fillStyle = bgColor;
    drawRoundedRect(ctx, trackLeft, y, trackWidth, height, radius);
    ctx.fill();
    
    // Draw track border
    ctx.strokeStyle = trackColor;
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, trackLeft, y, trackWidth, height, radius);
    ctx.stroke();
    
    // Draw active range
    const actualMinNorm = Math.min(minNorm, maxNorm);
    const actualMaxNorm = Math.max(minNorm, maxNorm);
    const activeTopY = y + (1 - actualMaxNorm) * height;
    const activeBottomY = y + (1 - actualMinNorm) * height;
    const activeHeight = Math.max(0, activeBottomY - activeTopY);
    if (activeHeight > 0) {
      ctx.fillStyle = activeColor;
      drawRoundedRect(ctx, trackLeft, activeTopY, trackWidth, activeHeight, radius);
      ctx.fill();
    }
    
    // Draw edge highlighting when hovering or dragging
    if (isHovered || isDragging) {
      const highlightWidth = 2;
      const highlightOpacity = 0.6;
      ctx.fillStyle = `rgba(255, 255, 255, ${highlightOpacity})`;
      ctx.fillRect(trackLeft, y, trackWidth, highlightWidth);
      ctx.fillRect(trackLeft, y + height - highlightWidth, trackWidth, highlightWidth);
    }
  }
  
  private drawArrow(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    width: number
  ): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    
    // Draw arrowhead
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const arrowSize = 6;
    const arrowX = x2 - Math.cos(angle) * arrowSize;
    const arrowY = y2 - Math.sin(angle) * arrowSize;
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(arrowX - Math.cos(angle - Math.PI / 6) * arrowSize, arrowY - Math.sin(angle - Math.PI / 6) * arrowSize);
    ctx.lineTo(arrowX - Math.cos(angle + Math.PI / 6) * arrowSize, arrowY - Math.sin(angle + Math.PI / 6) * arrowSize);
    ctx.closePath();
    ctx.fill();
  }
}

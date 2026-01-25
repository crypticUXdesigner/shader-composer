/**
 * Input Parameter Renderer
 * 
 * Renders parameters as simple draggable input fields (no knob).
 * Used for parameters that should display just a number input instead of a rotary knob.
 */

import { ParameterRenderer, type ParameterMetrics, type ParameterRenderState, type CellBounds } from './ParameterRenderer';
import type { NodeInstance } from '../../../../types/nodeGraph';
import type { NodeSpec, ParameterSpec } from '../../../../types/nodeSpec';
import { getCSSColor, getCSSColorRGBA, getCSSVariableAsNumber } from '../../../../utils/cssTokens';
import { drawRoundedRect } from '../RenderingUtils';

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
    const labelFontSize = getCSSVariableAsNumber('param-label-font-size', 11);
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
  
  render(
    ctx: CanvasRenderingContext2D,
    node: NodeInstance,
    spec: NodeSpec,
    paramName: string,
    metrics: ParameterMetrics,
    state: ParameterRenderState
  ): void {
    const paramSpec = spec.parameters[paramName];
    if (!paramSpec) return;
    
    const paramValue = (node.parameters[paramName] ?? paramSpec.default) as number;
    const displayValue = state.effectiveValue !== null ? state.effectiveValue : paramValue;
    
    // Render cell background
    this.renderCellBackground(ctx, metrics, state.isConnected);
    
    // Render port
    if (!state.skipPorts && (paramSpec.type === 'float' || paramSpec.type === 'int')) {
      // Calculate actual port Y based on label height
      const labelFontSize = getCSSVariableAsNumber('param-label-font-size', 11);
      const paramNameText = paramSpec.label || paramName;
      ctx.font = `${getCSSVariableAsNumber('param-label-font-weight', 400)} ${labelFontSize}px "Space Grotesk", sans-serif`;
      ctx.textBaseline = 'top';
      const labelTextMetrics = ctx.measureText(paramNameText);
      const actualTextHeight = labelTextMetrics.actualBoundingBoxAscent + labelTextMetrics.actualBoundingBoxDescent;
      const labelHeight = actualTextHeight > 0 ? actualTextHeight : labelFontSize;
      const portY = metrics.labelY + labelHeight / 2;
      
      const portSize = getCSSVariableAsNumber('param-port-size', 6);
      const portScale = portSize / getCSSVariableAsNumber('port-radius', 4);
      this.renderParameterPort(ctx, metrics.portX, portY, state.isHovered, portScale);
    }
    
    // Render label
    this.renderLabel(ctx, paramSpec.label || paramName, metrics.labelX, metrics.labelY);
    
    // Render mode button
    this.renderModeButton(ctx, node, paramName, paramSpec, metrics, state.isConnected);
    
    // Render input field (replaces knob)
    this.renderInputField(ctx, displayValue, paramSpec, metrics.knobX, metrics.knobY, state.effectiveValue !== null);
  }
  
  private renderCellBackground(
    ctx: CanvasRenderingContext2D,
    metrics: ParameterMetrics,
    isConnected: boolean
  ): void {
    const cellBg = getCSSColor('param-cell-bg', getCSSColor('color-gray-30', '#050507'));
    const cellBgConnectedRGBA = getCSSColorRGBA('param-cell-bg-connected', { r: 255, g: 255, b: 255, a: 0.5 });
    const cellBgConnected = `rgba(${cellBgConnectedRGBA.r}, ${cellBgConnectedRGBA.g}, ${cellBgConnectedRGBA.b}, ${cellBgConnectedRGBA.a})`;
    const cellBorderRadius = getCSSVariableAsNumber('param-cell-border-radius', 6);
    
    ctx.fillStyle = isConnected ? cellBgConnected : cellBg;
    drawRoundedRect(ctx, metrics.cellX, metrics.cellY, metrics.cellWidth, metrics.cellHeight, cellBorderRadius);
    ctx.fill();
    
    const borderColor = getCSSColor(
      isConnected ? 'param-cell-border-connected' : 'param-cell-border',
      getCSSColor('color-gray-70', '#282b31')
    );
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, metrics.cellX, metrics.cellY, metrics.cellWidth, metrics.cellHeight, cellBorderRadius);
    ctx.stroke();
  }
  
  private renderLabel(
    ctx: CanvasRenderingContext2D,
    label: string,
    x: number,
    y: number
  ): void {
    const labelFontSize = getCSSVariableAsNumber('param-label-font-size', 11);
    const labelFontWeight = getCSSVariableAsNumber('param-label-font-weight', 400);
    const labelColor = getCSSColor('param-label-color', getCSSColor('color-gray-110', '#a3aeb5'));
    
    ctx.font = `${labelFontWeight} ${labelFontSize}px "Space Grotesk", sans-serif`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    ctx.fillStyle = labelColor;
    ctx.fillText(label, x, y);
  }
  
  private renderModeButton(
    ctx: CanvasRenderingContext2D,
    node: NodeInstance,
    paramName: string,
    paramSpec: ParameterSpec,
    metrics: ParameterMetrics,
    isConnected: boolean
  ): void {
    const modeButtonSize = getCSSVariableAsNumber('param-mode-button-size', 20);
    const modeButtonX = metrics.portX; // Same X as port
    const modeButtonY = metrics.knobY; // Same Y as input field center
    
    const inputMode = node.parameterInputModes?.[paramName] || paramSpec.inputMode || 'override';
    const modeSymbol = inputMode === 'override' ? '=' : inputMode === 'add' ? '+' : inputMode === 'subtract' ? '-' : '*';
    
    const modeButtonBg = getCSSColor('param-mode-button-bg', getCSSColor('color-gray-50', '#111317'));
    ctx.fillStyle = modeButtonBg;
    ctx.beginPath();
    ctx.arc(modeButtonX, modeButtonY, modeButtonSize / 2, 0, Math.PI * 2);
    ctx.fill();
    
    const modeButtonColorToken = isConnected ? 'param-mode-button-color-connected' : 'param-mode-button-color-static';
    ctx.fillStyle = getCSSColor(modeButtonColorToken, isConnected ? getCSSColor('color-gray-130', '#ebeff0') : getCSSColor('color-gray-60', '#5a5f66'));
    const modeButtonFontSize = getCSSVariableAsNumber('param-mode-button-font-size', 10);
    const modeButtonFontWeight = getCSSVariableAsNumber('param-mode-button-font-weight', 400);
    const modeButtonTextOffsetY = getCSSVariableAsNumber('param-mode-button-text-offset-y', 0);
    ctx.font = `${modeButtonFontWeight} ${modeButtonFontSize}px "Space Grotesk", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(modeSymbol, modeButtonX, modeButtonY + modeButtonTextOffsetY);
  }
  
  private renderInputField(
    ctx: CanvasRenderingContext2D,
    value: number,
    paramSpec: ParameterSpec,
    x: number,
    y: number,
    isAnimated: boolean
  ): void {
    const valueFontSize = getCSSVariableAsNumber('knob-value-font-size', 11);
    const valueColor = getCSSColor('knob-value-color', getCSSColor('color-gray-130', '#ebeff0'));
    const valueDisplayColor = isAnimated 
      ? getCSSColor('node-param-value-animated-color', getCSSColor('color-teal-90', '#2f8a6b'))
      : valueColor;
    
    // Prepare font for text measurement
    ctx.font = `${valueFontSize}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const displayText = paramSpec.type === 'int' ? Math.round(value).toString() : value.toFixed(3);
    const textMetrics = ctx.measureText(displayText);
    const textWidth = textMetrics.width;
    const textHeight = valueFontSize;
    
    // Draw background (centered on y)
    const valueBg = getCSSColor('knob-value-bg', getCSSColor('color-gray-30', '#0a0b0d'));
    const valueRadius = getCSSVariableAsNumber('knob-value-radius', 4);
    const paddingH = getCSSVariableAsNumber('knob-value-padding-horizontal', 8);
    const paddingV = getCSSVariableAsNumber('knob-value-padding-vertical', 4);
    const bgX = x - textWidth / 2 - paddingH;
    const bgY = y - (textHeight / 2 + paddingV);
    const bgWidth = textWidth + paddingH * 2;
    const bgHeight = textHeight + paddingV * 2;
    ctx.fillStyle = valueBg;
    drawRoundedRect(ctx, bgX, bgY, bgWidth, bgHeight, valueRadius);
    ctx.fill();
    
    // Draw text (centered on y)
    ctx.fillStyle = valueDisplayColor;
    ctx.fillText(displayText, x, y);
    
    // Reset text alignment
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
  
  private renderParameterPort(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    isHovered: boolean,
    scale: number
  ): void {
    // Draw highlight first (behind)
    this.renderPortHighlight(ctx, x, y, isHovered, false, scale, 1.0);
    // Draw port circle on top
    this.renderPortCircle(ctx, x, y, 'float', isHovered, false, scale, 1.0);
  }
  
  private renderPortHighlight(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    isHovered: boolean,
    isConnecting: boolean,
    scale: number,
    opacity: number
  ): void {
    if (!isHovered && !isConnecting) return;
    
    const radius = getCSSVariableAsNumber('port-radius', 4) * scale;
    const highlightRadius = radius * 3.5;
    
    if (isConnecting) {
      const draggingColorRGBA = getCSSColorRGBA('port-dragging-color', { r: 0, g: 255, b: 136, a: 1 });
      const draggingOuterOpacity = getCSSVariableAsNumber('port-dragging-outer-opacity', 0.6);
      const actualOuterOpacity = draggingOuterOpacity * opacity;
      
      ctx.fillStyle = `rgba(${draggingColorRGBA.r}, ${draggingColorRGBA.g}, ${draggingColorRGBA.b}, ${actualOuterOpacity})`;
      ctx.beginPath();
      ctx.arc(x, y, highlightRadius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const hoverColorRGBA = getCSSColorRGBA('port-hover-color', { r: 33, g: 150, b: 243, a: 1 });
      const hoverOuterOpacity = getCSSVariableAsNumber('port-hover-outer-opacity', 0.3);
      const actualOuterOpacity = hoverOuterOpacity * opacity;
      
      ctx.fillStyle = `rgba(${hoverColorRGBA.r}, ${hoverColorRGBA.g}, ${hoverColorRGBA.b}, ${actualOuterOpacity})`;
      ctx.beginPath();
      ctx.arc(x, y, highlightRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  private renderPortCircle(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    type: string,
    isHovered: boolean,
    isConnecting: boolean,
    scale: number,
    opacity: number
  ): void {
    const radius = getCSSVariableAsNumber('port-radius', 4) * scale;
    const borderWidth = getCSSVariableAsNumber('port-border-width', 0);
    const borderColorRGBA = getCSSColorRGBA('port-border-color', { r: 255, g: 255, b: 255, a: 1 });
    
    const colorMap: Record<string, string> = {
      'float': 'port-color-float',
      'vec2': 'port-color-vec2',
      'vec3': 'port-color-vec3',
      'vec4': 'port-color-vec4'
    };
    const tokenName = colorMap[type] || 'port-color-default';
    const colorRGBA = getCSSColorRGBA(tokenName, { r: 102, g: 102, b: 102, a: 1 });
    
    if (isHovered || isConnecting) {
      if (isConnecting) {
        const draggingColorRGBA = getCSSColorRGBA('port-dragging-color', { r: 0, g: 255, b: 136, a: 1 });
        ctx.fillStyle = `rgba(${draggingColorRGBA.r}, ${draggingColorRGBA.g}, ${draggingColorRGBA.b}, ${opacity})`;
      } else {
        const hoverColorRGBA = getCSSColorRGBA('port-hover-color', { r: 33, g: 150, b: 243, a: 1 });
        ctx.fillStyle = `rgba(${hoverColorRGBA.r}, ${hoverColorRGBA.g}, ${hoverColorRGBA.b}, ${opacity})`;
      }
    } else {
      ctx.fillStyle = `rgba(${colorRGBA.r}, ${colorRGBA.g}, ${colorRGBA.b}, ${opacity})`;
    }
    
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    
    if (borderWidth > 0) {
      ctx.strokeStyle = `rgba(${borderColorRGBA.r}, ${borderColorRGBA.g}, ${borderColorRGBA.b}, ${borderColorRGBA.a * opacity})`;
      ctx.lineWidth = borderWidth;
      ctx.beginPath();
      ctx.arc(x, y, radius + borderWidth / 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

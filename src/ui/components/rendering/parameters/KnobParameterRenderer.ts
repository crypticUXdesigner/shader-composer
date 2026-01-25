/**
 * Knob Parameter Renderer
 * 
 * Renders parameters as rotary knobs (default parameter UI type).
 */

import { ParameterRenderer, type ParameterMetrics, type ParameterRenderState, type CellBounds } from './ParameterRenderer';
import type { NodeInstance } from '../../../../types/nodeGraph';
import type { NodeSpec, ParameterSpec } from '../../../../types/nodeSpec';
import { getCSSColor, getCSSColorRGBA, getCSSVariableAsNumber } from '../../../../utils/cssTokens';
import { drawRoundedRect } from '../RenderingUtils';

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
    const labelFontSize = getCSSVariableAsNumber('param-label-font-size', 11);
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
    
    // Render knob
    const min = paramSpec.min ?? 0;
    const max = paramSpec.max ?? 1;
    const isAnimated = state.effectiveValue !== null;
    const knobSize = getCSSVariableAsNumber('knob-size', 45);
    this.renderRotaryKnob(ctx, metrics.knobX, metrics.knobY, knobSize, displayValue, min, max, isAnimated);
    
    // Render value display
    this.renderValueDisplay(ctx, displayValue, paramSpec.type, metrics.valueX, metrics.valueY, isAnimated);
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
    const modeButtonY = metrics.knobY; // Same Y as knob center
    
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
  
  private renderRotaryKnob(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    value: number,
    min: number,
    max: number,
    isAnimated: boolean = false
  ): void {
    const ringWidth = getCSSVariableAsNumber('knob-ring-width', 4);
    const ringColor = getCSSColor('knob-ring-color', getCSSColor('color-gray-70', '#282b31'));
    const ringActiveColorStatic = getCSSColor('knob-ring-active-color-static', getCSSColor('color-blue-90', '#6565dc'));
    const ringActiveColorAnimated = getCSSColor('knob-ring-active-color-animated', getCSSColor('color-leaf-100', '#6eab31'));
    const ringActiveColor = isAnimated ? ringActiveColorAnimated : ringActiveColorStatic;
    const markerSize = getCSSVariableAsNumber('knob-marker-size', 6);
    const markerColor = getCSSColor('knob-marker-color', getCSSColor('color-gray-130', '#ebeff0'));
    const markerRadiusOffset = getCSSVariableAsNumber('knob-marker-radius-offset', 0);
    const arcSweep = getCSSVariableAsNumber('knob-arc-sweep', 270);
    
    // Calculate the arc endpoints for top coverage
    // Start at top-right (135deg), end at top-left (45deg) going clockwise = 270deg
    const topStartDeg = 135; // top-right
    const topEndDeg = 45; // top-left
    const topStartRad = topStartDeg * (Math.PI / 180);
    const topEndRad = topEndDeg * (Math.PI / 180);
    
    // Convert value to normalized range (0 to 1)
    const normalized = (value - min) / (max - min); // 0 to 1
    
    const radius = size / 2 - ringWidth / 2;
    const markerRadius = radius + markerRadiusOffset; // Marker on separate radius
    
    // Set rounded line caps for the arc ends
    ctx.lineCap = 'round';
    
    // Draw full arc ring (background)
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = ringWidth;
    ctx.beginPath();
    ctx.arc(x, y, radius, topStartRad, topEndRad, false); // clockwise from 135deg to 45deg = 270deg
    ctx.stroke();
    
    // Draw value highlight segment
    if (normalized > 0) {
      ctx.strokeStyle = ringActiveColor;
      ctx.lineWidth = ringWidth;
      ctx.beginPath();
      const highlightEndDeg = (topStartDeg + (normalized * arcSweep)) % 360;
      const highlightEndRad = highlightEndDeg * (Math.PI / 180);
      ctx.arc(x, y, radius, topStartRad, highlightEndRad, false);
      ctx.stroke();
    }
    
    // Draw marker dot at value position
    const markerAngleDeg = (topStartDeg + (normalized * arcSweep)) % 360;
    const markerAngleRad = markerAngleDeg * (Math.PI / 180);
    const markerX = x + Math.cos(markerAngleRad) * markerRadius;
    const markerY = y + Math.sin(markerAngleRad) * markerRadius;
    ctx.fillStyle = markerColor;
    ctx.beginPath();
    ctx.arc(markerX, markerY, markerSize / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  
  private renderValueDisplay(
    ctx: CanvasRenderingContext2D,
    value: number,
    paramType: string,
    x: number,
    y: number,
    isAnimated: boolean
  ): void {
    const valueFontSize = getCSSVariableAsNumber('knob-value-font-size', 11);
    const valueColor = getCSSColor('knob-value-color', getCSSColor('color-gray-130', '#ebeff0'));
    const valueDisplayColor = isAnimated 
      ? getCSSColor('node-param-value-animated-color', getCSSColor('color-teal-90', '#2f8a6b'))
      : valueColor;
    
    ctx.font = `${valueFontSize}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const displayText = paramType === 'int' ? Math.round(value).toString() : value.toFixed(3);
    const textMetrics = ctx.measureText(displayText);
    const textWidth = textMetrics.width;
    const textHeight = valueFontSize;
    
    // Draw background
    const valueBg = getCSSColor('knob-value-bg', getCSSColor('color-gray-30', '#0a0b0d'));
    const valueRadius = getCSSVariableAsNumber('knob-value-radius', 4);
    const paddingH = getCSSVariableAsNumber('knob-value-padding-horizontal', 4);
    const paddingV = getCSSVariableAsNumber('knob-value-padding-vertical', 4);
    const bgX = x - textWidth / 2 - paddingH;
    const bgY = y;
    const bgWidth = textWidth + paddingH * 2;
    const bgHeight = textHeight + paddingV * 2;
    ctx.fillStyle = valueBg;
    drawRoundedRect(ctx, bgX, bgY, bgWidth, bgHeight, valueRadius);
    ctx.fill();
    
    // Draw text
    ctx.fillStyle = valueDisplayColor;
    ctx.fillText(displayText, x, y + paddingV);
    
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
    const highlightRadius = radius * 3.5; // Larger circle
    
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
    
    // Get base port color for normal state
    const colorMap: Record<string, string> = {
      'float': 'port-color-float',
      'vec2': 'port-color-vec2',
      'vec3': 'port-color-vec3',
      'vec4': 'port-color-vec4'
    };
    const tokenName = colorMap[type] || 'port-color-default';
    const colorRGBA = getCSSColorRGBA(tokenName, { r: 102, g: 102, b: 102, a: 1 });
    
    // Determine port color based on state
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
    
    // Draw the port circle
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw border if border width is greater than 0
    if (borderWidth > 0) {
      ctx.strokeStyle = `rgba(${borderColorRGBA.r}, ${borderColorRGBA.g}, ${borderColorRGBA.b}, ${borderColorRGBA.a * opacity})`;
      ctx.lineWidth = borderWidth;
      ctx.beginPath();
      ctx.arc(x, y, radius + borderWidth / 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

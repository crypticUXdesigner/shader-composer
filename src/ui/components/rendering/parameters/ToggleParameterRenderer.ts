/**
 * Toggle Parameter Renderer
 * 
 * Renders boolean/int parameters (0/1) as toggle switches.
 */

import { ParameterRenderer, type ParameterMetrics, type ParameterRenderState, type CellBounds } from './ParameterRenderer';
import type { NodeInstance } from '../../../../types/nodeGraph';
import type { NodeSpec, ParameterSpec } from '../../../../types/nodeSpec';
import { getCSSColor, getCSSVariableAsNumber } from '../../../../utils/cssTokens';
import { drawRoundedRect } from '../RenderingUtils';

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
    const labelFontSize = getCSSVariableAsNumber('param-label-font-size', 11);
    
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
    const isOn = paramValue === 1;
    
    // Render cell background
    this.renderCellBackground(ctx, metrics, state.isConnected);
    
    // Render port (only for int type, and only if not skipping)
    if (!state.skipPorts && paramSpec.type === 'int') {
      const portSize = getCSSVariableAsNumber('param-port-size', 6);
      const portScale = portSize / getCSSVariableAsNumber('port-radius', 4);
      // Calculate actual port Y based on label height
      const labelFontSize = getCSSVariableAsNumber('param-label-font-size', 11);
      const paramNameText = paramSpec.label || paramName;
      ctx.font = `${getCSSVariableAsNumber('param-label-font-weight', 400)} ${labelFontSize}px "Space Grotesk", sans-serif`;
      ctx.textBaseline = 'top';
      const labelTextMetrics = ctx.measureText(paramNameText);
      const actualTextHeight = labelTextMetrics.actualBoundingBoxAscent + labelTextMetrics.actualBoundingBoxDescent;
      const labelHeight = actualTextHeight > 0 ? actualTextHeight : labelFontSize;
      const portY = metrics.labelY + labelHeight / 2;
      
      this.renderParameterPort(ctx, metrics.portX, portY, state.isHovered, portScale);
    }
    
    // Render label
    this.renderLabel(ctx, paramSpec.label || paramName, metrics.labelX, metrics.labelY);
    
    // Render toggle switch
    this.renderToggle(ctx, metrics.knobX, metrics.knobY, isOn, state.isHovered);
  }
  
  private renderCellBackground(
    ctx: CanvasRenderingContext2D,
    metrics: ParameterMetrics,
    isConnected: boolean
  ): void {
    const cellBg = getCSSColor('param-cell-bg', getCSSColor('color-gray-30', '#050507'));
    const cellBgConnectedRGBA = getCSSColor('param-cell-bg-connected', getCSSColor('color-gray-30', '#050507'));
    // Note: cellBgConnected might be a string, not RGBA - need to check original implementation
    const cellBgConnected = typeof cellBgConnectedRGBA === 'string' 
      ? cellBgConnectedRGBA 
      : `rgba(255, 255, 255, 0.5)`;
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
  
  private renderToggle(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    isOn: boolean,
    isHovered: boolean
  ): void {
    const toggleWidth = getCSSVariableAsNumber('toggle-width', 48);
    const toggleHeight = getCSSVariableAsNumber('toggle-height', 24);
    const toggleRadius = getCSSVariableAsNumber('toggle-border-radius', 12);
    const toggleBorder = getCSSColor('toggle-border', getCSSColor('color-gray-70', '#282b31'));
    const toggleBg = isOn 
      ? getCSSColor('toggle-bg-on', getCSSColor('color-blue-90', '#6565dc'))
      : (isHovered 
        ? getCSSColor('toggle-bg-hover', getCSSColor('color-gray-70', '#282b31'))
        : getCSSColor('toggle-bg-off', getCSSColor('color-gray-50', '#1a1c20')));
    const sliderSize = getCSSVariableAsNumber('toggle-slider-size', 20);
    const sliderOffset = getCSSVariableAsNumber('toggle-slider-offset', 2);
    const sliderBg = getCSSColor('toggle-slider-bg', getCSSColor('color-gray-130', '#ebeff0'));
    const sliderBorder = getCSSColor('toggle-slider-border', getCSSColor('color-gray-100', '#747e87'));
    
    // Position toggle (centerX, centerY is the center of the toggle)
    const toggleX = centerX - toggleWidth / 2;
    const toggleY = centerY - toggleHeight / 2;
    
    // Draw toggle background
    ctx.fillStyle = toggleBg;
    drawRoundedRect(ctx, toggleX, toggleY, toggleWidth, toggleHeight, toggleRadius);
    ctx.fill();
    
    // Draw toggle border
    ctx.strokeStyle = toggleBorder;
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, toggleX, toggleY, toggleWidth, toggleHeight, toggleRadius);
    ctx.stroke();
    
    // Calculate slider position
    const sliderRadius = sliderSize / 2;
    const sliderY = toggleY + toggleHeight / 2;
    const sliderX = isOn 
      ? toggleX + toggleWidth - sliderRadius - sliderOffset
      : toggleX + sliderRadius + sliderOffset;
    
    // Draw slider
    ctx.fillStyle = sliderBg;
    ctx.beginPath();
    ctx.arc(sliderX, sliderY, sliderRadius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = sliderBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(sliderX, sliderY, sliderRadius, 0, Math.PI * 2);
    ctx.stroke();
    
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
      const draggingColorRGBA = getCSSColor('port-dragging-color', getCSSColor('color-gray-30', '#050507'));
      // Handle both string and RGBA color formats
      const draggingOuterOpacity = getCSSVariableAsNumber('port-dragging-outer-opacity', 0.6);
      const actualOuterOpacity = draggingOuterOpacity * opacity;
      
      // Try to extract RGBA values if it's a string like "rgba(0, 255, 136, 1)"
      let r = 0, g = 255, b = 136;
      if (typeof draggingColorRGBA === 'string' && draggingColorRGBA.startsWith('rgba')) {
        const match = draggingColorRGBA.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) {
          r = parseInt(match[1]);
          g = parseInt(match[2]);
          b = parseInt(match[3]);
        }
      }
      
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${actualOuterOpacity})`;
      ctx.beginPath();
      ctx.arc(x, y, highlightRadius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const hoverColorRGBA = getCSSColor('port-hover-color', getCSSColor('color-gray-30', '#050507'));
      const hoverOuterOpacity = getCSSVariableAsNumber('port-hover-outer-opacity', 0.3);
      const actualOuterOpacity = hoverOuterOpacity * opacity;
      
      let r = 33, g = 150, b = 243;
      if (typeof hoverColorRGBA === 'string' && hoverColorRGBA.startsWith('rgba')) {
        const match = hoverColorRGBA.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) {
          r = parseInt(match[1]);
          g = parseInt(match[2]);
          b = parseInt(match[3]);
        }
      }
      
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${actualOuterOpacity})`;
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
    
    // Get base port color
    const colorMap: Record<string, string> = {
      'float': 'port-color-float',
      'vec2': 'port-color-vec2',
      'vec3': 'port-color-vec3',
      'vec4': 'port-color-vec4'
    };
    const tokenName = colorMap[type] || 'port-color-default';
    const baseColor = getCSSColor(tokenName, getCSSColor('color-gray-60', '#666666'));
    
    // Determine port color based on state
    if (isHovered || isConnecting) {
      if (isConnecting) {
        const draggingColor = getCSSColor('port-dragging-color', getCSSColor('color-teal-90', '#00ff88'));
        ctx.fillStyle = draggingColor;
      } else {
        const hoverColor = getCSSColor('port-hover-color', getCSSColor('color-blue-90', '#2196f3'));
        ctx.fillStyle = hoverColor;
      }
    } else {
      ctx.fillStyle = baseColor;
    }
    
    // Apply opacity if needed
    if (opacity < 1 && ctx.fillStyle.startsWith('rgba')) {
      // Already has alpha
    } else if (opacity < 1) {
      // Convert to rgba
      const match = ctx.fillStyle.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (match) {
        ctx.fillStyle = `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${opacity})`;
      }
    }
    
    // Draw the port circle
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw border if needed
    if (borderWidth > 0) {
      const borderColor = getCSSColor('port-border-color', getCSSColor('color-gray-130', '#ffffff'));
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderWidth;
      ctx.beginPath();
      ctx.arc(x, y, radius + borderWidth / 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

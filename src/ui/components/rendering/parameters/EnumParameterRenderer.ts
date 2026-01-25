/**
 * Enum Parameter Renderer
 * 
 * Renders int parameters with known enum mappings as dropdown selectors.
 */

import { ParameterRenderer, type ParameterMetrics, type ParameterRenderState, type CellBounds } from './ParameterRenderer';
import type { NodeInstance } from '../../../../types/nodeGraph';
import type { NodeSpec, ParameterSpec } from '../../../../types/nodeSpec';
import { getCSSColor, getCSSColorRGBA, getCSSVariableAsNumber } from '../../../../utils/cssTokens';
import { drawRoundedRect } from '../RenderingUtils';

export class EnumParameterRenderer extends ParameterRenderer {
  getUIType(): string {
    return 'enum';
  }
  
  canHandle(spec: NodeSpec, paramName: string): boolean {
    // Enum: single int parameter with min/max, reasonable option count, and known enum pattern
    const param = spec.parameters[paramName];
    if (!param || param.type !== 'int') return false;
    if (param.min === undefined || param.max === undefined) return false;
    
    // Reasonable limit for dropdown (max 15 options)
    const optionCount = param.max - param.min + 1;
    if (optionCount > 15) return false;
    
    // Check if it's a known enum pattern
    return this.isKnownEnumPattern(spec.id, paramName);
  }
  
  getPriority(): number {
    return 60; // Higher than toggle, lower than bezier/range
  }
  
  calculateMetrics(
    _paramName: string,
    _paramSpec: ParameterSpec,
    cellBounds: CellBounds
  ): ParameterMetrics {
    const cellPadding = getCSSVariableAsNumber('param-cell-padding', 12);
    const labelFontSize = getCSSVariableAsNumber('param-label-font-size', 11);
    const selectorHeight = getCSSVariableAsNumber('enum-selector-height', 32);
    const selectorSpacing = getCSSVariableAsNumber('param-label-knob-spacing', 20);
    
    return {
      cellX: cellBounds.x,
      cellY: cellBounds.y,
      cellWidth: cellBounds.width,
      cellHeight: cellBounds.height,
      portX: cellBounds.x + cellPadding,
      portY: cellBounds.y + cellPadding + labelFontSize / 2,
      labelX: cellBounds.x + cellBounds.width / 2,
      labelY: cellBounds.y + cellPadding,
      knobX: cellBounds.x + cellBounds.width / 2,
      knobY: cellBounds.y + cellPadding + labelFontSize + selectorSpacing + selectorHeight / 2,
      valueX: cellBounds.x + cellBounds.width / 2,
      valueY: cellBounds.y + cellPadding + labelFontSize + selectorSpacing + selectorHeight
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
    
    // Render enum selector
    this.renderEnumSelector(ctx, spec, paramName, paramValue, metrics, state.isHovered);
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
  
  private renderEnumSelector(
    ctx: CanvasRenderingContext2D,
    spec: NodeSpec,
    paramName: string,
    paramValue: number,
    metrics: ParameterMetrics,
    isHovered: boolean
  ): void {
    const cellPadding = getCSSVariableAsNumber('param-cell-padding', 12);
    const labelFontSize = getCSSVariableAsNumber('param-label-font-size', 11);
    const selectorHeight = getCSSVariableAsNumber('enum-selector-height', 32);
    const selectorSpacing = getCSSVariableAsNumber('param-label-knob-spacing', 20);
    const selectorBg = isHovered 
      ? getCSSColor('enum-selector-bg-hover', getCSSColor('color-gray-50', '#1a1c20'))
      : getCSSColor('enum-selector-bg', getCSSColor('color-gray-30', '#0a0b0d'));
    const selectorBorder = getCSSColor('enum-selector-border', getCSSColor('color-gray-70', '#282b31'));
    const selectorRadius = getCSSVariableAsNumber('enum-selector-radius', 6);
    const selectorPadding = getCSSVariableAsNumber('enum-selector-padding', 8);
    const selectorFontSize = getCSSVariableAsNumber('enum-selector-font-size', 13);
    const selectorFontWeight = getCSSVariableAsNumber('enum-selector-font-weight', 500);
    const selectorColor = getCSSColor('enum-selector-color', getCSSColor('color-gray-130', '#ebeff0'));
    const arrowSize = getCSSVariableAsNumber('enum-selector-arrow-size', 8);
    const arrowColor = getCSSColor('enum-selector-arrow-color', getCSSColor('color-gray-100', '#747e87'));
    
    // Position selector below label
    const labelBottom = metrics.labelY + labelFontSize;
    const selectorY = labelBottom + selectorSpacing;
    const selectorX = metrics.cellX + cellPadding;
    const selectorWidth = metrics.cellWidth - cellPadding * 2;
    
    // Draw selector background
    ctx.fillStyle = selectorBg;
    drawRoundedRect(ctx, selectorX, selectorY, selectorWidth, selectorHeight, selectorRadius);
    ctx.fill();
    
    // Draw selector border
    ctx.strokeStyle = selectorBorder;
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, selectorX, selectorY, selectorWidth, selectorHeight, selectorRadius);
    ctx.stroke();
    
    // Get current label
    const enumMappings = this.getEnumMappings(spec.id, paramName);
    const currentLabel = enumMappings?.[paramValue] ?? paramValue.toString();
    
    // Draw label text
    ctx.font = `${selectorFontWeight} ${selectorFontSize}px "Space Grotesk", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = selectorColor;
    const textX = selectorX + selectorPadding;
    const textY = selectorY + selectorHeight / 2;
    ctx.fillText(currentLabel, textX, textY);
    
    // Draw dropdown arrow (right side)
    const arrowX = selectorX + selectorWidth - selectorPadding - arrowSize;
    const arrowY = selectorY + selectorHeight / 2;
    ctx.fillStyle = arrowColor;
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowY - arrowSize / 2);
    ctx.lineTo(arrowX + arrowSize, arrowY - arrowSize / 2);
    ctx.lineTo(arrowX + arrowSize / 2, arrowY + arrowSize / 2);
    ctx.closePath();
    ctx.fill();
    
    // Reset text alignment
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
  
  private isKnownEnumPattern(nodeId: string, paramName: string): boolean {
    const enumMappings = this.getEnumMappings(nodeId, paramName);
    return enumMappings !== null;
  }
  
  private getEnumMappings(nodeId: string, paramName: string): Record<number, string> | null {
    // compare node - operation
    if (nodeId === 'compare' && paramName === 'operation') {
      return {
        0: 'Equal (==)',
        1: 'Not Equal (!=)',
        2: 'Less Than (<)',
        3: 'Less or Equal (<=)',
        4: 'Greater Than (>)',
        5: 'Greater or Equal (>=)'
      };
    }
    
    // blend-mode node - mode
    if (nodeId === 'blend-mode' && paramName === 'mode') {
      return {
        0: 'Normal',
        1: 'Multiply',
        2: 'Screen',
        3: 'Overlay',
        4: 'Soft Light',
        5: 'Hard Light',
        6: 'Color Dodge',
        7: 'Color Burn',
        8: 'Linear Dodge',
        9: 'Linear Burn',
        10: 'Difference',
        11: 'Exclusion'
      };
    }
    
    // gradient-mask node - maskType
    if (nodeId === 'gradient-mask' && paramName === 'maskType') {
      return {
        0: 'Radial',
        1: 'Linear',
        2: 'Elliptical'
      };
    }
    
    // block-edge-brightness node - direction
    if (nodeId === 'block-edge-brightness' && paramName === 'direction') {
      return {
        0: 'Horizontal',
        1: 'Vertical'
      };
    }
    
    // block-color-glitch node - direction
    if (nodeId === 'block-color-glitch' && paramName === 'direction') {
      return {
        0: 'Horizontal',
        1: 'Vertical'
      };
    }
    
    // plane-grid node - planeType
    if (nodeId === 'plane-grid' && paramName === 'planeType') {
      return {
        0: 'Raymarched',
        1: 'Grid',
        2: 'Checkerboard'
      };
    }
    
    // box-torus-sdf node - primitiveType
    if (nodeId === 'box-torus-sdf' && paramName === 'primitiveType') {
      return {
        0: 'Box',
        1: 'Torus',
        2: 'Capsule'
      };
    }
    
    return null;
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
      const draggingColor = getCSSColor('port-dragging-color', getCSSColor('color-teal-90', '#00ff88'));
      const draggingOuterOpacity = getCSSVariableAsNumber('port-dragging-outer-opacity', 0.6);
      const actualOuterOpacity = draggingOuterOpacity * opacity;
      
      // Extract RGB from color string if needed
      let r = 0, g = 255, b = 136;
      if (draggingColor.startsWith('rgba')) {
        const match = draggingColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
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
      const hoverColor = getCSSColor('port-hover-color', getCSSColor('color-blue-90', '#2196f3'));
      const hoverOuterOpacity = getCSSVariableAsNumber('port-hover-outer-opacity', 0.3);
      const actualOuterOpacity = hoverOuterOpacity * opacity;
      
      let r = 33, g = 150, b = 243;
      if (hoverColor.startsWith('rgba')) {
        const match = hoverColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
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
    _opacity: number
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
        ctx.fillStyle = getCSSColor('port-dragging-color', getCSSColor('color-teal-90', '#00ff88'));
      } else {
        ctx.fillStyle = getCSSColor('port-hover-color', getCSSColor('color-blue-90', '#2196f3'));
      }
    } else {
      ctx.fillStyle = baseColor;
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

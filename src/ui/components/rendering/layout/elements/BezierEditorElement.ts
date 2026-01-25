/**
 * Bezier Editor Element Renderer
 * 
 * Bezier curve editor for bezier curve nodes.
 */

import type { NodeInstance } from '../../../../../types/nodeGraph';
import type { NodeSpec, BezierEditorElement as BezierEditorElementType } from '../../../../../types/nodeSpec';
import type { NodeRenderMetrics } from '../../../NodeRenderer';
import type { LayoutElementRenderer, ElementMetrics } from '../LayoutElementRenderer';
import { getCSSVariableAsNumber, getCSSColor } from '../../../../../utils/cssTokens';
import { drawRoundedRect } from '../../RenderingUtils';

export class BezierEditorElementRenderer implements LayoutElementRenderer {
  private ctx: CanvasRenderingContext2D;
  
  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }
  
  canHandle(element: any): boolean {
    return element.type === 'bezier-editor';
  }
  
  calculateMetrics(
    element: BezierEditorElementType,
    node: NodeInstance,
    _spec: NodeSpec,
    availableWidth: number,
    startY: number,
    metrics: NodeRenderMetrics
  ): ElementMetrics {
    const defaultHeight = getCSSVariableAsNumber('bezier-editor-height', 200);
    const height = element.height ?? defaultHeight;
    const gridPadding = getCSSVariableAsNumber('node-body-padding', 18);
    const bezierPortSpacing = getCSSVariableAsNumber('bezier-param-port-spacing', 40);
    const portSize = getCSSVariableAsNumber('param-port-size', 6);
    const modeButtonSize = getCSSVariableAsNumber('param-mode-button-size', 24);
    const portLabelSpacing = getCSSVariableAsNumber('port-label-spacing', 12);
    
    // Default parameters if not specified
    const params = element.parameters || ['x1', 'y1', 'x2', 'y2'];
    
    // Calculate left edge space for ports, mode buttons, type labels, and name labels
    const portX = node.position.x + gridPadding;
    const portToModeSpacing = portLabelSpacing;
    const modeButtonX = portX + portSize + portToModeSpacing;
    const modeToTypeSpacing = portLabelSpacing;
    const typeLabelX = modeButtonX + modeButtonSize + modeToTypeSpacing;
    const typeToNameSpacing = portLabelSpacing;
    const typeLabelWidth = 50; // Approximate
    const labelX = typeLabelX + typeLabelWidth + typeToNameSpacing;
    const labelWidth = 60; // Approximate
    const bezierEditorX = labelX + labelWidth;
    
    // Ensure bezier editor is within node bounds
    const maxBezierEditorX = node.position.x + metrics.width - gridPadding;
    const actualBezierEditorX = Math.min(bezierEditorX, maxBezierEditorX - 200);
    const bezierEditorWidth = Math.max(200, maxBezierEditorX - actualBezierEditorX);
    
    // Calculate port positions
    const basePortY = node.position.y + metrics.headerHeight + startY;
    const totalSpacing = (params.length - 1) * bezierPortSpacing;
    const startOffset = (height - totalSpacing) / 2;
    
    const parameterGridPositions = new Map<string, {
      cellX: number;
      cellY: number;
      cellWidth: number;
      cellHeight: number;
      knobX: number;
      knobY: number;
      portX: number;
      portY: number;
      labelX: number;
      labelY: number;
      valueX: number;
      valueY: number;
    }>();
    
    params.forEach((paramName, index) => {
      const portY = basePortY + startOffset + index * bezierPortSpacing;
      
      parameterGridPositions.set(paramName, {
        cellX: actualBezierEditorX,
        cellY: node.position.y + metrics.headerHeight + startY,
        cellWidth: bezierEditorWidth,
        cellHeight: height,
        knobX: 0,
        knobY: 0,
        portX: portX,
        portY: portY,
        labelX: labelX,
        labelY: portY,
        valueX: 0,
        valueY: 0
      });
    });
    
    return {
      x: node.position.x,
      y: node.position.y + metrics.headerHeight + startY,
      width: availableWidth,
      height: height,
      parameterGridPositions,
      // Additional bezier-specific metrics
      bezierEditorX: actualBezierEditorX,
      bezierEditorWidth: bezierEditorWidth,
      portX: portX,
      modeButtonX: modeButtonX,
      typeLabelX: typeLabelX,
      labelX: labelX
    };
  }
  
  render(
    _element: BezierEditorElementType,
    node: NodeInstance,
    spec: NodeSpec,
    elementMetrics: ElementMetrics,
    _nodeMetrics: NodeRenderMetrics,
    _renderState: any
  ): void {
    // Validate metrics
    if (!elementMetrics.y || !elementMetrics.height) {
      console.warn('Invalid bezier-editor element metrics, skipping render');
      return;
    }
    
    const bezierEditorX = (elementMetrics as any).bezierEditorX || elementMetrics.x;
    const bezierEditorY = elementMetrics.y;
    const bezierEditorWidth = (elementMetrics as any).bezierEditorWidth || elementMetrics.width;
    const bezierEditorHeight = elementMetrics.height;
    
    // Get parameter values
    const x1 = (node.parameters.x1 ?? spec.parameters.x1?.default ?? 0) as number;
    const y1 = (node.parameters.y1 ?? spec.parameters.y1?.default ?? 0) as number;
    const x2 = (node.parameters.x2 ?? spec.parameters.x2?.default ?? 1) as number;
    const y2 = (node.parameters.y2 ?? spec.parameters.y2?.default ?? 1) as number;
    
    // Bezier editor styling tokens
    const bezierEditorBg = getCSSColor('bezier-editor-bg', getCSSColor('color-gray-20', '#020203'));
    const bezierEditorBorder = getCSSColor('bezier-editor-border-color', getCSSColor('color-gray-70', '#282b31'));
    const bezierEditorRadius = getCSSVariableAsNumber('bezier-editor-radius', 8);
    const bezierEditorPadding = getCSSVariableAsNumber('bezier-editor-padding', 12);
    const gridColor = getCSSColor('bezier-editor-grid-color', getCSSColor('color-gray-60', '#5a5f66'));
    const gridLineWidth = getCSSVariableAsNumber('bezier-editor-grid-line-width', 1);
    const gridBorderColor = getCSSColor('bezier-editor-grid-border-color', getCSSColor('color-gray-70', '#282b31'));
    const gridBorderWidth = getCSSVariableAsNumber('bezier-editor-grid-border-width', 2);
    const curveColor = getCSSColor('bezier-editor-curve-color', getCSSColor('color-blue-90', '#6565dc'));
    const curveWidth = getCSSVariableAsNumber('bezier-editor-curve-width', 3);
    const controlPointSize = getCSSVariableAsNumber('bezier-editor-control-point-size', 8);
    const controlPointBg = getCSSColor('bezier-editor-control-point-bg', getCSSColor('color-blue-90', '#6565dc'));
    const controlPointBorder = getCSSColor('bezier-editor-control-point-border', getCSSColor('color-gray-130', '#ebeff0'));
    const controlPointHoverSize = getCSSVariableAsNumber('bezier-editor-control-point-hover-size', 12);
    const controlPointHoverBg = getCSSColor('bezier-editor-control-point-hover-bg', getCSSColor('color-blue-100', '#7a7aff'));
    const controlLineColor = getCSSColor('bezier-editor-control-line-color', getCSSColor('color-gray-80', '#4a5057'));
    const controlLineWidth = getCSSVariableAsNumber('bezier-editor-control-line-width', 1);
    const controlLineDash = getCSSVariableAsNumber('bezier-editor-control-line-dash', 4);
    
    // Draw editor background
    this.ctx.fillStyle = bezierEditorBg;
    drawRoundedRect(this.ctx, bezierEditorX, bezierEditorY, bezierEditorWidth, bezierEditorHeight, bezierEditorRadius);
    this.ctx.fill();
    
    // Draw border
    const borderOffset = gridBorderWidth / 2;
    const borderX = bezierEditorX + borderOffset;
    const borderY = bezierEditorY + borderOffset;
    const borderWidth_rect = bezierEditorWidth - gridBorderWidth;
    const borderHeight_rect = bezierEditorHeight - gridBorderWidth;
    const borderRadius = Math.max(0, bezierEditorRadius - borderOffset);
    
    this.ctx.strokeStyle = bezierEditorBorder;
    this.ctx.lineWidth = gridBorderWidth;
    drawRoundedRect(this.ctx, borderX, borderY, borderWidth_rect, borderHeight_rect, borderRadius);
    this.ctx.stroke();
    
    // Calculate drawing area (inside padding)
    const drawX = bezierEditorX + bezierEditorPadding;
    const drawY = bezierEditorY + bezierEditorPadding;
    const drawWidth = bezierEditorWidth - bezierEditorPadding * 2;
    const drawHeight = bezierEditorHeight - bezierEditorPadding * 2;
    
    // Draw grid
    this.ctx.strokeStyle = gridColor;
    this.ctx.lineWidth = gridLineWidth;
    const gridSteps = 4;
    for (let i = 1; i < gridSteps; i++) {
      const t = i / gridSteps;
      // Vertical lines
      this.ctx.beginPath();
      this.ctx.moveTo(drawX + t * drawWidth, drawY);
      this.ctx.lineTo(drawX + t * drawWidth, drawY + drawHeight);
      this.ctx.stroke();
      // Horizontal lines
      this.ctx.beginPath();
      this.ctx.moveTo(drawX, drawY + t * drawHeight);
      this.ctx.lineTo(drawX + drawWidth, drawY + t * drawHeight);
      this.ctx.stroke();
    }
    
    // Draw grid border
    this.ctx.strokeStyle = gridBorderColor;
    this.ctx.lineWidth = gridBorderWidth;
    this.ctx.beginPath();
    this.ctx.moveTo(drawX, drawY);
    this.ctx.lineTo(drawX + drawWidth, drawY);
    this.ctx.lineTo(drawX + drawWidth, drawY + drawHeight);
    this.ctx.lineTo(drawX, drawY + drawHeight);
    this.ctx.closePath();
    this.ctx.stroke();
    
    // Convert bezier control points to screen coordinates (flip Y for screen space)
    const cp1X = drawX + x1 * drawWidth;
    const cp1Y = drawY + (1 - y1) * drawHeight;
    const cp2X = drawX + x2 * drawWidth;
    const cp2Y = drawY + (1 - y2) * drawHeight;
    const startX = drawX;
    const startY = drawY + drawHeight;
    const endX = drawX + drawWidth;
    const endY = drawY;
    
    // Draw control lines (dashed)
    this.ctx.strokeStyle = controlLineColor;
    this.ctx.lineWidth = controlLineWidth;
    this.ctx.setLineDash([controlLineDash, controlLineDash]);
    // Line from start to cp1
    this.ctx.beginPath();
    this.ctx.moveTo(startX, startY);
    this.ctx.lineTo(cp1X, cp1Y);
    this.ctx.stroke();
    // Line from end to cp2
    this.ctx.beginPath();
    this.ctx.moveTo(endX, endY);
    this.ctx.lineTo(cp2X, cp2Y);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    
    // Draw bezier curve
    this.ctx.strokeStyle = curveColor;
    this.ctx.lineWidth = curveWidth;
    this.ctx.beginPath();
    this.ctx.moveTo(startX, startY);
    this.ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, endY);
    this.ctx.stroke();
    
    // Draw control points
    const controlPoints = [
      { x: cp1X, y: cp1Y, paramIndex: 0 },
      { x: cp2X, y: cp2Y, paramIndex: 2 }
    ];
    
    // TODO: Get hovered control point from render state
    const hoveredControlPoint: number | null = null;
    
    controlPoints.forEach((cp) => {
      const isHovered = hoveredControlPoint === cp.paramIndex;
      const size = isHovered ? controlPointHoverSize : controlPointSize;
      const bg = isHovered ? controlPointHoverBg : controlPointBg;
      
      // Draw control point
      this.ctx.fillStyle = bg;
      this.ctx.beginPath();
      this.ctx.arc(cp.x, cp.y, size / 2, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Draw border
      this.ctx.strokeStyle = controlPointBorder;
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    });
    
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'alphabetic';
  }
}

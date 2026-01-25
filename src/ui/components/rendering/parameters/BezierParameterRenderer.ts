/**
 * Bezier Parameter Renderer
 * 
 * Renders bezier curve nodes with x1, y1, x2, y2 parameters as a single bezier curve editor.
 * This renderer handles all 4 parameters together as one UI element.
 */

import { ParameterRenderer, type ParameterMetrics, type ParameterRenderState, type CellBounds } from './ParameterRenderer';
import type { NodeInstance } from '../../../../types/nodeGraph';
import type { NodeSpec, ParameterSpec } from '../../../../types/nodeSpec';
import { getCSSColor, getCSSVariableAsNumber } from '../../../../utils/cssTokens';
import { drawRoundedRect } from '../RenderingUtils';

export class BezierParameterRenderer extends ParameterRenderer {
  getUIType(): string {
    return 'bezier';
  }
  
  canHandle(spec: NodeSpec, paramName: string): boolean {
    // Don't handle bezier parameters when using the layout system
    // The layout system uses BezierEditorElementRenderer for the bezier editor
    // and regular parameter renderers for the individual parameters
    if (spec.parameterLayout) {
      return false;
    }
    
    // Only handle bezier parameters (x1, y1, x2, y2)
    // We'll render the entire editor when called for x1
    if (paramName !== 'x1') return false;
    
    return this.isBezierCurveNode(spec);
  }
  
  getPriority(): number {
    return 100; // Highest priority - checked first
  }
  
  calculateMetrics(
    _paramName: string,
    _paramSpec: ParameterSpec,
    cellBounds: CellBounds
  ): ParameterMetrics {
    // For bezier, the cell bounds represent the entire bezier editor
    // We use the same structure but the editor takes up the full cell
    const bezierEditorHeight = getCSSVariableAsNumber('bezier-editor-height', 200);
    const cellPadding = getCSSVariableAsNumber('param-cell-padding', 12);
    
    return {
      cellX: cellBounds.x,
      cellY: cellBounds.y,
      cellWidth: cellBounds.width,
      cellHeight: bezierEditorHeight, // Use bezier editor height
      portX: cellBounds.x + cellPadding,
      portY: cellBounds.y + bezierEditorHeight / 2, // Will be adjusted per parameter
      labelX: cellBounds.x + cellBounds.width / 2,
      labelY: cellBounds.y + cellPadding,
      knobX: cellBounds.x + cellBounds.width / 2, // Editor center
      knobY: cellBounds.y + bezierEditorHeight / 2, // Editor center
      valueX: cellBounds.x + cellBounds.width / 2,
      valueY: cellBounds.y + bezierEditorHeight
    };
  }
  
  render(
    ctx: CanvasRenderingContext2D,
    node: NodeInstance,
    spec: NodeSpec,
    paramName: string,
    metrics: ParameterMetrics,
    _state: ParameterRenderState
  ): void {
    // Only render when called for x1 (the first parameter)
    // This renders the entire bezier editor
    if (paramName !== 'x1') return;
    
    // Get all bezier parameter values
    const x1 = (node.parameters.x1 ?? spec.parameters.x1?.default ?? 0) as number;
    const y1 = (node.parameters.y1 ?? spec.parameters.y1?.default ?? 0) as number;
    const x2 = (node.parameters.x2 ?? spec.parameters.x2?.default ?? 1) as number;
    const y2 = (node.parameters.y2 ?? spec.parameters.y2?.default ?? 1) as number;
    
    // Render the bezier editor
    this.renderBezierEditor(
      ctx,
      metrics.cellX,
      metrics.cellY,
      metrics.cellWidth,
      metrics.cellHeight,
      x1,
      y1,
      x2,
      y2,
      null // hoveredControlPoint - would need to be passed from state
    );
  }
  
  private isBezierCurveNode(spec: NodeSpec): boolean {
    return spec.id === 'bezier-curve' || (
      spec.parameters.x1 !== undefined &&
      spec.parameters.y1 !== undefined &&
      spec.parameters.x2 !== undefined &&
      spec.parameters.y2 !== undefined &&
      spec.parameters.x1.type === 'float' &&
      spec.parameters.y1.type === 'float' &&
      spec.parameters.x2.type === 'float' &&
      spec.parameters.y2.type === 'float'
    );
  }
  
  private renderBezierEditor(
    ctx: CanvasRenderingContext2D,
    editorX: number,
    editorY: number,
    editorWidth: number,
    editorHeight: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    hoveredControlPoint: number | null
  ): void {
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
    ctx.fillStyle = bezierEditorBg;
    drawRoundedRect(ctx, editorX, editorY, editorWidth, editorHeight, bezierEditorRadius);
    ctx.fill();
    
    // Draw border - adjust coordinates to account for stroke being centered on path
    const borderOffset = gridBorderWidth / 2;
    const borderX = editorX + borderOffset;
    const borderY = editorY + borderOffset;
    const borderWidth_rect = editorWidth - gridBorderWidth;
    const borderHeight_rect = editorHeight - gridBorderWidth;
    const borderRadius = Math.max(0, bezierEditorRadius - borderOffset);
    
    ctx.strokeStyle = bezierEditorBorder;
    ctx.lineWidth = gridBorderWidth;
    drawRoundedRect(ctx, borderX, borderY, borderWidth_rect, borderHeight_rect, borderRadius);
    ctx.stroke();
    
    // Calculate drawing area (inside padding)
    const drawX = editorX + bezierEditorPadding;
    const drawY = editorY + bezierEditorPadding;
    const drawWidth = editorWidth - bezierEditorPadding * 2;
    const drawHeight = editorHeight - bezierEditorPadding * 2;
    
    // Draw grid
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = gridLineWidth;
    const gridSteps = 4;
    for (let i = 1; i < gridSteps; i++) {
      const t = i / gridSteps;
      // Vertical lines
      ctx.beginPath();
      ctx.moveTo(drawX + t * drawWidth, drawY);
      ctx.lineTo(drawX + t * drawWidth, drawY + drawHeight);
      ctx.stroke();
      // Horizontal lines
      ctx.beginPath();
      ctx.moveTo(drawX, drawY + t * drawHeight);
      ctx.lineTo(drawX + drawWidth, drawY + t * drawHeight);
      ctx.stroke();
    }
    
    // Draw grid border (all four edges)
    ctx.strokeStyle = gridBorderColor;
    ctx.lineWidth = gridBorderWidth;
    ctx.beginPath();
    // Top edge
    ctx.moveTo(drawX, drawY);
    ctx.lineTo(drawX + drawWidth, drawY);
    // Right edge
    ctx.lineTo(drawX + drawWidth, drawY + drawHeight);
    // Bottom edge
    ctx.lineTo(drawX, drawY + drawHeight);
    // Left edge (closes the rectangle)
    ctx.closePath();
    ctx.stroke();
    
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
    ctx.strokeStyle = controlLineColor;
    ctx.lineWidth = controlLineWidth;
    ctx.setLineDash([controlLineDash, controlLineDash]);
    // Line from start to cp1
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(cp1X, cp1Y);
    ctx.stroke();
    // Line from end to cp2
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(cp2X, cp2Y);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw bezier curve
    ctx.strokeStyle = curveColor;
    ctx.lineWidth = curveWidth;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, endY);
    ctx.stroke();
    
    // Draw control points
    const controlPoints = [
      { x: cp1X, y: cp1Y, paramIndex: 0 },
      { x: cp2X, y: cp2Y, paramIndex: 2 }
    ];
    
    controlPoints.forEach((cp) => {
      const isHovered = hoveredControlPoint === cp.paramIndex;
      const size = isHovered ? controlPointHoverSize : controlPointSize;
      const bg = isHovered ? controlPointHoverBg : controlPointBg;
      
      // Draw control point
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, size / 2, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw border
      ctx.strokeStyle = controlPointBorder;
      ctx.lineWidth = 2;
      ctx.stroke();
    });
    
    // Reset text alignment
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}

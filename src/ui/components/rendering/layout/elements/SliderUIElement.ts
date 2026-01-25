/**
 * Slider UI Element Renderer
 * 
 * Range editor slider UI (for remap nodes).
 * Maps to inMin, inMax, outMin, outMax parameters.
 */

import type { NodeInstance } from '../../../../../types/nodeGraph';
import type { NodeSpec, SliderUIElement as SliderUIElementType } from '../../../../../types/nodeSpec';
import type { NodeRenderMetrics } from '../../../NodeRenderer';
import type { LayoutElementRenderer, ElementMetrics } from '../LayoutElementRenderer';
import { getCSSVariableAsNumber, getCSSColor } from '../../../../../utils/cssTokens';
import { drawRoundedRect, drawVerticalRangeSlider, drawArrow } from '../../RenderingUtils';

export class SliderUIElementRenderer implements LayoutElementRenderer {
  private ctx: CanvasRenderingContext2D;
  
  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }
  
  canHandle(element: any): boolean {
    return element.type === 'slider-ui';
  }
  
  calculateMetrics(
    element: SliderUIElementType,
    node: NodeInstance,
    _spec: NodeSpec,
    availableWidth: number,
    startY: number,
    metrics: NodeRenderMetrics
  ): ElementMetrics {
    const defaultHeight = getCSSVariableAsNumber('range-editor-height', 180);
    const height = element.height ?? defaultHeight;
    
    const gridPadding = getCSSVariableAsNumber('node-body-padding', 18);
    
    return {
      x: node.position.x + gridPadding,
      y: node.position.y + metrics.headerHeight + startY,
      width: availableWidth,
      height: height,
      // Slider UI doesn't provide parameter positions - those come from grid element
      parameterGridPositions: new Map()
    };
  }
  
  render(
    _element: SliderUIElementType,
    node: NodeInstance,
    spec: NodeSpec,
    elementMetrics: ElementMetrics,
    _nodeMetrics: NodeRenderMetrics,
    _renderState: any
  ): void {
    // Validate metrics
    if (!elementMetrics.x || !elementMetrics.y || !elementMetrics.width || !elementMetrics.height) {
      console.warn('Invalid slider-ui element metrics, skipping render');
      return;
    }
    
    const sliderUIHeight = elementMetrics.height;
    const sliderUIPadding = 12;
    
    // Slider UI area coordinates (elementMetrics are already in absolute coordinates)
    const sliderUIX = elementMetrics.x; // Already includes gridPadding from calculateMetrics
    const sliderUIY = elementMetrics.y;
    const sliderUIWidth = elementMetrics.width;
    
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
    
    // Range editor tokens for slider UI
    const editorBg = getCSSColor('range-editor-bg', getCSSColor('color-gray-20', '#020203'));
    const editorRadius = getCSSVariableAsNumber('range-editor-radius', 12);
    const editorPadding = getCSSVariableAsNumber('range-editor-padding', 12);
    const sliderBg = getCSSColor('range-editor-slider-bg', getCSSColor('color-gray-30', '#0a0b0d'));
    const sliderRadius = getCSSVariableAsNumber('range-editor-slider-radius', 30);
    const sliderTrackColor = getCSSColor('range-editor-slider-track-color', getCSSColor('color-gray-60', '#5a5f66'));
    const sliderInputActiveColor = getCSSColor('range-editor-slider-input-active-color', getCSSColor('color-green-90', '#6ee7b7'));
    const sliderOutputActiveColor = getCSSColor('range-editor-slider-output-active-color', getCSSColor('color-purple-90', '#8b5cf6'));
    const sliderWidth = getCSSVariableAsNumber('range-editor-slider-width', 18);
    const connectionColor = getCSSColor('range-editor-connection-color', getCSSColor('color-blue-90', '#6565dc'));
    const connectionWidth = getCSSVariableAsNumber('range-editor-connection-width', 2);
    const connectionDash = getCSSVariableAsNumber('range-editor-connection-dash', 4);
    
    // === RENDER SLIDER UI ===
    const sliderUIEditorX = sliderUIX + sliderUIPadding;
    const sliderUIEditorY = sliderUIY + sliderUIPadding;
    const sliderUIEditorWidth = sliderUIWidth - sliderUIPadding * 2;
    
    // Draw slider UI background
    this.ctx.fillStyle = editorBg;
    drawRoundedRect(this.ctx, sliderUIX, sliderUIY, sliderUIWidth, sliderUIHeight, editorRadius);
    this.ctx.fill();
    
    // Normalize values to 0-1 range for display
    const normalizeIn = (v: number) => (inMaxValue - inMinValue > 0) ? (v - inMinValue) / (inMaxValue - inMinValue) : 0;
    const normalizeOut = (v: number) => (outMaxValue - outMinValue > 0) ? (v - outMinValue) / (outMaxValue - outMinValue) : 0;
    const inMinNorm = Math.max(0, Math.min(1, normalizeIn(inMin)));
    const inMaxNorm = Math.max(0, Math.min(1, normalizeIn(inMax)));
    const outMinNorm = Math.max(0, Math.min(1, normalizeOut(outMin)));
    const outMaxNorm = Math.max(0, Math.min(1, normalizeOut(outMax)));
    
    // Layout: Two vertical sliders side by side with space for connection
    const topMargin = 12;
    const bottomMargin = 12;
    
    // Calculate slider height
    const sliderHeight = sliderUIHeight - sliderUIPadding * 2 - topMargin - bottomMargin;
    
    // Calculate slider positions: input left-aligned, output right-aligned
    const inputSliderLeftEdge = sliderUIEditorX + editorPadding;
    const inputSliderCenter = inputSliderLeftEdge + sliderWidth / 2;
    const inputSliderRightEdge = inputSliderCenter + sliderWidth / 2;
    const outputSliderRightEdge = sliderUIEditorX + sliderUIEditorWidth - editorPadding;
    const outputSliderCenter = outputSliderRightEdge - sliderWidth / 2;
    const outputSliderLeftEdge = outputSliderCenter - sliderWidth / 2;
    const sliderY = sliderUIEditorY + topMargin;
    
    // Draw input range slider (vertical)
    drawVerticalRangeSlider(
      this.ctx,
      inputSliderCenter, sliderY, sliderWidth, sliderHeight,
      inMinNorm, inMaxNorm,
      sliderBg, sliderTrackColor, sliderInputActiveColor,
      sliderRadius,
      false, // isHovered
      false  // isDragging
    );
    
    // Draw output range slider (vertical)
    drawVerticalRangeSlider(
      this.ctx,
      outputSliderCenter, sliderY, sliderWidth, sliderHeight,
      outMinNorm, outMaxNorm,
      sliderBg, sliderTrackColor, sliderOutputActiveColor,
      sliderRadius,
      false, // isHovered
      false  // isDragging
    );
    
    // Draw connection lines between ranges
    const inputTopY = sliderY + (1 - inMaxNorm) * sliderHeight;
    const inputBottomY = sliderY + (1 - inMinNorm) * sliderHeight;
    const outputTopY = sliderY + (1 - outMaxNorm) * sliderHeight;
    const outputBottomY = sliderY + (1 - outMinNorm) * sliderHeight;
    
    // Draw gradient fill in the area between the sliders
    const gradientX1 = inputSliderRightEdge;
    const gradientX2 = outputSliderLeftEdge;
    
    const areaGradient = this.ctx.createLinearGradient(gradientX1, 0, gradientX2, 0);
    areaGradient.addColorStop(0, sliderInputActiveColor);
    areaGradient.addColorStop(1, sliderOutputActiveColor);
    
    // Draw filled quadrilateral
    this.ctx.fillStyle = areaGradient;
    this.ctx.globalAlpha = 0.3;
    this.ctx.beginPath();
    this.ctx.moveTo(inputSliderRightEdge, inputTopY);
    this.ctx.lineTo(outputSliderLeftEdge, outputTopY);
    this.ctx.lineTo(outputSliderLeftEdge, outputBottomY);
    this.ctx.lineTo(inputSliderRightEdge, inputBottomY);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.globalAlpha = 1.0;
    
    // Draw connection lines
    this.ctx.strokeStyle = connectionColor;
    this.ctx.lineWidth = connectionWidth;
    this.ctx.setLineDash([connectionDash, connectionDash]);
    this.ctx.globalAlpha = 0.5;
    
    // Connect top edges
    drawArrow(this.ctx, inputSliderRightEdge, inputTopY, outputSliderLeftEdge, outputTopY, connectionColor, connectionWidth);
    // Connect bottom edges
    drawArrow(this.ctx, inputSliderRightEdge, inputBottomY, outputSliderLeftEdge, outputBottomY, connectionColor, connectionWidth);
    
    this.ctx.setLineDash([]);
    this.ctx.globalAlpha = 1.0;
    
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'alphabetic';
  }
}

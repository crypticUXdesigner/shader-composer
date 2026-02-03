/**
 * Remap Range Element Renderer
 * 
 * Range editor slider UI (for remap nodes).
 * Maps to inMin, inMax, outMin, outMax parameters.
 * 
 * Uses flexbox container structure with absolute positioning for interactive elements.
 */

import type { NodeInstance } from '../../../../../types/nodeGraph';
import type { NodeSpec, RemapRangeElement as RemapRangeElementType } from '../../../../../types/nodeSpec';
import type { NodeRenderMetrics } from '../../../NodeRenderer';
import type { LayoutElementRenderer, ElementMetrics } from '../LayoutElementRenderer';
import { getCSSVariableAsNumber, getCSSColor } from '../../../../../utils/cssTokens';
import { drawRoundedRect, drawVerticalRangeSlider, drawArrow, drawValueBox } from '../../RenderingUtils';
import { calculateFlexboxLayout } from '../flexbox/FlexboxCalculator';
import type { FlexItem, FlexboxProperties } from '../flexbox/FlexboxTypes';

export class RemapRangeElementRenderer implements LayoutElementRenderer {
  private ctx: CanvasRenderingContext2D;
  
  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }
  
  canHandle(element: any): boolean {
    return element.type === 'remap-range';
  }
  
  calculateMetrics(
    _element: RemapRangeElementType,
    node: NodeInstance,
    _spec: NodeSpec,
    availableWidth: number,
    startY: number,
    metrics: NodeRenderMetrics
  ): ElementMetrics {
    // Column layout: padding, slider row, gap (= padding), input row, padding
    const padding = getCSSVariableAsNumber('remap-range-padding', 12);
    const gap = padding;
    const sliderRowHeight = getCSSVariableAsNumber('remap-range-slider-row-height', 228);
    const inputRowHeight = getCSSVariableAsNumber('remap-range-input-row-height', 30);
    const height = padding + sliderRowHeight + gap + inputRowHeight + padding;
    
    const gridPadding = getCSSVariableAsNumber('node-body-padding', 18);
    
    const containerX = node.position.x + gridPadding;
    const containerY = node.position.y + metrics.headerHeight + startY;
    
    const containerItems: FlexItem[] = [
      {
        id: 'slider-container',
        properties: {
          width: availableWidth,
          height
        }
      }
    ];
    
    const containerProps: FlexboxProperties = {
      direction: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 0
    };
    
    const containerLayout = calculateFlexboxLayout(
      containerX,
      containerY,
      availableWidth,
      height,
      containerProps,
      containerItems
    );
    
    const containerResult = containerLayout.items.get('slider-container');
    if (!containerResult || 'items' in containerResult) {
      return {
        x: containerX,
        y: containerY,
        width: availableWidth,
        height,
        parameterGridPositions: new Map()
      };
    }
    
    // No parameter ports for remap-range params (inMin, inMax, outMin, outMax)
    return {
      x: containerLayout.container.x,
      y: containerLayout.container.y,
      width: containerLayout.container.width,
      height: containerLayout.container.height,
      parameterGridPositions: new Map()
    };
  }
  
  render(
    _element: RemapRangeElementType,
    node: NodeInstance,
    spec: NodeSpec,
    elementMetrics: ElementMetrics,
    _nodeMetrics: NodeRenderMetrics,
    renderState: {
      audioRemapLiveValues?: { incoming: number | null; outgoing: number | null };
    }
  ): void {
    // Validate metrics - check for undefined/null, not falsy (0 is valid for x/y)
    if (elementMetrics.x === undefined || elementMetrics.x === null ||
        elementMetrics.y === undefined || elementMetrics.y === null ||
        elementMetrics.width === undefined || elementMetrics.width === null ||
        elementMetrics.height === undefined || elementMetrics.height === null ||
        elementMetrics.width <= 0 || elementMetrics.height <= 0) {
      console.warn('Invalid remap-range element metrics, skipping render', elementMetrics);
      return;
    }
    
    const remapRangeHeight = elementMetrics.height;
    const padding = getCSSVariableAsNumber('remap-range-padding', 12);
    const gap = padding;
    const sliderRowHeight = getCSSVariableAsNumber('remap-range-slider-row-height', 228);
    const inputRowHeight = getCSSVariableAsNumber('remap-range-input-row-height', 30);
    
    // Remap range area coordinates (elementMetrics are already in absolute coordinates)
    const remapRangeX = elementMetrics.x;
    const remapRangeY = elementMetrics.y;
    const remapRangeWidth = elementMetrics.width;
    
    // Row 1 (slider graph) and row 2 (inputs) layout
    const row1X = remapRangeX + padding;
    const row1Y = remapRangeY + padding;
    const row1Width = remapRangeWidth - padding * 2;
    const row1Height = sliderRowHeight;
    const row2Y = remapRangeY + padding + sliderRowHeight + gap;
    const row2Height = inputRowHeight;
    const row2X = remapRangeX + padding;
    const row2Width = remapRangeWidth - padding * 2;
    
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
    
    // Remap range tokens (remap-range-* overlay range-editor-*; see tokens-canvas.css)
    const editorBg = getCSSColor('remap-range-bg', getCSSColor('range-editor-bg', getCSSColor('color-gray-20', '#020203')));
    const editorRadius = getCSSVariableAsNumber('remap-range-radius', 12);
    const editorPadding = getCSSVariableAsNumber('remap-range-editor-padding', 12);
    const sliderBg = getCSSColor('remap-range-slider-bg', getCSSColor('range-editor-slider-bg', getCSSColor('color-gray-30', '#0a0b0d')));
    const sliderRadius = getCSSVariableAsNumber('remap-range-slider-radius', 2);
    const sliderTrackColor = getCSSColor('remap-range-slider-track-color', getCSSColor('range-editor-slider-track-color', getCSSColor('color-gray-60', '#5a5f66')));
    const sliderInputActiveColor = getCSSColor('remap-range-slider-input-color', getCSSColor('range-editor-slider-input-active-color', getCSSColor('color-green-90', '#6ee7b7')));
    // Output (end) slider: green; skip range-editor fallback (purple) so we never show wrong color
    const sliderOutputActiveColor = getCSSColor('remap-range-slider-output-color', getCSSColor('color-green-90', '#6ee7b7'));
    const sliderWidth = getCSSVariableAsNumber('remap-range-slider-width', 120);
    const connectionColor = getCSSColor('remap-range-connection-color', getCSSColor('range-editor-connection-color', getCSSColor('color-blue-90', '#6565dc')));
    const connectionWidth = getCSSVariableAsNumber('remap-range-connection-width', 2);
    const connectionDash = getCSSVariableAsNumber('remap-range-connection-dash', 4);
    
    // === RENDER REMAP RANGE ===
    // Draw container background (full area)
    this.ctx.fillStyle = editorBg;
    drawRoundedRect(this.ctx, remapRangeX, remapRangeY, remapRangeWidth, remapRangeHeight, editorRadius);
    this.ctx.fill();
    
    // Normalize values to 0-1 range for display
    const normalizeIn = (v: number) => (inMaxValue - inMinValue > 0) ? (v - inMinValue) / (inMaxValue - inMinValue) : 0;
    const normalizeOut = (v: number) => (outMaxValue - outMinValue > 0) ? (v - outMinValue) / (outMaxValue - outMinValue) : 0;
    const inMinNorm = Math.max(0, Math.min(1, normalizeIn(inMin)));
    const inMaxNorm = Math.max(0, Math.min(1, normalizeIn(inMax)));
    const outMinNorm = Math.max(0, Math.min(1, normalizeOut(outMin)));
    const outMaxNorm = Math.max(0, Math.min(1, normalizeOut(outMax)));
    
    // Row 1: two vertical sliders side by side with connection (same single padding as other slot elements)
    const sliderHeight = row1Height;
    
    const inputSliderLeftEdge = row1X + editorPadding;
    const inputSliderCenter = inputSliderLeftEdge + sliderWidth / 2;
    const inputSliderRightEdge = inputSliderCenter + sliderWidth / 2;
    const outputSliderRightEdge = row1X + row1Width - editorPadding;
    const outputSliderCenter = outputSliderRightEdge - sliderWidth / 2;
    const outputSliderLeftEdge = outputSliderCenter - sliderWidth / 2;
    const sliderY = row1Y;
    
    // Draw input range slider (vertical) - absolute positioning
    drawVerticalRangeSlider(
      this.ctx,
      inputSliderCenter, sliderY, sliderWidth, sliderHeight,
      inMinNorm, inMaxNorm,
      sliderBg, sliderTrackColor, sliderInputActiveColor,
      sliderRadius,
      false, // isHovered
      false  // isDragging
    );
    
    // Draw output range slider (vertical) - absolute positioning
    drawVerticalRangeSlider(
      this.ctx,
      outputSliderCenter, sliderY, sliderWidth, sliderHeight,
      outMinNorm, outMaxNorm,
      sliderBg, sliderTrackColor, sliderOutputActiveColor,
      sliderRadius,
      false, // isHovered
      false  // isDragging
    );
    
    // Draw connection lines between ranges (absolute positioning)
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
    
    // Needle markers: show live incoming (left) and remapped outgoing (right) for audio-remap and audio-analyzer (remap-range)
    const live = (node.type === 'audio-remap' || node.type === 'audio-analyzer') ? renderState.audioRemapLiveValues : undefined;
    if (live && (live.incoming != null || live.outgoing != null)) {
      const needleColor = getCSSColor('remap-range-needle-color', '#ffffff');
      const needleWidth = getCSSVariableAsNumber('remap-range-needle-width', 3);
      const needleExtend = getCSSVariableAsNumber('remap-range-needle-extend', 4);
      // Common vertical scale so same height = same numeric value; different values = different heights
      const scaleMin = Math.min(inMin, outMin);
      const scaleMax = Math.max(inMax, outMax);
      const scaleRange = scaleMax - scaleMin || 1;
      const valueToY = (v: number) => {
        const t = (v - scaleMin) / scaleRange;
        const tClamped = Math.max(0, Math.min(1, t));
        return sliderY + (1 - tClamped) * sliderHeight;
      };
      this.ctx.save();
      this.ctx.strokeStyle = needleColor;
      this.ctx.lineWidth = needleWidth;
      this.ctx.lineCap = 'round';
      this.ctx.setLineDash([]);
      this.ctx.globalAlpha = 1;
      if (live.incoming != null) {
        const needleY = valueToY(live.incoming);
        this.ctx.beginPath();
        this.ctx.moveTo(inputSliderLeftEdge - needleExtend, needleY);
        this.ctx.lineTo(inputSliderRightEdge + needleExtend, needleY);
        this.ctx.stroke();
      }
      if (live.outgoing != null) {
        const needleY = valueToY(live.outgoing);
        this.ctx.beginPath();
        this.ctx.moveTo(outputSliderLeftEdge - needleExtend, needleY);
        this.ctx.lineTo(outputSliderRightEdge + needleExtend, needleY);
        this.ctx.stroke();
      }
      this.ctx.restore();
    }
    
    // Row 2: "IN:" (inMin) "—" (inMax)  [GAP]  "OUT:" (outMin) "—" (outMax)
    // Use same horizontal inset as row 1 (editorPadding) so labels/inputs align with slider content
    const row2ContentX = row2X + editorPadding;
    const row2ContentWidth = row2Width - editorPadding * 2;
    const groupGap = getCSSVariableAsNumber('remap-range-input-group-gap', 24);
    const dashWidth = getCSSVariableAsNumber('remap-range-input-dash-width', 20);
    const itemSpacing = getCSSVariableAsNumber('remap-range-input-item-spacing', 6);
    const labelFontSize = getCSSVariableAsNumber('remap-range-input-label-font-size', 18);
    const labelFontWeight = getCSSVariableAsNumber('remap-range-input-label-font-weight', 600);
    const labelColor = getCSSColor('remap-range-input-label-color', getCSSColor('range-editor-label-color', getCSSColor('color-gray-110', '#a3aeb5')));
    const row2CenterY = row2Y + row2Height / 2;
    const groupWidth = (row2ContentWidth - groupGap) / 2;
    const leftGroupX = row2ContentX;
    const rightGroupX = row2ContentX + groupWidth + groupGap;

    const labelInWidth = getCSSVariableAsNumber('remap-range-input-label-in-width', 30);
    const labelOutWidth = getCSSVariableAsNumber('remap-range-input-label-out-width', 30);

    const drawGroup = (
      groupX: number,
      labelText: string,
      labelWidth: number,
      minVal: number,
      maxVal: number,
      labelAtEnd: boolean
    ) => {
      const valueSlotWidth = (groupWidth - labelWidth - dashWidth - 3 * itemSpacing) / 2;
      const labelFont = `${labelFontWeight} ${labelFontSize}px "Space Grotesk", sans-serif`;
      this.ctx.font = labelFont;
      this.ctx.textBaseline = 'middle';
      this.ctx.fillStyle = labelColor;

      let x = groupX;
      if (!labelAtEnd) {
        this.ctx.textAlign = 'left';
        this.ctx.fillText(labelText, x, row2CenterY);
        x += labelWidth + itemSpacing;
      }

      drawValueBox(this.ctx, minVal, x + valueSlotWidth / 2, row2CenterY, {
        paramType: 'float',
        align: 'center',
        width: valueSlotWidth
      });
      x += valueSlotWidth + itemSpacing;

      this.ctx.font = labelFont;
      this.ctx.textBaseline = 'middle';
      this.ctx.fillStyle = labelColor;
      this.ctx.textAlign = 'center';
      this.ctx.fillText('—', x + dashWidth / 2, row2CenterY);
      x += dashWidth + itemSpacing;

      drawValueBox(this.ctx, maxVal, x + valueSlotWidth / 2, row2CenterY, {
        paramType: 'float',
        align: 'center',
        width: valueSlotWidth
      });
      x += valueSlotWidth + itemSpacing;

      if (labelAtEnd) {
        this.ctx.font = labelFont;
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = labelColor;
        this.ctx.textAlign = 'right';
        this.ctx.fillText(labelText, x + labelWidth, row2CenterY);
      }
    };

    drawGroup(leftGroupX, 'in', labelInWidth, inMin, inMax, false);
    drawGroup(rightGroupX, 'out', labelOutWidth, outMin, outMax, true);

    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'alphabetic';
  }
}

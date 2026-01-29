/**
 * Color Picker Element Renderer
 *
 * One row: a single full-width swatch (defined height). Clicking the swatch opens the color picker.
 * No button; the swatch is the only control.
 */

import type { NodeInstance } from '../../../../../types/nodeGraph';
import type { NodeSpec, ColorPickerElement as ColorPickerElementType } from '../../../../../types/nodeSpec';
import type { NodeRenderMetrics } from '../../../NodeRenderer';
import type { LayoutElementRenderer, ElementMetrics } from '../LayoutElementRenderer';
import { getCSSVariableAsNumber, getCSSColor } from '../../../../../utils/cssTokens';
import { oklchToCssRgb } from '../../../../../utils/colorConversion';
import { drawRoundedRect } from '../../RenderingUtils';

/** Relative rect (x,y relative to element top-left). */
export interface RelativeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Swatch fills available width and dictates height only; values from tokens. */
const SWATCH_PADDING_H = 0;

export class ColorPickerElementRenderer implements LayoutElementRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  canHandle(element: any): boolean {
    return element.type === 'color-picker';
  }

  calculateMetrics(
    _element: ColorPickerElementType,
    node: NodeInstance,
    _spec: NodeSpec,
    availableWidth: number,
    startY: number,
    metrics: NodeRenderMetrics
  ): ElementMetrics {
    const gridPadding = getCSSVariableAsNumber('node-body-padding', 18);
    const swatchHeight = getCSSVariableAsNumber('color-picker-node-swatch-height', 40);

    const containerX = node.position.x + gridPadding;
    const containerY = node.position.y + metrics.headerHeight + startY;

    const rowHeight = swatchHeight;
    const swatchW = Math.max(0, availableWidth - SWATCH_PADDING_H * 2);
    const swatchRelX = SWATCH_PADDING_H;
    const swatchRelY = 0;

    return {
      x: containerX,
      y: containerY,
      width: availableWidth,
      height: rowHeight,
      parameterGridPositions: new Map(),
      colorPickerSwatchRect: { x: swatchRelX, y: swatchRelY, w: swatchW, h: swatchHeight }
    };
  }

  render(
    _element: ColorPickerElementType,
    node: NodeInstance,
    spec: NodeSpec,
    elementMetrics: ElementMetrics,
    _nodeMetrics: NodeRenderMetrics,
    _renderState: any
  ): void {
    const l = (node.parameters.l ?? spec.parameters.l?.default ?? 0.5) as number;
    const c = (node.parameters.c ?? spec.parameters.c?.default ?? 0.1) as number;
    const h = (node.parameters.h ?? spec.parameters.h?.default ?? 0) as number;

    const swatchBorder = getCSSColor('color-gray-70', '#282b31');
    const swatchRadius = getCSSVariableAsNumber('color-picker-node-swatch-radius', 6);

    const x = elementMetrics.x;
    const y = elementMetrics.y;
    const swatchRect = elementMetrics.colorPickerSwatchRect as RelativeRect;
    const swatchX = x + swatchRect.x;
    const swatchY = y + swatchRect.y;

    const cssRgb = oklchToCssRgb(l, c, h);
    this.ctx.fillStyle = cssRgb;
    drawRoundedRect(this.ctx, swatchX, swatchY, swatchRect.w, swatchRect.h, swatchRadius);
    this.ctx.fill();
    this.ctx.strokeStyle = swatchBorder;
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
  }
}

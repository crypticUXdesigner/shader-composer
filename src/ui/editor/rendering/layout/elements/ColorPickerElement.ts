/**
 * Color Picker Element Renderer
 *
 * One row: a single full-width swatch (defined height). Clicking the swatch opens the color picker.
 * No button; the swatch is the only control.
 */

import type { NodeInstance } from '../../../../../data-model/types';
import type { NodeSpec, LayoutElement, ColorPickerElement as ColorPickerElementType } from '../../../../../types/nodeSpec';
import type { NodeRenderMetrics } from '../../../NodeRenderer';
import type { LayoutElementRenderer, ElementMetrics } from '../LayoutElementRenderer';
import { getCSSVariableAsNumber, getCategoryVariableAsNumber } from '../../../../../utils/cssTokens';

/** Relative rect (x,y relative to element top-left). */
export interface RelativeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class ColorPickerElementRenderer implements LayoutElementRenderer {
  constructor(_ctx: CanvasRenderingContext2D) {
    // ctx unused; nodes are DOM-rendered. Kept for API compatibility with ParameterLayoutManager.
  }

  canHandle(element: LayoutElement): boolean {
    return element.type === 'color-picker';
  }

  calculateMetrics(
    _element: ColorPickerElementType,
    node: NodeInstance,
    spec: NodeSpec,
    availableWidth: number,
    startY: number,
    metrics: NodeRenderMetrics
  ): ElementMetrics {
    const category = spec.category;
    const gridPadding = category != null
      ? getCategoryVariableAsNumber('node-body-padding', category, 18)
      : getCSSVariableAsNumber('node-body-padding', 18);
    const swatchHeight = getCSSVariableAsNumber('color-picker-node-swatch-height', 40);

    const containerX = node.position.x + gridPadding;
    const containerY = node.position.y + metrics.headerHeight + startY;

    const rowHeight = swatchHeight;
    const swatchW = Math.max(0, availableWidth);
    const swatchRelX = 0;
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
}

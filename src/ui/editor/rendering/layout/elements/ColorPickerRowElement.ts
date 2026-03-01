/**
 * Color Picker Row Element Renderer
 *
 * Two OKLCH color pickers in one row, equal width. Used for start/end color on color map nodes.
 * Includes Swap and Reverse Hue buttons above the swatches (for Color Map Smooth / Stepped).
 */

import type { NodeInstance } from '../../../../../data-model/types';
import type { NodeSpec, LayoutElement, ColorPickerRowElement as ColorPickerRowElementType } from '../../../../../types/nodeSpec';
import type { NodeRenderMetrics } from '../../../NodeRenderer';
import type { LayoutElementRenderer, ElementMetrics } from '../LayoutElementRenderer';
import { getCSSVariableAsNumber, getCategoryVariableAsNumber } from '../../../../../utils/cssTokens';

const ROW_GAP = 8;

export class ColorPickerRowElementRenderer implements LayoutElementRenderer {
  constructor(_ctx: CanvasRenderingContext2D) {
    // ctx unused; nodes are DOM-rendered. Kept for API compatibility with ParameterLayoutManager.
  }

  canHandle(element: LayoutElement): boolean {
    return element.type === 'color-picker-row';
  }

  calculateMetrics(
    element: ColorPickerRowElementType,
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
    const groupHeaderHeight = category != null
      ? getCategoryVariableAsNumber('param-group-header-height', category, 18)
      : getCSSVariableAsNumber('param-group-header-height', 24);
    const groupHeaderMarginTop = category != null
      ? getCategoryVariableAsNumber('param-group-header-margin-top', category, 12)
      : getCSSVariableAsNumber('param-group-header-margin-top', 0);
    const groupHeaderMarginBottom = category != null
      ? getCategoryVariableAsNumber('param-group-header-margin-bottom', category, 12)
      : getCSSVariableAsNumber('param-group-header-margin-bottom', 0);
    const swatchHeight = getCSSVariableAsNumber('color-picker-node-swatch-height', 40);
    const buttonHeight = getCSSVariableAsNumber('color-map-row-button-height', 24);
    const buttonGap = getCSSVariableAsNumber('color-map-row-button-gap', 8);
    const pd = getCSSVariableAsNumber('embed-slot-pd', 18);

    const hasHeaderLabel = typeof element.label === 'string' && element.label.trim().length > 0;
    const headerOffset = hasHeaderLabel
      ? groupHeaderMarginTop + groupHeaderHeight + groupHeaderMarginBottom
      : 0;

    const containerX = node.position.x + gridPadding;
    const containerY = node.position.y + metrics.headerHeight + startY;

    const halfWidth = Math.max(0, (availableWidth - ROW_GAP) / 2);
    const hasReverseHue = spec.parameters?.reverseHue != null;
    const buttonsInHeader = hasHeaderLabel;
    const buttonW = Math.max(0, halfWidth - pd * 2);

    const buttonRects: Array<{ type: 'swap' | 'reverseHue'; x: number; y: number; w: number; h: number }> = [];
    let buttonRowHeight = 0;

    if (hasReverseHue && !buttonsInHeader) {
      const buttonY = headerOffset;
      buttonRects.push({ type: 'swap', x: pd, y: buttonY, w: buttonW, h: buttonHeight });
      buttonRects.push({ type: 'reverseHue', x: halfWidth + ROW_GAP + pd, y: buttonY, w: buttonW, h: buttonHeight });
      buttonRowHeight = buttonHeight + buttonGap;
    }

    const swatchRects: Array<{ x: number; y: number; w: number; h: number }> = [
      { x: 0, y: headerOffset + buttonRowHeight, w: halfWidth, h: swatchHeight },
      { x: halfWidth + ROW_GAP, y: headerOffset + buttonRowHeight, w: halfWidth, h: swatchHeight }
    ];

    const contentHeight = buttonRowHeight + swatchHeight;
    return {
      x: containerX,
      y: containerY,
      width: availableWidth,
      height: headerOffset + contentHeight,
      parameterGridPositions: new Map(),
      colorPickerSwatchRects: swatchRects,
      colorMapRowButtonRects: buttonRects
    };
  }
}

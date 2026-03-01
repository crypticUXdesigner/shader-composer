/**
 * Color Map Preview Element Renderer
 *
 * Full-width row showing color stops: stepped (discrete boxes) or smooth (gradient).
 * Used by oklch-color-map-threshold and oklch-color-map-bezier. DOM renders the strip.
 */

import type { NodeInstance } from '../../../../../data-model/types';
import type { NodeSpec, LayoutElement, ColorMapPreviewElement as ColorMapPreviewElementType } from '../../../../../types/nodeSpec';
import type { NodeRenderMetrics } from '../../../NodeRenderer';
import type { LayoutElementRenderer, ElementMetrics } from '../LayoutElementRenderer';
import { getCSSVariableAsNumber, getCategoryVariableAsNumber } from '../../../../../utils/cssTokens';

export class ColorMapPreviewElementRenderer implements LayoutElementRenderer {
  constructor(_ctx: CanvasRenderingContext2D) {
    // ctx unused; nodes are DOM-rendered.
  }

  canHandle(element: LayoutElement): boolean {
    return element.type === 'color-map-preview';
  }

  calculateMetrics(
    element: ColorMapPreviewElementType,
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
    const defaultHeight = getCSSVariableAsNumber('color-map-preview-height', 24);
    const stripHeight = element.height ?? defaultHeight;
    const groupHeaderHeight = category != null
      ? getCategoryVariableAsNumber('param-group-header-height', category, 18)
      : getCSSVariableAsNumber('param-group-header-height', 24);
    const groupHeaderMarginTop = category != null
      ? getCategoryVariableAsNumber('param-group-header-margin-top', category, 12)
      : getCSSVariableAsNumber('param-group-header-margin-top', 0);
    const groupHeaderMarginBottom = category != null
      ? getCategoryVariableAsNumber('param-group-header-margin-bottom', category, 12)
      : getCSSVariableAsNumber('param-group-header-margin-bottom', 0);

    const hasHeaderLabel = typeof element.label === 'string' && element.label.trim().length > 0;
    const headerOffset = hasHeaderLabel
      ? groupHeaderMarginTop + groupHeaderHeight + groupHeaderMarginBottom
      : 0;

    const containerX = node.position.x + gridPadding;
    const containerY = node.position.y + metrics.headerHeight + startY;

    return {
      x: containerX,
      y: containerY,
      width: availableWidth,
      height: headerOffset + stripHeight,
      parameterGridPositions: new Map()
    };
  }
}

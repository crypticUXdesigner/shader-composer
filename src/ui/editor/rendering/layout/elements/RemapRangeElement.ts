/**
 * Remap Range Element Renderer
 *
 * Range editor slider UI (for remap nodes).
 * Maps to inMin, inMax, outMin, outMax parameters.
 *
 * Uses flexbox container structure with absolute positioning for interactive elements.
 */

import type { NodeInstance } from '../../../../../data-model/types';
import type { NodeSpec, LayoutElement, RemapRangeElement as RemapRangeElementType } from '../../../../../types/nodeSpec';
import type { NodeRenderMetrics } from '../../../NodeRenderer';
import type { LayoutElementRenderer, ElementMetrics } from '../LayoutElementRenderer';
import { getCSSVariableAsNumber, getCategoryVariableAsNumber } from '../../../../../utils/cssTokens';
import { calculateFlexboxLayout } from '../flexbox/FlexboxCalculator';
import type { FlexItem, FlexboxProperties } from '../flexbox/FlexboxTypes';

export class RemapRangeElementRenderer implements LayoutElementRenderer {
  constructor(_ctx: CanvasRenderingContext2D) {
    // ctx unused; nodes are DOM-rendered. Kept for API compatibility with ParameterLayoutManager.
  }

  canHandle(element: LayoutElement): boolean {
    return element.type === 'remap-range';
  }

  calculateMetrics(
    _element: RemapRangeElementType,
    node: NodeInstance,
    spec: NodeSpec,
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

    const category = spec.category;
    const gridPadding = category != null
      ? getCategoryVariableAsNumber('node-body-padding', category, 18)
      : getCSSVariableAsNumber('node-body-padding', 18);

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
}

/**
 * Bezier Editor Row Element Renderer
 *
 * Three bezier editors in one row, equal width; no parameter ports.
 * Used for L, C, H curves on color map nodes.
 */

import type { NodeInstance } from '../../../../../data-model/types';
import type { NodeSpec, LayoutElement, BezierEditorRowElement as BezierEditorRowElementType } from '../../../../../types/nodeSpec';
import type { NodeRenderMetrics } from '../../../NodeRenderer';
import type { LayoutElementRenderer, ElementMetrics } from '../LayoutElementRenderer';
import { getCSSVariableAsNumber, getCategoryVariableAsNumber } from '../../../../../utils/cssTokens';

const EDITOR_GAP = 6;

export class BezierEditorRowElementRenderer implements LayoutElementRenderer {
  constructor(_ctx: CanvasRenderingContext2D) {
    // ctx unused; nodes are DOM-rendered. Kept for API compatibility with ParameterLayoutManager.
  }

  canHandle(element: LayoutElement): boolean {
    return element.type === 'bezier-editor-row';
  }

  calculateMetrics(
    element: BezierEditorRowElementType,
    node: NodeInstance,
    spec: NodeSpec,
    availableWidth: number,
    startY: number,
    metrics: NodeRenderMetrics
  ): ElementMetrics {
    const defaultHeight = getCSSVariableAsNumber('bezier-editor-height', 200);
    const height = element.height ?? defaultHeight;
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

    const hasHeaderLabel = typeof element.label === 'string' && element.label.trim().length > 0;
    const headerOffset = hasHeaderLabel
      ? groupHeaderMarginTop + groupHeaderHeight + groupHeaderMarginBottom
      : 0;

    const containerX = node.position.x + gridPadding;
    const containerY = node.position.y + metrics.headerHeight + startY;
    const contentY = containerY + headerOffset;

    const totalGap = EDITOR_GAP * 2;
    const editorWidth = Math.max(0, (availableWidth - totalGap) / 3);

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

    element.editors.forEach((paramNames, index) => {
      const cellX = containerX + index * (editorWidth + EDITOR_GAP);
      const cellY = contentY;
      const pos = {
        cellX,
        cellY,
        cellWidth: editorWidth,
        cellHeight: height,
        knobX: 0,
        knobY: 0,
        portX: cellX,
        portY: cellY,
        labelX: cellX,
        labelY: cellY,
        valueX: 0,
        valueY: 0
      };
      paramNames.forEach((paramName) => parameterGridPositions.set(paramName, pos));
    });

    return {
      x: containerX,
      y: containerY,
      width: availableWidth,
      height: headerOffset + height,
      parameterGridPositions
    };
  }
}

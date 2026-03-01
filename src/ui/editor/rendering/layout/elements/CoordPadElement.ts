/**
 * Coord Pad Element Renderer
 *
 * XY coordinate pad with draggable 2D pad + X/Y ValueInputs below.
 * Combined cell with ports for X and Y parameters.
 */

import type { NodeInstance } from '../../../../../data-model/types';
import type { NodeSpec, LayoutElement, CoordPadElement as CoordPadElementType } from '../../../../../types/nodeSpec';
import type { NodeRenderMetrics } from '../../../NodeRenderer';
import type { LayoutElementRenderer, ElementMetrics } from '../LayoutElementRenderer';
import { getCSSVariableAsNumber, getCategoryVariableAsNumber } from '../../../../../utils/cssTokens';

export class CoordPadElementRenderer implements LayoutElementRenderer {
  constructor(_ctx: CanvasRenderingContext2D) {
    // ctx unused; nodes are DOM-rendered. Kept for API compatibility with ParameterLayoutManager.
  }

  canHandle(element: LayoutElement): boolean {
    return element.type === 'coord-pad';
  }

  calculateMetrics(
    element: CoordPadElementType,
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
    
    // Get coord pad dimensions from CSS variables or use defaults
    const padHeight = getCSSVariableAsNumber('coord-pad-height', 120);
    const inputRowHeight = getCSSVariableAsNumber('coord-pad-input-row-height', 40);
    const totalHeight = padHeight + inputRowHeight;

    const containerX = node.position.x + gridPadding;
    const containerY = node.position.y + metrics.headerHeight + startY;

    const [paramX, paramY] = element.parameters;

    // Port positions: ports are in the left column (param-cell padding + port offset from content).
    // Match DOM: .param-cell has padding, then .left-column .port-row with .port-circle.
    const paramCellPadding = getCSSVariableAsNumber('param-cell-padding', 24);
    const portOffsetX = getCSSVariableAsNumber('param-port-offset-x', 18);
    const portSize = getCSSVariableAsNumber('param-port-size', 6);
    const portSpacing = getCSSVariableAsNumber('coord-pad-port-spacing', 8);
    const portX = containerX + paramCellPadding + portOffsetX;
    const portY = containerY + padHeight / 2 - portSize / 2;
    const portYOffset = portSpacing + portSize;

    // Create parameter grid positions for both X and Y parameters
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

    // X parameter position
    parameterGridPositions.set(paramX, {
      cellX: containerX,
      cellY: containerY,
      cellWidth: availableWidth,
      cellHeight: totalHeight,
      knobX: containerX + availableWidth / 2,
      knobY: containerY + padHeight / 2,
      portX: portX,
      portY: portY,
      labelX: containerX,
      labelY: containerY + padHeight,
      valueX: containerX + availableWidth / 4,
      valueY: containerY + padHeight + inputRowHeight / 2
    });

    // Y parameter position
    parameterGridPositions.set(paramY, {
      cellX: containerX,
      cellY: containerY,
      cellWidth: availableWidth,
      cellHeight: totalHeight,
      knobX: containerX + availableWidth / 2,
      knobY: containerY + padHeight / 2,
      portX: portX,
      portY: portY + portYOffset,
      labelX: containerX,
      labelY: containerY + padHeight,
      valueX: containerX + (3 * availableWidth) / 4,
      valueY: containerY + padHeight + inputRowHeight / 2
    });

    return {
      x: containerX,
      y: containerY,
      width: availableWidth,
      height: totalHeight,
      parameterGridPositions
    };
  }
}

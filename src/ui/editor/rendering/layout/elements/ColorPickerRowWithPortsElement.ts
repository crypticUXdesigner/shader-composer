/**
 * Color Picker Row With Ports Element Renderer
 *
 * Row 1: Two OKLCH color swatches (equal width).
 * Rows 2–3: Two rows of three full parameter cells (L, C, H) under each swatch – port, label, knob, value.
 * Used for Color Map Smooth / Color Map Stepped so start/end colors can be driven by connections
 * while still showing and editing values.
 */

import type { NodeInstance } from '../../../../../data-model/types';
import type { NodeSpec, LayoutElement, ColorPickerRowWithPortsElement as ColorPickerRowWithPortsElementType } from '../../../../../types/nodeSpec';
import type { NodeRenderMetrics } from '../../../NodeRenderer';
import type { LayoutElementRenderer, ElementMetrics } from '../LayoutElementRenderer';
import { getCSSVariableAsNumber, getCategoryVariableAsNumber } from '../../../../../utils/cssTokens';

const ROW_GAP = 8;
const PORTS_ROW_TOP_PADDING = 12;

export class ColorPickerRowWithPortsElementRenderer implements LayoutElementRenderer {
  constructor(_ctx: CanvasRenderingContext2D) {
    // ctx unused; nodes are DOM-rendered. Kept for API compatibility with ParameterLayoutManager.
  }

  canHandle(element: LayoutElement): boolean {
    return element.type === 'color-picker-row-with-ports';
  }

  private calculateCellElementPositions(
    cellX: number,
    cellY: number,
    cellWidth: number,
    cellPadding: number,
    labelFontSize: number,
    extraSpacing: number,
    knobSize: number,
    valueSpacing: number
  ): { labelX: number; labelY: number; knobX: number; knobY: number; valueX: number; valueY: number; portX: number; portY: number } {
    const labelX = cellX + cellWidth / 2;
    const labelY = cellY + cellPadding;
    const portX = cellX + cellPadding;
    const portY = labelY + labelFontSize / 2;
    const knobX = cellX + cellWidth / 2;
    const labelBottom = cellY + cellPadding + labelFontSize;
    const knobY = labelBottom + extraSpacing + knobSize / 2;
    const valueX = knobX;
    const valueY = knobY + knobSize / 2 + valueSpacing;
    return { labelX, labelY, knobX, knobY, valueX, valueY, portX, portY };
  }

  calculateMetrics(
    element: ColorPickerRowWithPortsElementType,
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
    const gridGap = category != null
      ? getCategoryVariableAsNumber('param-grid-gap', category, 6)
      : getCSSVariableAsNumber('param-grid-gap', 12);
    const swatchHeight = getCSSVariableAsNumber('color-picker-node-swatch-height', 40);
    const cellPadding = getCSSVariableAsNumber('param-cell-padding', 12);
    const labelFontSize = getCSSVariableAsNumber('param-label-font-size', 18);
    const extraSpacing = getCSSVariableAsNumber('param-label-knob-spacing', 20);
    const knobSize = getCSSVariableAsNumber('knob-size', 45);
    const valueSpacing = getCSSVariableAsNumber('knob-value-spacing', 4);

    const containerX = node.position.x + gridPadding;
    const containerY = node.position.y + metrics.headerHeight + startY;

    const halfWidth = Math.max(0, (availableWidth - ROW_GAP) / 2);
    const swatchRects: Array<{ x: number; y: number; w: number; h: number }> = [
      { x: 0, y: 0, w: halfWidth, h: swatchHeight },
      { x: halfWidth + ROW_GAP, y: 0, w: halfWidth, h: swatchHeight }
    ];

    // Cell height must match DOM param-cell: horizontal layout (label | control).
    const cellHeight = knobSize + cellPadding * 2;

    const cellWidth = Math.max(0, (halfWidth - gridGap * 2) / 3);
    const row0Y = containerY + swatchHeight + PORTS_ROW_TOP_PADDING;
    const row1Y = row0Y + cellHeight + gridGap;

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

    element.pickers.forEach((paramNames, pickerIndex) => {
      const baseX = containerX + (pickerIndex === 0 ? 0 : halfWidth + ROW_GAP);
      const rowY = pickerIndex === 0 ? row0Y : row1Y;
      for (let i = 0; i < 3; i++) {
        const paramName = paramNames[i];
        const cellX = baseX + gridGap + i * (cellWidth + gridGap);
        const cellY = rowY;
        const positions = this.calculateCellElementPositions(
          cellX,
          cellY,
          cellWidth,
          cellPadding,
          labelFontSize,
          extraSpacing,
          knobSize,
          valueSpacing
        );
        parameterGridPositions.set(paramName, {
          cellX,
          cellY,
          cellWidth,
          cellHeight,
          knobX: positions.knobX,
          knobY: positions.knobY,
          portX: positions.portX,
          portY: positions.portY,
          labelX: positions.labelX,
          labelY: positions.labelY,
          valueX: positions.valueX,
          valueY: positions.valueY
        });
      }
    });

    const totalHeight = swatchHeight + PORTS_ROW_TOP_PADDING + 2 * cellHeight + gridGap;

    return {
      x: containerX,
      y: containerY,
      width: availableWidth,
      height: totalHeight,
      parameterGridPositions,
      colorPickerSwatchRects: swatchRects
    };
  }
}

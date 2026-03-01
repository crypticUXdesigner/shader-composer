/**
 * Grid Element Renderer
 * 
 * Explicit grid with layout control and parameter selection.
 */

import type { NodeInstance } from '../../../../../data-model/types';
import type { NodeSpec, LayoutElement, GridElement as GridElementType } from '../../../../../types/nodeSpec';
import type { NodeRenderMetrics } from '../../../NodeRenderer';
import type { LayoutElementRenderer, ElementMetrics } from '../LayoutElementRenderer';
import { getCategoryVariableAsNumber, getCSSVariableAsNumber } from '../../../../../utils/cssTokens';
import { FlexboxLayoutEngine } from '../flexbox/FlexboxLayoutEngine';
import type { FlexItem } from '../flexbox/FlexboxTypes';

/**
 * Get cell height for a parameter based on its UI type.
 * Input-only params use param-cell-min-height to match DOM (compact); others use knob-based height.
 */
function getCellHeightForParam(
  paramName: string,
  element: GridElementType,
  knobSize: number,
  cellPadding: number,
  paramCellMinHeight: number
): number {
  const layoutHeight = element.layout?.cellHeight;
  if (layoutHeight != null) return layoutHeight;
  const isInputUI = element.parameterUI?.[paramName] === 'input';
  return isInputUI ? paramCellMinHeight : knobSize + cellPadding * 2;
}

export class GridElementRenderer implements LayoutElementRenderer {
  private flexboxEngine: FlexboxLayoutEngine;
  
  constructor(_ctx: CanvasRenderingContext2D) {
    // ctx unused; nodes are DOM-rendered. Kept for API compatibility with ParameterLayoutManager.
    this.flexboxEngine = new FlexboxLayoutEngine();
  }
  
  canHandle(element: LayoutElement): boolean {
    return element.type === 'grid';
  }
  
  calculateMetrics(
    element: GridElementType,
    node: NodeInstance,
    spec: NodeSpec,
    availableWidth: number,
    startY: number,
    metrics: NodeRenderMetrics
  ): ElementMetrics {
    const category = spec.category;
    const gridGap = category != null
      ? getCategoryVariableAsNumber('param-grid-gap', category, 6)
      : getCSSVariableAsNumber('param-grid-gap', 12);
    const defaultCellMinWidth = getCSSVariableAsNumber('param-cell-min-width', 220);
    const groupHeaderHeight = category != null
      ? getCategoryVariableAsNumber('param-group-header-height', category, 18)
      : getCSSVariableAsNumber('param-group-header-height', 24);
    const groupHeaderMarginTop = category != null
      ? getCategoryVariableAsNumber('param-group-header-margin-top', category, 12)
      : getCSSVariableAsNumber('param-group-header-margin-top', 0);
    const groupHeaderMarginBottom = category != null
      ? getCategoryVariableAsNumber('param-group-header-margin-bottom', category, 12)
      : getCSSVariableAsNumber('param-group-header-margin-bottom', 0);
    
    const layout = element.layout || {};
    const cellMinWidth = layout.cellMinWidth ?? defaultCellMinWidth;
    const respectMinWidth = layout.respectMinWidth !== false; // Default true
    const parameterSpan = layout.parameterSpan;
    
    // Filter parameters - skip missing ones with warning
    const validParams: string[] = [];
    for (const paramName of element.parameters) {
      if (spec.parameters[paramName]) {
        validParams.push(paramName);
      } else {
        console.warn(`Parameter "${paramName}" not found in node "${spec.id}", skipping from grid`);
      }
    }
    
    if (validParams.length === 0) {
      return {
        x: node.position.x,
        y: node.position.y + metrics.headerHeight + startY,
        width: availableWidth,
        height: 0,
        parameterGridPositions: new Map()
      };
    }
    
    const gridPadding = category != null
      ? getCategoryVariableAsNumber('node-body-padding', category, 18)
      : getCSSVariableAsNumber('node-body-padding', 18);
    const cellPadding = getCSSVariableAsNumber('param-cell-padding', 12);
    const knobSize = getCSSVariableAsNumber('knob-size', 45);
    const paramCellMinHeight = getCSSVariableAsNumber('param-cell-min-height', 56);
    const labelFontSize = getCSSVariableAsNumber('param-label-font-size', 18);
    const extraSpacing = getCSSVariableAsNumber('param-label-knob-spacing', 20);
    const valueSpacing = getCSSVariableAsNumber('knob-value-spacing', 4);
    
    // Cell width: honor parameterSpan so canvas layout matches DOM (span-2-cols / span-3-cols)
    const getCellWidth = (paramName: string): number => {
      const span = parameterSpan?.[paramName];
      if (span === 2) return cellMinWidth * 2 + gridGap;
      if (span === 3) return cellMinWidth * 3 + gridGap * 2;
      return cellMinWidth;
    };
    
    // Cell height must match DOM param-cell. Input-only params use param-cell-min-height; knob params use knob-based height.
    const cellItems: FlexItem[] = validParams.map((paramName, index) => {
      const cellHeight = getCellHeightForParam(paramName, element, knobSize, cellPadding, paramCellMinHeight);
      const width = getCellWidth(paramName);
      return {
        id: `cell-${index}`,
        properties: {
          width,
          height: cellHeight,
          minWidth: respectMinWidth ? width : undefined,
          flexShrink: 1,
          flexGrow: 1
        }
      };
    });
    
    // Use FlexboxLayoutEngine to calculate grid layout
    const gridX = node.position.x + gridPadding;
    const gridY = node.position.y + metrics.headerHeight + startY;

    // Optional header inside this grid slot (used for parameterGroups).
    const hasHeaderLabel = typeof element.label === 'string' && element.label.trim().length > 0;
    const headerOffset = hasHeaderLabel
      ? (groupHeaderMarginTop + groupHeaderHeight + groupHeaderMarginBottom)
      : 0;
    
    const gridLayout = this.flexboxEngine.calculateLayout(
      gridX,
      gridY + headerOffset,
      availableWidth,
      undefined, // content-based height
      {
        direction: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        gap: gridGap
      },
      cellItems
    );
    
    // Extract parameter positions from flexbox layout
    // First, convert to a simpler structure for row height normalization
    const cellLayouts = new Map<string, { x: number; y: number; width: number; height: number }>();
    validParams.forEach((_paramName, index) => {
      const cellResult = gridLayout.items.get(`cell-${index}`);
      if (cellResult && 'x' in cellResult) {
        // It's a LayoutResult (not nested container)
        cellLayouts.set(`cell-${index}`, cellResult);
      }
    });
    
    // Normalize row heights (all cells in same row should have equal height)
    this.normalizeRowHeights(cellLayouts, gridGap);
    
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
    
    validParams.forEach((paramName, index) => {
      const cellLayout = cellLayouts.get(`cell-${index}`);
      if (!cellLayout) return;
      
      const cellX = cellLayout.x;
      const cellY = cellLayout.y;
      const cellWidth = cellLayout.width;
      const cellHeight = cellLayout.height;
      
      // Calculate internal element positions.
      //
      // IMPORTANT: Keep GridElementRenderer consistent with AutoGridElementRenderer so
      // "grid" and "auto-grid" parameter cells look identical.
      const cellElementPositions = this.calculateCellElementPositions(
        cellX,
        cellY,
        cellWidth,
        cellHeight,
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
        knobX: cellElementPositions.knobX,
        knobY: cellElementPositions.knobY,
        portX: cellElementPositions.portX,
        portY: cellElementPositions.portY,
        labelX: cellElementPositions.labelX,
        labelY: cellElementPositions.labelY,
        valueX: cellElementPositions.valueX,
        valueY: cellElementPositions.valueY
      });
    });
    
    // Calculate total height from normalized cell positions.
    //
    // IMPORTANT: Height must be independent of absolute canvas/world coordinates.
    // The previous implementation initialized maxY to 0, which implicitly anchored
    // the grid height to world-origin. When a node was dragged into negative Y,
    // cell bottoms could all be < 0, leaving maxY at 0 and making totalHeight
    // depend on -gridY (i.e., node.position.y). This caused node height to change
    // during dragging.
    //
    // Fix: compute the maximum bottom edge relative to gridY.
    let maxBottom = gridY + headerOffset;
    for (const cell of cellLayouts.values()) {
      maxBottom = Math.max(maxBottom, cell.y + cell.height);
    }
    const totalHeight = Math.max(0, headerOffset + (maxBottom - (gridY + headerOffset)));
    
    return {
      x: gridX,
      y: gridY,
      width: availableWidth,
      height: totalHeight,
      parameterGridPositions
    };
  }
  
  /**
   * Calculate cell internal element positions using flexbox
   */
  private calculateCellElementPositions(
    cellX: number,
    cellY: number,
    cellWidth: number,
    cellHeight: number,
    cellPadding: number,
    labelFontSize: number,
    extraSpacing: number,
    knobSize: number,
    valueSpacing: number
  ): {
    labelX: number;
    labelY: number;
    knobX: number;
    knobY: number;
    valueX: number;
    valueY: number;
    portX: number;
    portY: number;
  } {
    // Match AutoGridElementRenderer's "classic" cell positioning so grid and auto-grid
    // look the same (label at top, knob centered, value beneath).
    //
    // NOTE: Parameter renderers (Knob/Toggle/etc) still compute portY at render-time
    // using measured label height for perfect alignment; these values are the layout
    // anchors used by those renderers.
    const labelX = cellX + cellWidth / 2;
    const labelY = cellY + cellPadding;

    const portX = cellX + cellPadding;
    const portY = labelY + labelFontSize / 2;

    const knobX = cellX + cellWidth / 2;
    const labelBottom = cellY + cellPadding + labelFontSize;
    const knobY = labelBottom + extraSpacing + knobSize / 2;

    const valueX = knobX;
    const valueY = knobY + knobSize / 2 + valueSpacing;

    // cellHeight is intentionally unused here (content is top-anchored).
    void cellHeight;

    return {
      labelX,
      labelY,
      knobX,
      knobY,
      valueX,
      valueY,
      portX,
      portY
    };
  }
  
  /**
   * Normalize row heights - all cells in the same row should have equal height
   */
  private normalizeRowHeights(
    cellLayouts: Map<string, { x: number; y: number; width: number; height: number }>,
    _gridGap: number
  ): void {
    // Group cells by row (based on Y position, with tolerance for floating point)
    const rows = new Map<number, Array<{ id: string; height: number }>>();
    const tolerance = 1; // 1px tolerance for row grouping
    
    for (const [id, cell] of cellLayouts) {
      // Find existing row with similar Y position
      let foundRow = false;
      for (const [rowY] of rows) {
        if (Math.abs(cell.y - rowY) < tolerance) {
          rows.get(rowY)!.push({ id, height: cell.height });
          foundRow = true;
          break;
        }
      }
      
      if (!foundRow) {
        rows.set(cell.y, [{ id, height: cell.height }]);
      }
    }
    
    // For each row, find tallest cell and set all cells to that height
    rows.forEach((cells) => {
      const maxHeight = Math.max(...cells.map(c => c.height));
      
      // Update all cells in row to max height
      cells.forEach(({ id }) => {
        const cell = cellLayouts.get(id);
        if (cell) {
          cell.height = maxHeight;
        }
      });
    });
  }
}

/**
 * Auto Grid Element Renderer
 * 
 * Automatically generates a grid from all node parameters.
 * Respects parameterGroups if defined.
 */

import type { NodeInstance } from '../../../../../data-model/types';
import type { NodeSpec, LayoutElement, AutoGridElement as AutoGridElementType } from '../../../../../types/nodeSpec';
import type { NodeRenderMetrics } from '../../../NodeRenderer';
import type { LayoutElementRenderer, ElementMetrics } from '../LayoutElementRenderer';
import { getCategoryVariableAsNumber, getCSSVariableAsNumber } from '../../../../../utils/cssTokens';
import { FlexboxLayoutEngine } from '../flexbox/FlexboxLayoutEngine';
import type { FlexItem } from '../flexbox/FlexboxTypes';
import { getParameterUIRegistry } from '../../ParameterUIRegistry';

export class AutoGridElementRenderer implements LayoutElementRenderer {
  private flexboxEngine: FlexboxLayoutEngine;

  constructor(_ctx: CanvasRenderingContext2D) {
    // ctx unused; nodes are DOM-rendered. Kept for API compatibility with ParameterLayoutManager.
    this.flexboxEngine = new FlexboxLayoutEngine();
  }
  
  canHandle(element: LayoutElement): boolean {
    return element.type === 'auto-grid';
  }
  
  calculateMetrics(
    _element: AutoGridElementType,
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
    const cellMinWidth = getCSSVariableAsNumber('param-cell-min-width', 220);
    const groupHeaderHeight = category != null
      ? getCategoryVariableAsNumber('param-group-header-height', category, 18)
      : getCSSVariableAsNumber('param-group-header-height', 24);
    const groupHeaderMarginTop = category != null
      ? getCategoryVariableAsNumber('param-group-header-margin-top', category, 12)
      : getCSSVariableAsNumber('param-group-header-margin-top', 0);
    const groupHeaderMarginBottom = category != null
      ? getCategoryVariableAsNumber('param-group-header-margin-bottom', category, 12)
      : getCSSVariableAsNumber('param-group-header-margin-bottom', 0);
    const groupDividerHeight = getCSSVariableAsNumber('param-group-divider-height', 1);
    const groupDividerSpacing = getCSSVariableAsNumber('param-group-divider-spacing', 12);
    const bodyTopPadding = getCSSVariableAsNumber('param-body-top-padding', 24);
    const gridPadding = category != null
      ? getCategoryVariableAsNumber('node-body-padding', category, 18)
      : getCSSVariableAsNumber('node-body-padding', 18);
    
    // Cell height must match DOM param-cell. Input-only params use param-cell-min-height; knob params use knob-based height.
    const cellPadding = getCSSVariableAsNumber('param-cell-padding', 12);
    const knobSize = getCSSVariableAsNumber('knob-size', 45);
    const paramCellMinHeight = getCSSVariableAsNumber('param-cell-min-height', 56);
    const labelFontSize = getCSSVariableAsNumber('param-label-font-size', 18);
    const extraSpacing = getCSSVariableAsNumber('param-label-knob-spacing', 20);
    const valueSpacing = getCSSVariableAsNumber('knob-value-spacing', 4);
    const registry = getParameterUIRegistry();

    const getCellHeight = (paramName: string): number => {
      const uiType = registry.getRenderer(spec, paramName).getUIType();
      return uiType === 'input' ? paramCellMinHeight : knobSize + cellPadding * 2;
    };
    
    // Organize parameters by groups
    const { groupedParams, ungroupedParams } = this.organizeParametersByGroups(spec);
    
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
    
    const gridX = node.position.x + gridPadding;
    const gridY = node.position.y + metrics.headerHeight + startY;
    let currentY = 0; // Relative to gridY
    
    // Add top padding only when we have groups and the first group has a label.
    // When there are no groups, BodyFlexboxLayout already applies body padding above
    // this slot, so adding param-body-top-padding would double-count (e.g. OKLCH node).
    const firstGroupHasLabel = groupedParams.length > 0 && groupedParams[0].label && groupedParams[0].parameters.length > 0;
    if (groupedParams.length > 0 && !firstGroupHasLabel) {
      currentY += bodyTopPadding;
    }
    
    // Process grouped parameters
    groupedParams.forEach((group, groupIndex) => {
      if (group.parameters.length === 0) return;
      
      // Add divider before group (except first group)
      if (groupIndex > 0) {
        currentY += groupDividerSpacing;
        currentY += groupDividerHeight;
        currentY += groupDividerSpacing;
      }
      
      // Add group header
      if (group.label) {
        currentY += groupHeaderMarginTop;
        currentY += groupHeaderHeight;
        currentY += groupHeaderMarginBottom;
      }
      
      // Cells in each row fill the row: 1 cell fills width, 2 share equally, etc.
      const cellItems: FlexItem[] = group.parameters.map((paramName, index) => {
        const cellHeight = getCellHeight(paramName);
        return {
          id: `cell-${index}`,
          properties: {
            width: cellMinWidth, // Will be adjusted by flexbox
            height: cellHeight,
            minWidth: cellMinWidth,
            flexShrink: 1,
            flexGrow: 1
          }
        };
      });
      
      // Use FlexboxLayoutEngine to calculate grid layout for this group
      const groupGridLayout = this.flexboxEngine.calculateLayout(
        gridX,
        gridY + currentY,
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
      
      // Extract cell layouts and normalize row heights
      const cellLayouts = new Map<string, { x: number; y: number; width: number; height: number }>();
      group.parameters.forEach((_paramName, index) => {
        const cellResult = groupGridLayout.items.get(`cell-${index}`);
        if (cellResult && 'x' in cellResult) {
          cellLayouts.set(`cell-${index}`, cellResult);
        }
      });
      
      // Normalize row heights
      this.normalizeRowHeights(cellLayouts, gridGap);
      
      // Calculate parameter positions from normalized cell layouts
      group.parameters.forEach((paramName, index) => {
        const cellLayout = cellLayouts.get(`cell-${index}`);
        if (!cellLayout) return;
        
        const cellX = cellLayout.x;
        const cellY = cellLayout.y;
        const cellWidth = cellLayout.width;
        const cellHeightNormalized = cellLayout.height;
        
        // Calculate internal element positions (absolute within cell)
        const portX = cellX + cellPadding;
        const labelY = cellY + cellPadding;
        const portY = labelY + labelFontSize / 2;
        const labelX = cellX + cellWidth / 2;
        const knobX = cellX + cellWidth / 2;
        const contentY = cellY + cellPadding;
        const labelBottom = contentY + labelFontSize;
        const knobY = labelBottom + extraSpacing + knobSize / 2;
        const valueX = knobX;
        const valueY = knobY + knobSize / 2 + valueSpacing;
        
        parameterGridPositions.set(paramName, {
          cellX,
          cellY,
          cellWidth,
          cellHeight: cellHeightNormalized,
          knobX,
          knobY,
          portX,
          portY,
          labelX,
          labelY,
          valueX,
          valueY
        });
      });
      
      // Update currentY based on grid layout height.
      //
      // IMPORTANT: Height must be independent of absolute canvas/world coordinates.
      // Using an accumulator initialized to 0 would anchor to world-origin and make
      // the computed height depend on node.position.y when dragged into negative Y.
      // Fix: compute max bottom edge relative to this element's origin (gridY).
      let maxBottom = gridY + currentY;
      for (const cell of cellLayouts.values()) {
        maxBottom = Math.max(maxBottom, cell.y + cell.height);
      }
      currentY = Math.max(0, maxBottom - gridY);
    });
    
    // Add divider before ungrouped params if there are groups
    if (groupedParams.length > 0 && ungroupedParams.length > 0) {
      currentY += groupDividerSpacing;
      currentY += groupDividerHeight;
      currentY += groupDividerSpacing;
    }
    
    // Process ungrouped parameters
    if (ungroupedParams.length > 0) {
      // Cells in each row fill the row: 1 cell fills width, 2 share equally, etc.
      const cellItems: FlexItem[] = ungroupedParams.map((paramName, index) => {
        const cellHeight = getCellHeight(paramName);
        return {
          id: `cell-${index}`,
          properties: {
            width: cellMinWidth,
            height: cellHeight,
            minWidth: cellMinWidth,
            flexShrink: 1,
            flexGrow: 1
          }
        };
      });
      
      // Use FlexboxLayoutEngine to calculate grid layout
      const ungroupedGridLayout = this.flexboxEngine.calculateLayout(
        gridX,
        gridY + currentY,
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
      
      // Extract cell layouts and normalize row heights
      const cellLayouts = new Map<string, { x: number; y: number; width: number; height: number }>();
      ungroupedParams.forEach((_paramName, index) => {
        const cellResult = ungroupedGridLayout.items.get(`cell-${index}`);
        if (cellResult && 'x' in cellResult) {
          cellLayouts.set(`cell-${index}`, cellResult);
        }
      });
      
      // Normalize row heights
      this.normalizeRowHeights(cellLayouts, gridGap);
      
      // Calculate parameter positions from normalized cell layouts
      ungroupedParams.forEach((paramName, index) => {
        const cellLayout = cellLayouts.get(`cell-${index}`);
        if (!cellLayout) return;
        
        const cellX = cellLayout.x;
        const cellY = cellLayout.y;
        const cellWidth = cellLayout.width;
        const cellHeightNormalized = cellLayout.height;
        
        // Calculate internal element positions (absolute within cell)
        const portX = cellX + cellPadding;
        const labelY = cellY + cellPadding;
        const portY = labelY + labelFontSize / 2;
        const labelX = cellX + cellWidth / 2;
        const knobX = cellX + cellWidth / 2;
        const contentY = cellY + cellPadding;
        const labelBottom = contentY + labelFontSize;
        const knobY = labelBottom + extraSpacing + knobSize / 2;
        const valueX = knobX;
        const valueY = knobY + knobSize / 2 + valueSpacing;
        
        parameterGridPositions.set(paramName, {
          cellX,
          cellY,
          cellWidth,
          cellHeight: cellHeightNormalized,
          knobX,
          knobY,
          portX,
          portY,
          labelX,
          labelY,
          valueX,
          valueY
        });
      });
      
      // Update currentY based on grid layout height.
      //
      // IMPORTANT: Height must be independent of absolute canvas/world coordinates.
      // Fix: compute max bottom edge relative to this element's origin (gridY).
      let maxBottom = gridY + currentY;
      for (const cell of cellLayouts.values()) {
        maxBottom = Math.max(maxBottom, cell.y + cell.height);
      }
      currentY = Math.max(0, maxBottom - gridY);
    }
    
    return {
      x: node.position.x,
      y: node.position.y + metrics.headerHeight + startY,
      width: availableWidth,
      height: currentY,
      parameterGridPositions
    };
  }

  private organizeParametersByGroups(spec: NodeSpec): {
    groupedParams: Array<{ label: string | null; parameters: string[] }>;
    ungroupedParams: string[];
  } {
    const allParamNames = new Set(Object.keys(spec.parameters));
    const groupedParamNames = new Set<string>();
    const groupedParams: Array<{ label: string | null; parameters: string[] }> = [];

    if (spec.parameterGroups) {
      spec.parameterGroups.forEach((group) => {
        const groupParams = group.parameters.filter(name => allParamNames.has(name));
        if (groupParams.length > 0) {
          groupedParams.push({
            label: group.label || null,
            parameters: groupParams
          });
          groupParams.forEach(name => groupedParamNames.add(name));
        }
      });
    }

    const ungroupedParams = Array.from(allParamNames).filter(name => !groupedParamNames.has(name));

    return { groupedParams, ungroupedParams };
  }

  private normalizeRowHeights(
    cellLayouts: Map<string, { x: number; y: number; width: number; height: number }>,
    _gridGap: number
  ): void {
    const rows = new Map<number, Array<{ id: string; height: number }>>();
    const tolerance = 1;

    for (const [id, cell] of cellLayouts) {
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

    rows.forEach((cells) => {
      const maxHeight = Math.max(...cells.map(c => c.height));
      cells.forEach(({ id }) => {
        const cell = cellLayouts.get(id);
        if (cell) {
          cell.height = maxHeight;
        }
      });
    });
  }
}

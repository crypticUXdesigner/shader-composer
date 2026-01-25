/**
 * Node Metrics Calculator
 * 
 * Calculates layout metrics for nodes including dimensions, header height,
 * parameter grid positions, and port positions.
 * Includes caching to avoid recalculating metrics unnecessarily.
 */

import type { NodeInstance } from '../../../types/nodeGraph';
import type { NodeSpec, LayoutElement } from '../../../types/nodeSpec';
import type { NodeRenderMetrics } from '../NodeRenderer';
import { getCSSVariableAsNumber } from '../../../utils/cssTokens';
import { ParameterLayoutManager } from './layout/ParameterLayoutManager';
import type { ElementMetrics } from './layout/LayoutElementRenderer';

export class NodeMetricsCalculator {
  private cache: Map<string, NodeRenderMetrics> = new Map();
  private ctx: CanvasRenderingContext2D;
  private layoutManager: ParameterLayoutManager;
  
  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.layoutManager = new ParameterLayoutManager(ctx);
  }
  
  /**
   * Calculate metrics for a node (with caching)
   */
  calculate(node: NodeInstance, spec: NodeSpec): NodeRenderMetrics {
    const cacheKey = this.getCacheKey(node, spec);
    
    // Check cache
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    // Calculate metrics
    const metrics = this.calculateMetrics(node, spec);
    
    // Cache result
    this.cache.set(cacheKey, metrics);
    
    return metrics;
  }
  
  /**
   * Generate cache key for a node
   */
  private getCacheKey(node: NodeInstance, spec: NodeSpec): string {
    // Include all factors that affect metrics
    // Note: Position is NOT included because metrics are relative to node position,
    // but port positions in the returned metrics ARE absolute (include node.position).
    // So we need to invalidate cache when position changes.
    return `${node.id}-${node.collapsed}-${node.label || ''}-${
      JSON.stringify(node.parameters)
    }-${spec.id}`;
  }
  
  /**
   * Invalidate cache for a specific node
   */
  invalidate(nodeId: string): void {
    // Remove all cache entries for this node
    for (const [key] of this.cache) {
      if (key.startsWith(`${nodeId}-`)) {
        this.cache.delete(key);
      }
    }
  }
  
  /**
   * Clear all cached metrics
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Calculate metrics for a node (actual implementation)
   */
  private calculateMetrics(node: NodeInstance, spec: NodeSpec): NodeRenderMetrics {
    const minWidth = getCSSVariableAsNumber('node-box-min-width', 300);
    const headerHeight = getCSSVariableAsNumber('node-header-height', 70);
    const headerMinHeight = getCSSVariableAsNumber('node-header-min-height', 70);
    const headerPadding = getCSSVariableAsNumber('node-header-padding', 12);
    const nameSize = getCSSVariableAsNumber('node-header-name-size', 14);
    const inputPortSpacing = getCSSVariableAsNumber('node-header-input-port-spacing', 28);
    const portSize = getCSSVariableAsNumber('node-port-size', 8);
    
    // Calculate header height based on content
    const iconBoxHeight = getCSSVariableAsNumber('node-icon-box-height', 48);
    const iconBoxNameSpacing = getCSSVariableAsNumber('node-icon-box-name-spacing', 4);
    const iconAndNameHeight = iconBoxHeight + iconBoxNameSpacing + nameSize;
    const inputPortsHeight = spec.inputs.length > 0 ? (spec.inputs.length - 1) * inputPortSpacing + portSize * 2 : 0;
    const outputPortsHeight = spec.outputs.length > 0 ? (spec.outputs.length - 1) * inputPortSpacing + portSize * 2 : 0;
    const portsHeight = Math.max(inputPortsHeight, outputPortsHeight);
    // Content determines height, but respect minimum and use headerHeight as target/default
    const contentHeight = Math.max(iconAndNameHeight, portsHeight + headerPadding * 2);
    const targetHeight = Math.max(headerHeight, contentHeight);
    const actualHeaderHeight = Math.max(headerMinHeight, targetHeight);
    
    // Organize parameters by groups (needed for width calculation)
    const { groupedParams, ungroupedParams } = this.organizeParametersByGroups(spec);
    
    // Calculate total width first (needed for grid calculations)
    this.ctx.font = `${getCSSVariableAsNumber('node-header-name-weight', 600)} ${nameSize}px "Space Grotesk", sans-serif`;
    const titleWidth = this.ctx.measureText(node.label || spec.displayName).width;
    let width = Math.max(minWidth, titleWidth + 100);
    
    // Adjust width if needed for parameter grid
    const isBezierNode = this.isBezierCurveNode(spec);
    if (!node.collapsed && Object.keys(spec.parameters).length > 0) {
      const gridPadding = getCSSVariableAsNumber('node-body-padding', 18);
      
      if (isBezierNode) {
        // For bezier nodes, calculate width needed for bezier editor
        const portSize = getCSSVariableAsNumber('param-port-size', 6);
        const portToModeSpacing = 8;
        const modeButtonSize = getCSSVariableAsNumber('param-mode-button-size', 24);
        const modeToLabelSpacing = 8;
        const labelWidth = 60; // Approximate label width
        const bezierEditorMinWidth = 250; // Minimum width for bezier editor
        
        const leftEdgeWidth = gridPadding + portSize + portToModeSpacing + modeButtonSize + modeToLabelSpacing + labelWidth;
        const minBezierWidth = leftEdgeWidth + bezierEditorMinWidth + gridPadding;
        width = Math.max(width, minBezierWidth);
      } else {
        const gridGap = getCSSVariableAsNumber('param-grid-gap', 12);
        const cellMinWidth = getCSSVariableAsNumber('param-cell-min-width', 120);
        
        // Check all groups to find max columns needed
        let maxColumns = 1;
        [...groupedParams, { parameters: ungroupedParams }].forEach((group) => {
          if (group.parameters.length > 0) {
            const cols = this.calculateOptimalColumns(group.parameters.length);
            maxColumns = Math.max(maxColumns, cols);
          }
        });
        
        // Calculate minimum width needed for grid
        const minGridWidth = gridPadding * 2 + (maxColumns * cellMinWidth) + ((maxColumns - 1) * gridGap);
        width = Math.max(width, minGridWidth);
      }
    }
    
    // Calculate parameter grid height (only if node is not collapsed)
    let paramsHeight = 0;
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
    let elementMetrics: Map<LayoutElement, ElementMetrics> | undefined = undefined;
    
    if (!node.collapsed && Object.keys(spec.parameters).length > 0) {
      // Check if node uses new layout system
      if (spec.parameterLayout) {
        const layoutResult = this.layoutManager.calculateMetrics(
          node,
          spec,
          node.position.x,
          node.position.y,
          width,
          actualHeaderHeight,
          {
            width,
            headerHeight: actualHeaderHeight,
            portPositions: new Map(),
            parameterGridPositions: new Map(),
            parameterPositions: new Map(),
            parameterInputPortPositions: new Map()
          }
        );
        
        // Merge parameter positions from layout
        layoutResult.parameterGridPositions.forEach((pos, paramName) => {
          parameterGridPositions.set(paramName, pos);
        });
        
        paramsHeight = layoutResult.totalHeight;
        elementMetrics = layoutResult.elementMetrics;
      } else {
        // Fallback to legacy layout system
        const gridPadding = getCSSVariableAsNumber('node-body-padding', 18);
        const gridGap = getCSSVariableAsNumber('param-grid-gap', 12);
        const cellMinWidth = getCSSVariableAsNumber('param-cell-min-width', 120);
        const cellHeight = getCSSVariableAsNumber('param-cell-height', 100);
        const groupHeaderHeight = getCSSVariableAsNumber('param-group-header-height', 24);
        const groupHeaderMarginTop = getCSSVariableAsNumber('param-group-header-margin-top', 0);
        const groupHeaderMarginBottom = getCSSVariableAsNumber('param-group-header-margin-bottom', 0);
        const groupDividerHeight = getCSSVariableAsNumber('param-group-divider-height', 1);
        const groupDividerSpacing = getCSSVariableAsNumber('param-group-divider-spacing', 12);
        const bodyTopPadding = getCSSVariableAsNumber('param-body-top-padding', 24);
        const knobSize = getCSSVariableAsNumber('knob-size', 45);
        const valueSpacing = getCSSVariableAsNumber('knob-value-spacing', 4);
        let currentY = 0;
        
        // Check for range editor node
        const rangeParams = ['inMin', 'inMax', 'outMin', 'outMax'];
        const isRangeNode = this.isRangeEditorNode(spec, rangeParams);
      
      // Handle range editor node specially
      if (isRangeNode) {
        currentY += bodyTopPadding;
        const sliderUIHeight = getCSSVariableAsNumber('range-editor-height', 180);
        const rangeParamCellHeight = 120;
        const columns = 2;
        // Layout: Row 1: In Max - Out Max, Row 2: In Min - Out Min
        const allParams = ['inMax', 'outMax', 'inMin', 'outMin', 'clamp'];
        const rows = Math.ceil(allParams.length / columns);
        const paramGridHeight = rangeParamCellHeight * rows + gridGap * (rows - 1);
        
        // Calculate grid positions for all 5 parameters
        const paramGridX = node.position.x + gridPadding;
        const paramGridY = node.position.y + actualHeaderHeight + currentY + sliderUIHeight + gridGap;
        const paramGridWidth = width - gridPadding * 2;
        const paramCellWidth = (paramGridWidth - gridGap) / columns;
        
        allParams.forEach((paramName, index) => {
          const row = Math.floor(index / columns);
          const col = index % columns;
          const cellX = paramGridX + col * (paramCellWidth + gridGap);
          const cellY = paramGridY + row * (rangeParamCellHeight + gridGap);
          
          const paramSpec = spec.parameters[paramName];
          if (!paramSpec) return;
          
          // Calculate positions matching renderSimpleInputField/renderToggle
          const cellPadding = getCSSVariableAsNumber('param-cell-padding', 12);
          const labelFontSize = getCSSVariableAsNumber('param-label-font-size', 11);
          // Port positioned: X uses cellPadding, Y is vertically centered with label text
          const portX = cellX + cellPadding;
          const labelY = cellY + cellPadding;
          const portY = labelY + labelFontSize / 2; // Port center aligns with label text center
          const labelX = cellX + paramCellWidth / 2;
          
          // For input field position (where knob would be)
          const extraSpacing = getCSSVariableAsNumber('param-label-knob-spacing', 20);
          const contentY = cellY + cellPadding;
          const labelBottom = contentY + labelFontSize;
          const inputFieldCenterY = labelBottom + extraSpacing;
          const inputFieldX = cellX + paramCellWidth / 2;
          
          parameterGridPositions.set(paramName, {
            cellX,
            cellY,
            cellWidth: paramCellWidth,
            cellHeight: rangeParamCellHeight,
            knobX: inputFieldX,
            knobY: inputFieldCenterY,
            portX,
            portY,
            labelX,
            labelY,
            valueX: inputFieldX,
            valueY: inputFieldCenterY
          });
        });
        
        currentY += sliderUIHeight + gridGap + paramGridHeight;
        paramsHeight = currentY + gridPadding; // Add bottom padding
      } else if (isBezierNode) {
        currentY += bodyTopPadding;
        const bezierEditorHeight = getCSSVariableAsNumber('bezier-editor-height', 200);
        const portSize = getCSSVariableAsNumber('param-port-size', 6);
        // Use larger spacing for bezier curve parameters
        const bezierPortSpacing = getCSSVariableAsNumber('bezier-param-port-spacing', 40);
        const modeButtonSize = getCSSVariableAsNumber('param-mode-button-size', 24);
        
        // Calculate left edge space for ports, mode buttons, type labels, and name labels
        const leftEdgePadding = gridPadding;
        const portX = node.position.x + leftEdgePadding;
        const portToModeSpacing = 8;
        const modeButtonX = portX + portSize + portToModeSpacing;
        const modeToTypeSpacing = 8;
        const typeLabelX = modeButtonX + modeButtonSize + modeToTypeSpacing;
        const typeToNameSpacing = 8;
        // Approximate type label width (will be adjusted during rendering)
        const typeLabelWidth = 50;
        const labelX = typeLabelX + typeLabelWidth + typeToNameSpacing;
        const labelWidth = 60; // Approximate label width
        const bezierEditorX = labelX + labelWidth;
        // Ensure bezier editor is within node bounds and has minimum width
        const maxBezierEditorX = node.position.x + width - gridPadding;
        const actualBezierEditorX = Math.min(bezierEditorX, maxBezierEditorX - 200); // Leave at least 200px width
        const bezierEditorWidth = Math.max(200, maxBezierEditorX - actualBezierEditorX);
        
        // Position for each bezier parameter (x1, y1, x2, y2)
        const bezierParams = ['x1', 'y1', 'x2', 'y2'];
        const basePortY = node.position.y + actualHeaderHeight + currentY;
        // Distribute ports evenly across bezier editor height
        const totalSpacing = (bezierParams.length - 1) * bezierPortSpacing;
        const startOffset = (bezierEditorHeight - totalSpacing) / 2;
        bezierParams.forEach((paramName, index) => {
          const portY = basePortY + startOffset + index * bezierPortSpacing;
          const labelY = portY;
          
          parameterGridPositions.set(paramName, {
            cellX: actualBezierEditorX,
            cellY: node.position.y + actualHeaderHeight + currentY,
            cellWidth: bezierEditorWidth,
            cellHeight: bezierEditorHeight,
            knobX: 0, // Not used for bezier
            knobY: 0, // Not used for bezier
            portX: portX,
            portY: portY,
            labelX: labelX,
            labelY: labelY,
            valueX: 0, // Not used for bezier
            valueY: 0 // Not used for bezier
          });
        });
        
        currentY += bezierEditorHeight + gridPadding;
        paramsHeight = currentY;
      } else {
      
      // Add top padding if body doesn't start with a group header
      // (either no groups at all, or first group has no label)
      const firstGroupHasLabel = groupedParams.length > 0 && groupedParams[0].label && groupedParams[0].parameters.length > 0;
      if (groupedParams.length === 0 || !firstGroupHasLabel) {
        currentY += bodyTopPadding;
      }
      
      // Process grouped parameters
      groupedParams.forEach((group, groupIndex) => {
        if (group.parameters.length === 0) return;
        
        // Add divider before group (except first group)
        if (groupIndex > 0) {
          // Add spacing before divider
          currentY += groupDividerSpacing;
          // Divider height (for calculation only, not rendered here)
          currentY += groupDividerHeight;
          // Add spacing after divider
          currentY += groupDividerSpacing;
        }
        
        // Add group header (with margins to match rendering)
        if (group.label) {
          currentY += groupHeaderMarginTop;
          currentY += groupHeaderHeight;
          currentY += groupHeaderMarginBottom;
        }
        
        // Calculate grid for this group
        const columns = this.calculateOptimalColumns(group.parameters.length);
        const availableWidth = width - gridPadding * 2;
        const cellWidth = Math.max(cellMinWidth, (availableWidth - gridGap * (columns - 1)) / columns);
        const rows = Math.ceil(group.parameters.length / columns);
        
        // Calculate positions for each parameter in the group
        group.parameters.forEach((paramName, index) => {
          const row = Math.floor(index / columns);
          const col = index % columns;
          const cellX = node.position.x + gridPadding + col * (cellWidth + gridGap);
          const cellY = node.position.y + actualHeaderHeight + currentY + row * (cellHeight + gridGap);
          
          // Calculate sub-element positions accounting for cell padding
          const cellPadding = getCSSVariableAsNumber('param-cell-padding', 12);
          const labelFontSize = getCSSVariableAsNumber('param-label-font-size', 11);
          const extraSpacing = getCSSVariableAsNumber('param-label-knob-spacing', 20);
          
          // Port positioned: X uses cellPadding, Y is vertically centered with label text
          const portX = cellX + cellPadding;
          const labelY = cellY + cellPadding;
          const portY = labelY + labelFontSize / 2; // Port center aligns with label text center
          
          // Parameter name label horizontally centered at the top
          const labelX = cellX + cellWidth / 2; // Horizontally centered
          
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
            cellHeight,
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
        
        // Update currentY after this group
        currentY += rows * (cellHeight + gridGap) - gridGap;
      });
      
      // Add divider before ungrouped params if there are groups
      if (groupedParams.length > 0 && ungroupedParams.length > 0) {
        // Add spacing before divider
        currentY += groupDividerSpacing;
        // Divider height (for calculation only, not rendered here)
        currentY += groupDividerHeight;
        // Add spacing after divider
        currentY += groupDividerSpacing;
      }
      
      // Process ungrouped parameters
      if (ungroupedParams.length > 0) {
        const columns = this.calculateOptimalColumns(ungroupedParams.length);
        const availableWidth = width - gridPadding * 2;
        const cellWidth = Math.max(cellMinWidth, (availableWidth - gridGap * (columns - 1)) / columns);
        const rows = Math.ceil(ungroupedParams.length / columns);
        
        ungroupedParams.forEach((paramName, index) => {
          const row = Math.floor(index / columns);
          const col = index % columns;
          const cellX = node.position.x + gridPadding + col * (cellWidth + gridGap);
          const cellY = node.position.y + actualHeaderHeight + currentY + row * (cellHeight + gridGap);
          
          // Calculate sub-element positions accounting for cell padding
          const cellPadding = getCSSVariableAsNumber('param-cell-padding', 12);
          const labelFontSize = getCSSVariableAsNumber('param-label-font-size', 11);
          const extraSpacing = getCSSVariableAsNumber('param-label-knob-spacing', 20);
          
          // Port positioned: X uses cellPadding, Y is vertically centered with label text
          const portX = cellX + cellPadding;
          const labelY = cellY + cellPadding;
          const portY = labelY + labelFontSize / 2; // Port center aligns with label text center
          
          // Parameter name label horizontally centered at the top
          const labelX = cellX + cellWidth / 2; // Horizontally centered
          
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
            cellHeight,
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
        
        currentY += rows * (cellHeight + gridGap) - gridGap;
      }
      
      paramsHeight = currentY + gridPadding;
      }
      }
    }
    
    // Calculate total height
    const totalHeight = actualHeaderHeight + paramsHeight;
    
    // Calculate port positions (in header)
    const portPositions = new Map<string, { x: number; y: number; isOutput: boolean }>();
    
    // Input ports (left edge of header)
    spec.inputs.forEach((port, index) => {
      const portY = node.position.y + headerPadding + (index * inputPortSpacing) + portSize;
      portPositions.set(`input:${port.name}`, {
        x: node.position.x,
        y: portY,
        isOutput: false
      });
    });
    
    // Output ports (right edge of header)
    spec.outputs.forEach((port, index) => {
      const portY = node.position.y + headerPadding + (index * inputPortSpacing) + portSize;
      portPositions.set(`output:${port.name}`, {
        x: node.position.x + width,
        y: portY,
        isOutput: true
      });
    });
    
    // Keep old parameter positions for compatibility (empty for now)
    const parameterPositions = new Map<string, { x: number; y: number; width: number; height: number }>();
    const parameterInputPortPositions = new Map<string, { x: number; y: number }>();
    
    // Populate old format from new format for compatibility
    parameterGridPositions.forEach((pos, paramName) => {
      parameterPositions.set(paramName, {
        x: pos.cellX,
        y: pos.cellY,
        width: pos.cellWidth,
        height: pos.cellHeight
      });
      
      const paramSpec = spec.parameters[paramName];
      if (paramSpec && (paramSpec.type === 'float' || paramSpec.type === 'int')) {
        parameterInputPortPositions.set(paramName, {
          x: pos.portX,
          y: pos.portY
        });
      }
    });
    
    return {
      width,
      height: totalHeight,
      headerHeight: actualHeaderHeight,
      portPositions,
      parameterGridPositions,
      parameterPositions,
      parameterInputPortPositions,
      elementMetrics
    };
  }
  
  // Check if a node is a bezier curve node (has x1, y1, x2, y2 parameters)
  private isBezierCurveNode(spec: NodeSpec): boolean {
    return spec.id === 'bezier-curve' || (
      spec.parameters.x1 !== undefined &&
      spec.parameters.y1 !== undefined &&
      spec.parameters.x2 !== undefined &&
      spec.parameters.y2 !== undefined &&
      spec.parameters.x1.type === 'float' &&
      spec.parameters.y1.type === 'float' &&
      spec.parameters.x2.type === 'float' &&
      spec.parameters.y2.type === 'float'
    );
  }

  private isRangeEditorNode(spec: NodeSpec, paramNames: string[]): boolean {
    return paramNames.includes('inMin') && paramNames.includes('inMax') &&
           paramNames.includes('outMin') && paramNames.includes('outMax') &&
           spec.parameters.inMin?.type === 'float' &&
           spec.parameters.inMax?.type === 'float' &&
           spec.parameters.outMin?.type === 'float' &&
           spec.parameters.outMax?.type === 'float';
  }

  private organizeParametersByGroups(spec: NodeSpec): {
    groupedParams: Array<{ label: string | null; parameters: string[] }>;
    ungroupedParams: string[];
  } {
    const allParamNames = new Set(Object.keys(spec.parameters));
    const groupedParamNames = new Set<string>();
    const groupedParams: Array<{ label: string | null; parameters: string[] }> = [];
    
    // Process parameter groups
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
    
    // Find ungrouped parameters
    const ungroupedParams = Array.from(allParamNames).filter(name => !groupedParamNames.has(name));
    
    return { groupedParams, ungroupedParams };
  }
  
  // Calculate optimal column count for parameter grid
  private calculateOptimalColumns(paramCount: number): number {
    if (paramCount <= 1) return 1;
    if (paramCount <= 2) return 2;
    
    // Special case: 5 and 6 elements should use 3 columns and 2 rows
    if (paramCount === 5 || paramCount === 6) return 3;
    
    // For 3+, try to minimize empty cells
    // Calculate rows for 2, 3, 4 columns and pick best
    let bestColumns = 2;
    let bestEmptyCells = Infinity;
    
    for (let cols = 2; cols <= 4; cols++) {
      const rows = Math.ceil(paramCount / cols);
      const emptyCells = (rows * cols) - paramCount;
      if (emptyCells < bestEmptyCells) {
        bestEmptyCells = emptyCells;
        bestColumns = cols;
      }
    }
    
    return bestColumns;
  }
}

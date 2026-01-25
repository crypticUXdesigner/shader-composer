/**
 * Auto Grid Element Renderer
 * 
 * Automatically generates a grid from all node parameters.
 * Respects parameterGroups if defined.
 */

import type { NodeInstance } from '../../../../../types/nodeGraph';
import type { NodeSpec, AutoGridElement as AutoGridElementType } from '../../../../../types/nodeSpec';
import type { NodeRenderMetrics } from '../../../NodeRenderer';
import type { LayoutElementRenderer, ElementMetrics } from '../LayoutElementRenderer';
import { getCSSVariableAsNumber } from '../../../../../utils/cssTokens';
import { getParameterUIRegistry } from '../../ParameterUIRegistry';

export class AutoGridElementRenderer implements LayoutElementRenderer {
  private ctx: CanvasRenderingContext2D;
  private parameterRegistry = getParameterUIRegistry();
  
  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }
  
  canHandle(element: any): boolean {
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
    const gridGap = getCSSVariableAsNumber('param-grid-gap', 12);
    const cellMinWidth = getCSSVariableAsNumber('param-cell-min-width', 220);
    const cellHeight = getCSSVariableAsNumber('param-cell-height', 200);
    const groupHeaderHeight = getCSSVariableAsNumber('param-group-header-height', 24);
    const groupHeaderMarginTop = getCSSVariableAsNumber('param-group-header-margin-top', 0);
    const groupHeaderMarginBottom = getCSSVariableAsNumber('param-group-header-margin-bottom', 0);
    const groupDividerHeight = getCSSVariableAsNumber('param-group-divider-height', 1);
    const groupDividerSpacing = getCSSVariableAsNumber('param-group-divider-spacing', 12);
    const bodyTopPadding = getCSSVariableAsNumber('param-body-top-padding', 24);
    
    // Organize parameters by groups
    const { groupedParams, ungroupedParams } = this.organizeParametersByGroups(spec);
    
    let currentY = 0; // Relative to startY
    
    // Add top padding if body doesn't start with a group header
    const firstGroupHasLabel = groupedParams.length > 0 && groupedParams[0].label && groupedParams[0].parameters.length > 0;
    if (groupedParams.length === 0 || !firstGroupHasLabel) {
      currentY += bodyTopPadding;
    }
    
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
      
      // Calculate grid for this group
      const columns = this.calculateOptimalColumns(group.parameters.length);
      const cellWidth = Math.max(cellMinWidth, (availableWidth - gridGap * (columns - 1)) / columns);
      const rows = Math.ceil(group.parameters.length / columns);
      
      // Calculate positions for each parameter
      const gridPadding = getCSSVariableAsNumber('node-body-padding', 18);
      group.parameters.forEach((paramName, index) => {
        const row = Math.floor(index / columns);
        const col = index % columns;
        const cellX = node.position.x + gridPadding + col * (cellWidth + gridGap);
        const cellY = node.position.y + metrics.headerHeight + startY + currentY + row * (cellHeight + gridGap);
        
        // Calculate sub-element positions
        const cellPadding = getCSSVariableAsNumber('param-cell-padding', 12);
        const labelFontSize = getCSSVariableAsNumber('param-label-font-size', 11);
        const extraSpacing = getCSSVariableAsNumber('param-label-knob-spacing', 20);
        const knobSize = getCSSVariableAsNumber('knob-size', 45);
        const valueSpacing = getCSSVariableAsNumber('knob-value-spacing', 4);
        
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
    });
    
    // Add divider before ungrouped params if there are groups
    if (groupedParams.length > 0 && ungroupedParams.length > 0) {
      currentY += groupDividerSpacing;
      currentY += groupDividerHeight;
      currentY += groupDividerSpacing;
    }
    
    // Process ungrouped parameters
    if (ungroupedParams.length > 0) {
      const columns = this.calculateOptimalColumns(ungroupedParams.length);
      const cellWidth = Math.max(cellMinWidth, (availableWidth - gridGap * (columns - 1)) / columns);
      const rows = Math.ceil(ungroupedParams.length / columns);
      
      const gridPadding = getCSSVariableAsNumber('node-body-padding', 18);
      ungroupedParams.forEach((paramName, index) => {
        const row = Math.floor(index / columns);
        const col = index % columns;
        const cellX = node.position.x + gridPadding + col * (cellWidth + gridGap);
        const cellY = node.position.y + metrics.headerHeight + startY + currentY + row * (cellHeight + gridGap);
        
        const cellPadding = getCSSVariableAsNumber('param-cell-padding', 12);
        const labelFontSize = getCSSVariableAsNumber('param-label-font-size', 11);
        const extraSpacing = getCSSVariableAsNumber('param-label-knob-spacing', 20);
        const knobSize = getCSSVariableAsNumber('knob-size', 45);
        const valueSpacing = getCSSVariableAsNumber('knob-value-spacing', 4);
        
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
    
    return {
      x: node.position.x,
      y: node.position.y + startY,
      width: availableWidth,
      height: currentY,
      parameterGridPositions
    };
  }
  
  render(
    _element: AutoGridElementType,
    node: NodeInstance,
    spec: NodeSpec,
    elementMetrics: ElementMetrics,
    _nodeMetrics: NodeRenderMetrics,
    renderState: {
      hoveredPortName?: string | null;
      isHoveredParameter?: boolean;
      connectingPortName?: string | null;
      isConnectingParameter?: boolean;
      connectedParameters?: Set<string>;
      effectiveParameterValues?: Map<string, number | null>;
      skipPorts?: boolean;
    }
  ): void {
    const parameterGridPositions = elementMetrics.parameterGridPositions;
    if (!parameterGridPositions) return;
    
    // Get all parameters (auto-grid includes all)
    const allParams = Object.keys(spec.parameters);
    
    // Render each parameter using positions from metrics
    allParams.forEach((paramName) => {
      const gridPos = parameterGridPositions.get(paramName);
      if (!gridPos) return;
      
      const paramSpec = spec.parameters[paramName];
      if (!paramSpec) return;
      
      const isParamHovered = (renderState.hoveredPortName === paramName && renderState.isHoveredParameter) ?? false;
      const effectiveValue = renderState.effectiveParameterValues?.get(paramName) ?? null;
      const isConnected = renderState.connectedParameters?.has(paramName) ?? false;
      
      if (paramSpec.type === 'float' || paramSpec.type === 'int') {
        // Use parameter registry for float/int parameters
        const renderer = this.parameterRegistry.getRenderer(spec, paramName);
        renderer.render(
          this.ctx,
          node,
          spec,
          paramName,
          gridPos,
          {
            isConnected,
            isHovered: isParamHovered,
            effectiveValue,
            skipPorts: renderState.skipPorts ?? false
          }
        );
      } else if (paramSpec.type === 'string' || paramSpec.type === 'array') {
        // String and array parameters need special rendering
        // These are handled by NodeRenderer methods, so we'll skip them here
        // and they'll be rendered by NodeRenderer if needed
        // TODO: Extract string/array rendering to a shared utility
        console.warn(`AutoGridElementRenderer: ${paramSpec.type} parameters not yet supported in layout system`);
      }
    });
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
  
  private calculateOptimalColumns(paramCount: number): number {
    if (paramCount <= 1) return 1;
    if (paramCount <= 2) return 2;
    
    if (paramCount === 5 || paramCount === 6) return 3;
    
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

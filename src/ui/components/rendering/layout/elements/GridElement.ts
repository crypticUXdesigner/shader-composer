/**
 * Grid Element Renderer
 * 
 * Explicit grid with layout control and parameter selection.
 */

import type { NodeInstance } from '../../../../../types/nodeGraph';
import type { NodeSpec, GridElement as GridElementType } from '../../../../../types/nodeSpec';
import type { NodeRenderMetrics } from '../../../NodeRenderer';
import type { LayoutElementRenderer, ElementMetrics } from '../LayoutElementRenderer';
import type { ParameterRenderer } from '../../parameters/ParameterRenderer';
import { getCSSVariableAsNumber } from '../../../../../utils/cssTokens';
import { getParameterUIRegistry } from '../../ParameterUIRegistry';

export class GridElementRenderer implements LayoutElementRenderer {
  private ctx: CanvasRenderingContext2D;
  private parameterRegistry = getParameterUIRegistry();
  
  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }
  
  canHandle(element: any): boolean {
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
    const gridGap = getCSSVariableAsNumber('param-grid-gap', 12);
    const defaultCellMinWidth = getCSSVariableAsNumber('param-cell-min-width', 220);
    const defaultCellHeight = getCSSVariableAsNumber('param-cell-height', 200);
    
    const layout = element.layout || {};
    const cellMinWidth = layout.cellMinWidth ?? defaultCellMinWidth;
    const cellHeight = layout.cellHeight ?? defaultCellHeight;
    const respectMinWidth = layout.respectMinWidth !== false; // Default true
    
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
    
    // Calculate columns
    let columns: number;
    if (layout.columns === 'auto' || layout.columns === undefined) {
      columns = this.calculateOptimalColumns(validParams.length);
    } else {
      columns = layout.columns;
    }
    
    // Calculate cell width
    let cellWidth: number;
    if (respectMinWidth) {
      cellWidth = Math.max(cellMinWidth, (availableWidth - gridGap * (columns - 1)) / columns);
    } else {
      cellWidth = (availableWidth - gridGap * (columns - 1)) / columns;
    }
    
    const rows = Math.ceil(validParams.length / columns);
    const gridPadding = getCSSVariableAsNumber('node-body-padding', 18);
    const cellPadding = getCSSVariableAsNumber('param-cell-padding', 12);
    const labelFontSize = getCSSVariableAsNumber('param-label-font-size', 11);
    const extraSpacing = getCSSVariableAsNumber('param-label-knob-spacing', 20);
    const knobSize = getCSSVariableAsNumber('knob-size', 45);
    const valueSpacing = getCSSVariableAsNumber('knob-value-spacing', 4);
    
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
      const row = Math.floor(index / columns);
      const col = index % columns;
      const cellX = node.position.x + gridPadding + col * (cellWidth + gridGap);
      const cellY = node.position.y + metrics.headerHeight + startY + row * (cellHeight + gridGap);
      
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
    
    const totalHeight = rows * (cellHeight + gridGap) - gridGap;
    
    return {
      x: node.position.x,
      y: node.position.y + metrics.headerHeight + startY,
      width: availableWidth,
      height: totalHeight,
      parameterGridPositions
    };
  }
  
  render(
    element: GridElementType,
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
    
    // Get parameters for this element
    const elementParams = element.parameters || [];
    
    // Render each parameter using positions from metrics
    elementParams.forEach((paramName) => {
      const gridPos = parameterGridPositions.get(paramName);
      if (!gridPos) return;
      
      const paramSpec = spec.parameters[paramName];
      if (!paramSpec) return;
      
      const isParamHovered = (renderState.hoveredPortName === paramName && renderState.isHoveredParameter) ?? false;
      const effectiveValue = renderState.effectiveParameterValues?.get(paramName) ?? null;
      const isConnected = renderState.connectedParameters?.has(paramName) ?? false;
      
      if (paramSpec.type === 'float' || paramSpec.type === 'int') {
        // Check if parameterUI override is specified for this parameter
        let renderer: ParameterRenderer;
        if (element.parameterUI && element.parameterUI[paramName]) {
          // Use the specified UI type from parameterUI override
          const uiType = element.parameterUI[paramName];
          const overrideRenderer = this.parameterRegistry.getRendererByUIType(uiType);
          if (overrideRenderer) {
            renderer = overrideRenderer;
          } else {
            // Fallback to default renderer selection if UI type not found
            renderer = this.parameterRegistry.getRenderer(spec, paramName);
          }
        } else {
          // Use default renderer selection
          renderer = this.parameterRegistry.getRenderer(spec, paramName);
        }
        
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
        console.warn(`GridElementRenderer: ${paramSpec.type} parameters not yet supported in layout system`);
      }
    });
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

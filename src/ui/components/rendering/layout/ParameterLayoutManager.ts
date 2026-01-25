/**
 * Parameter Layout Manager
 * 
 * Orchestrates the layout system for node parameters.
 * Handles the slot container (node body) and renders elements in order.
 */

import type { NodeInstance } from '../../../../types/nodeGraph';
import type { NodeSpec, LayoutElement } from '../../../../types/nodeSpec';
import type { NodeRenderMetrics } from '../../NodeRenderer';
import { getCSSVariableAsNumber } from '../../../../utils/cssTokens';
import { AutoGridElementRenderer } from './elements/AutoGridElement';
import { GridElementRenderer } from './elements/GridElement';
import { SliderUIElementRenderer } from './elements/SliderUIElement';
import { BezierEditorElementRenderer } from './elements/BezierEditorElement';
import type { LayoutElementRenderer, ElementMetrics } from './LayoutElementRenderer';

export class ParameterLayoutManager {
  private elementRenderers: LayoutElementRenderer[];
  
  constructor(ctx: CanvasRenderingContext2D) {
    
    // Register all element renderers (order matters - first match wins)
    this.elementRenderers = [
      new AutoGridElementRenderer(ctx),
      new GridElementRenderer(ctx),
      new SliderUIElementRenderer(ctx),
      new BezierEditorElementRenderer(ctx)
    ];
  }
  
  /**
   * Calculate metrics for all layout elements
   */
  calculateMetrics(
    node: NodeInstance,
    spec: NodeSpec,
    _nodeX: number,
    _nodeY: number,
    nodeWidth: number,
    headerHeight: number,
    existingMetrics: Partial<NodeRenderMetrics>
  ): {
    totalHeight: number;
    elementMetrics: Map<LayoutElement, ElementMetrics>;
    parameterGridPositions: Map<string, {
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
    }>;
  } {
    const gridPadding = getCSSVariableAsNumber('node-body-padding', 18);
    const bodyTopPadding = getCSSVariableAsNumber('param-body-top-padding', 24);
    const availableWidth = nodeWidth - gridPadding * 2;
    
    // Get layout or default to auto-grid
    const layout = spec.parameterLayout || { elements: [{ type: 'auto-grid' }] };
    
    // Build full metrics object for element renderers
    const fullMetrics: NodeRenderMetrics = {
      width: nodeWidth,
      height: 0, // Will be calculated
      headerHeight,
      portPositions: existingMetrics.portPositions || new Map(),
      parameterGridPositions: existingMetrics.parameterGridPositions || new Map(),
      parameterPositions: existingMetrics.parameterPositions || new Map(),
      parameterInputPortPositions: existingMetrics.parameterInputPortPositions || new Map()
    };
    
    const elementMetrics = new Map<LayoutElement, ElementMetrics>();
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
    
    let currentY = bodyTopPadding;
    
    // Calculate metrics for each element
    for (const element of layout.elements) {
      const renderer = this.getElementRenderer(element);
      if (!renderer) {
        console.warn(`No renderer found for layout element type: ${(element as any).type}`);
        continue;
      }
      
      const metrics = renderer.calculateMetrics(
        element,
        node,
        spec,
        availableWidth,
        currentY,
        fullMetrics
      );
      
      elementMetrics.set(element, metrics);
      
      // Extract parameter positions if this element provides them
      if (metrics.parameterGridPositions) {
        for (const [paramName, pos] of metrics.parameterGridPositions) {
          parameterGridPositions.set(paramName, pos);
        }
      }
      
      // Move to next element (stack vertically, no overlap)
      currentY += metrics.height;
    }
    
    const totalHeight = currentY + gridPadding; // Add bottom padding
    
    return {
      totalHeight,
      elementMetrics,
      parameterGridPositions
    };
  }
  
  /**
   * Render all layout elements
   */
  render(
    node: NodeInstance,
    spec: NodeSpec,
    _nodeX: number,
    _nodeY: number,
    _nodeWidth: number,
    _headerHeight: number,
    metrics: NodeRenderMetrics,
    elementMetrics: Map<LayoutElement, ElementMetrics>,
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
    const layout = spec.parameterLayout || { elements: [{ type: 'auto-grid' }] };
    
    // Render elements in order
    for (const element of layout.elements) {
      const metricsForElement = elementMetrics.get(element);
      if (!metricsForElement) {
        console.warn(`No metrics found for layout element type: ${(element as any).type}`);
        continue;
      }
      
      const renderer = this.getElementRenderer(element);
      if (!renderer) {
        continue;
      }
      
      renderer.render(
        element,
        node,
        spec,
        metricsForElement,
        metrics,
        renderState
      );
    }
  }
  
  /**
   * Get renderer for an element
   */
  private getElementRenderer(element: LayoutElement): LayoutElementRenderer | null {
    for (const renderer of this.elementRenderers) {
      if (renderer.canHandle(element)) {
        return renderer;
      }
    }
    return null;
  }
}

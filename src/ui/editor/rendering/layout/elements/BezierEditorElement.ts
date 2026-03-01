/**
 * Bezier Editor Element Renderer
 * 
 * Bezier curve editor for bezier curve nodes.
 * 
 * Uses flexbox container structure with absolute positioning for interactive elements.
 */

import type { NodeInstance } from '../../../../../data-model/types';
import type { NodeSpec, LayoutElement, BezierEditorElement as BezierEditorElementType } from '../../../../../types/nodeSpec';
import type { NodeRenderMetrics } from '../../../NodeRenderer';
import type { LayoutElementRenderer, ElementMetrics } from '../LayoutElementRenderer';
import { getCSSVariableAsNumber, getCategoryVariableAsNumber } from '../../../../../utils/cssTokens';
import { calculateFlexboxLayout } from '../flexbox/FlexboxCalculator';
import type { FlexItem, FlexboxProperties, FlexboxLayoutResult, LayoutResult } from '../flexbox/FlexboxTypes';

export class BezierEditorElementRenderer implements LayoutElementRenderer {
  constructor(_ctx: CanvasRenderingContext2D) {
    // ctx unused; nodes are DOM-rendered. Kept for API compatibility with ParameterLayoutManager.
  }

  canHandle(element: LayoutElement): boolean {
    return element.type === 'bezier-editor';
  }
  
  calculateMetrics(
    element: BezierEditorElementType,
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
    const bezierPortSpacing = getCSSVariableAsNumber('bezier-param-port-spacing', 40);
    const portSize = getCSSVariableAsNumber('param-port-size', 6);
    const modeButtonSize = getCSSVariableAsNumber('param-mode-button-size', 24);
    const portLabelSpacing = getCSSVariableAsNumber('port-label-spacing', 12);
    
    // Default parameters if not specified
    const params = element.parameters || ['x1', 'y1', 'x2', 'y2'];
    
    // Calculate left edge width for ports, mode buttons, type labels, and name labels
    const portToModeSpacing = portLabelSpacing;
    const modeToTypeSpacing = portLabelSpacing;
    const typeLabelWidth = 50; // Approximate
    const typeToNameSpacing = portLabelSpacing;
    const labelWidth = 60; // Approximate
    const leftEdgeWidth = portSize + portToModeSpacing + modeButtonSize + modeToTypeSpacing + typeLabelWidth + typeToNameSpacing + labelWidth;
    
    // Use flexbox for container structure (row: left-edge | bezier-editor)
    const containerX = node.position.x + gridPadding;
    const containerY = node.position.y + metrics.headerHeight + startY;
    
    const containerItems: FlexItem[] = [
      {
        id: 'left-edge',
        properties: {
          width: leftEdgeWidth,
          height: height
        },
        isContainer: true
      },
      {
        id: 'bezier-editor',
        properties: {
          width: availableWidth - leftEdgeWidth,
          height: height
        }
      }
    ];
    
    const containerProps: FlexboxProperties = {
      direction: 'row',
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
      gap: getCSSVariableAsNumber('bezier-editor-gap', 8)
    };
    
    const containerLayout = calculateFlexboxLayout(
      containerX,
      containerY,
      availableWidth,
      height,
      containerProps,
      containerItems
    );
    
    const leftEdgeResult = containerLayout.items.get('left-edge');
    const bezierEditorResult = containerLayout.items.get('bezier-editor');
    
    // Fallback if flexbox calculation fails
    if (!leftEdgeResult || !bezierEditorResult || 'items' in leftEdgeResult || 'items' in bezierEditorResult) {
      // Fallback to manual calculation
      const portX = containerX;
      const modeButtonX = portX + portSize + portToModeSpacing;
      const typeLabelX = modeButtonX + modeButtonSize + modeToTypeSpacing;
      const labelX = typeLabelX + typeLabelWidth + typeToNameSpacing;
      const bezierEditorX = labelX + labelWidth;
      const maxBezierEditorX = node.position.x + metrics.width - gridPadding;
      const actualBezierEditorX = Math.min(bezierEditorX, maxBezierEditorX - 200);
      const bezierEditorWidth = Math.max(200, maxBezierEditorX - actualBezierEditorX);
      
      const basePortY = containerY;
      const totalSpacing = (params.length - 1) * bezierPortSpacing;
      const startOffset = (height - totalSpacing) / 2;
      
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
      
      params.forEach((paramName, index) => {
        const portY = basePortY + startOffset + index * bezierPortSpacing;
        
        parameterGridPositions.set(paramName, {
          cellX: actualBezierEditorX,
          cellY: containerY,
          cellWidth: bezierEditorWidth,
          cellHeight: height,
          knobX: 0,
          knobY: 0,
          portX: portX,
          portY: portY,
          labelX: labelX,
          labelY: portY,
          valueX: 0,
          valueY: 0
        });
      });
      
      return {
        x: containerX,
        y: containerY,
        width: availableWidth,
        height: height,
        parameterGridPositions,
        bezierEditorX: actualBezierEditorX,
        bezierEditorWidth: bezierEditorWidth,
        portX: portX,
        modeButtonX: modeButtonX,
        typeLabelX: typeLabelX,
        labelX: labelX
      };
    }
    
    // Use flexbox results - extract LayoutResult from FlexboxLayoutResult if needed
    const getLayoutResult = (item: FlexboxLayoutResult | LayoutResult | undefined): LayoutResult | null => {
      if (!item) return null;
      if ('container' in item) {
        // It's a FlexboxLayoutResult, use the container
        return item.container;
      }
      // It's a LayoutResult
      return item;
    };
    
    const leftEdgeLayout = getLayoutResult(leftEdgeResult);
    const bezierEditorLayout = getLayoutResult(bezierEditorResult);
    
    if (!leftEdgeLayout || !bezierEditorLayout) {
      // Fallback to manual calculation if flexbox failed
      const portX = containerX;
      const modeButtonX = portX + portSize + portToModeSpacing;
      const typeLabelX = modeButtonX + modeButtonSize + modeToTypeSpacing;
      const labelX = typeLabelX + typeLabelWidth + typeToNameSpacing;
      const bezierEditorX = labelX + labelWidth;
      const maxBezierEditorX = node.position.x + metrics.width - gridPadding;
      const actualBezierEditorX = Math.min(bezierEditorX, maxBezierEditorX - 200);
      const bezierEditorWidth = Math.max(200, maxBezierEditorX - actualBezierEditorX);
      
      const basePortY = containerY;
      const totalSpacing = (params.length - 1) * bezierPortSpacing;
      const startOffset = (height - totalSpacing) / 2;
      
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
      
      params.forEach((paramName, index) => {
        const portY = basePortY + startOffset + index * bezierPortSpacing;
        
        parameterGridPositions.set(paramName, {
          cellX: actualBezierEditorX,
          cellY: containerY,
          cellWidth: bezierEditorWidth,
          cellHeight: height,
          knobX: 0,
          knobY: 0,
          portX: portX,
          portY: portY,
          labelX: labelX,
          labelY: portY,
          valueX: 0,
          valueY: 0
        });
      });
      
      return {
        x: containerX,
        y: containerY,
        width: availableWidth,
        height: height,
        parameterGridPositions,
        bezierEditorX: actualBezierEditorX,
        bezierEditorWidth: bezierEditorWidth,
        portX: portX,
        modeButtonX: modeButtonX,
        typeLabelX: typeLabelX,
        labelX: labelX
      };
    }
    
    // Calculate port positions within left edge (absolute positioning for ports)
    const portX = leftEdgeLayout.x;
    const modeButtonX = portX + portSize + portToModeSpacing;
    const typeLabelX = modeButtonX + modeButtonSize + modeToTypeSpacing;
    const labelX = typeLabelX + typeLabelWidth + typeToNameSpacing;
    
    const basePortY = leftEdgeLayout.y;
    const totalSpacing = (params.length - 1) * bezierPortSpacing;
    const startOffset = (height - totalSpacing) / 2;
    
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
    
    params.forEach((paramName, index) => {
      const portY = basePortY + startOffset + index * bezierPortSpacing;
      
      parameterGridPositions.set(paramName, {
        cellX: bezierEditorLayout.x,
        cellY: bezierEditorLayout.y,
        cellWidth: bezierEditorLayout.width,
        cellHeight: bezierEditorLayout.height,
        knobX: 0,
        knobY: 0,
        portX: portX,
        portY: portY,
        labelX: labelX,
        labelY: portY,
        valueX: 0,
        valueY: 0
      });
    });
    
    return {
      x: containerLayout.container.x,
      y: containerLayout.container.y,
      width: containerLayout.container.width,
      height: containerLayout.container.height,
      parameterGridPositions,
      // Additional bezier-specific metrics
      bezierEditorX: bezierEditorLayout.x,
      bezierEditorWidth: bezierEditorLayout.width,
      portX: portX,
      modeButtonX: modeButtonX,
      typeLabelX: typeLabelX,
      labelX: labelX
    };
  }
}

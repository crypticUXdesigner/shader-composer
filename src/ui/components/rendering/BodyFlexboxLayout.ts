/**
 * Body Flexbox Layout
 * 
 * Calculates body layout using flexbox model. Body is a flexbox column
 * containing slots (layout elements) stacked vertically.
 */

import type { LayoutElement, ParameterLayout } from '../../../types/nodeSpec';
import { FlexboxLayoutEngine } from './layout/flexbox/FlexboxLayoutEngine';
import type { FlexboxProperties, FlexItem, LayoutResult } from './layout/flexbox/FlexboxTypes';
import { getCSSVariableAsNumber } from '../../../utils/cssTokens';

export interface BodyLayout {
  container: LayoutResult;
  slots: LayoutResult[]; // One per layout element
}

export class BodyFlexboxLayout {
  private flexboxEngine: FlexboxLayoutEngine;
  private _slotHeights: Map<LayoutElement, number> = new Map();

  constructor() {
    this.flexboxEngine = new FlexboxLayoutEngine();
  }

  /**
   * Calculate body layout using flexbox
   * @param nodeX Node X position
   * @param bodyStartY Body start Y position (after header)
   * @param nodeWidth Node width
   * @param layout Parameter layout configuration
   * @param slotHeights Pre-calculated heights for each slot (from element renderers)
   */
  calculateLayout(
    nodeX: number,
    bodyStartY: number,
    nodeWidth: number,
    layout: ParameterLayout,
    slotHeights: Map<LayoutElement, number>
  ): BodyLayout {
    // Validate inputs
    if (!isFinite(nodeX) || !isFinite(bodyStartY) || !isFinite(nodeWidth) || nodeWidth <= 0) {
      console.warn(`Invalid inputs to BodyFlexboxLayout.calculateLayout: nodeX=${nodeX}, bodyStartY=${bodyStartY}, nodeWidth=${nodeWidth}`);
      // Return empty layout with fallback slots
      const fallbackSlots: LayoutResult[] = layout.elements.map(() => ({
        x: 0,
        y: 0,
        width: 200,
        height: 20
      }));
      return {
        container: { x: 0, y: 0, width: 200, height: 20 },
        slots: fallbackSlots
      };
    }
    
    // Store slotHeights for fallback use
    this._slotHeights = slotHeights;
    const bodyProps = this.getBodyFlexboxProperties();
    const bodyPadding = getCSSVariableAsNumber('node-body-padding', 18);
    
    // Body has padding on all sides
    // Available width for slots (node width - padding * 2)
    const availableWidth = Math.max(0, nodeWidth - bodyPadding * 2);
    // Body content starts after top padding
    const bodyContentStartY = bodyStartY + bodyPadding;
    
    // Create flex items for each slot
    const slotItems: FlexItem[] = layout.elements.map((element, index) => {
      const height = slotHeights.get(element);
      // Validate height - ensure it's a valid positive number
      const validHeight = (height !== undefined && height !== null && isFinite(height) && height > 0) 
        ? height 
        : 20; // Minimum height fallback
      return {
        id: `slot-${index}`,
        properties: {
          height: validHeight,
          width: availableWidth
        }
      };
    });
    
    // Calculate body layout (content-based height)
    // Content starts after top padding
    const bodyLayout = this.flexboxEngine.calculateLayout(
      nodeX + bodyPadding,
      bodyContentStartY,
      availableWidth,
      undefined, // content-based height
      bodyProps,
      slotItems
    );
    
    // Extract slot positions
    const slots: LayoutResult[] = [];
    let currentY = bodyContentStartY; // Track Y position for stacking slots (after top padding)
    
    for (let i = 0; i < layout.elements.length; i++) {
      const element = layout.elements[i];
      const slotLayoutItem = bodyLayout.items.get(`slot-${i}`);
      
      let slotLayout: LayoutResult | null = null;
      
      if (slotLayoutItem) {
        // Handle both LayoutResult and FlexboxLayoutResult
        if ('container' in slotLayoutItem && 'items' in slotLayoutItem) {
          // It's a FlexboxLayoutResult, use the container
          slotLayout = slotLayoutItem.container;
        } else if ('x' in slotLayoutItem && 'y' in slotLayoutItem) {
          // It's a LayoutResult
          slotLayout = slotLayoutItem as LayoutResult;
        }
      }
      
      // Validate slotLayout or create fallback
      if (!slotLayout || 
          slotLayout.x === undefined || slotLayout.x === null ||
          slotLayout.y === undefined || slotLayout.y === null ||
          slotLayout.width === undefined || slotLayout.width === null ||
          slotLayout.height === undefined || slotLayout.height === null ||
          !isFinite(slotLayout.x) || !isFinite(slotLayout.y) ||
          !isFinite(slotLayout.width) || !isFinite(slotLayout.height) ||
          slotLayout.width <= 0 || slotLayout.height <= 0) {
        // Create fallback slot with valid values
        const fallbackHeight = this._slotHeights.get(element);
        const validHeight = (fallbackHeight !== undefined && fallbackHeight !== null && isFinite(fallbackHeight) && fallbackHeight > 0)
          ? fallbackHeight
          : 20; // Minimum height fallback
        
        slotLayout = {
          x: nodeX + bodyPadding,
          y: currentY,
          width: availableWidth,
          height: validHeight
        };
      }
      
      // Ensure slot has valid values before pushing
      slots.push({
        x: isFinite(slotLayout.x) ? slotLayout.x : nodeX + bodyPadding,
        y: isFinite(slotLayout.y) ? slotLayout.y : currentY,
        width: (isFinite(slotLayout.width) && slotLayout.width > 0) ? slotLayout.width : availableWidth,
        height: (isFinite(slotLayout.height) && slotLayout.height > 0) ? slotLayout.height : 20
      });
      
      // Update currentY for next slot (stack vertically)
      currentY += slots[i].height;
    }
    
    // Body height = top padding + content + bottom padding.
    //
    // IMPORTANT: do NOT compute content height as sum(slot.height).
    // The body uses a flexbox `gap` between slots, so summing heights will miss the
    // inter-slot spacing and the node background/clip rect will be too short
    // (most visible on nodes with many layout elements like Audio Analyzer).
    //
    // Instead compute the extent from the actual placed slot positions, which
    // already include any gap from the flexbox engine.
    const lastSlot = slots.length > 0 ? slots[slots.length - 1] : null;
    const contentHeight =
      lastSlot ? (lastSlot.y + lastSlot.height) - bodyContentStartY : 0;
    const bodyBottomPadding = getCSSVariableAsNumber('node-body-padding-bottom', bodyPadding);
    const totalBodyHeight = bodyPadding + contentHeight + bodyBottomPadding;

    return {
      container: {
        x: nodeX,
        y: bodyStartY,
        width: nodeWidth,
        height: totalBodyHeight
      },
      slots
    };
  }
  
  /**
   * Get flexbox properties for body container from CSS tokens.
   * Slot gap is set to body padding so spacing between slots matches the body inset.
   */
  private getBodyFlexboxProperties(): FlexboxProperties {
    const bodyPadding = getCSSVariableAsNumber('node-body-padding', 18);
    const props = FlexboxLayoutEngine.getFlexboxPropertiesFromTokens('node-body', {
      direction: 'column',
      justifyContent: 'flex-start',
      alignItems: 'stretch',
      gap: 0
    });
    return { ...props, gap: bodyPadding };
  }
}

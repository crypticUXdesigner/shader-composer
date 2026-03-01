/**
 * Space Distribution Logic
 * 
 * Handles flex-grow and flex-shrink calculations for distributing available space
 * among flex items.
 */

import type { FlexItem, FlexDirection } from './FlexboxTypes';
import type { LayoutItem } from './FlexboxTypes';

/**
 * Calculate flex basis for an item
 */
export function calculateFlexBasis(
  item: FlexItem,
  containerDirection: FlexDirection
): number {
  const props = item.properties;
  const intrinsicSize = containerDirection === 'row' 
    ? (props.width ?? 0)
    : (props.height ?? 0);

  if (props.flexBasis === 'content') {
    return intrinsicSize;
  }
  if (props.flexBasis === 'auto') {
    return intrinsicSize;
  }
  if (typeof props.flexBasis === 'number') {
    return props.flexBasis;
  }
  return intrinsicSize;
}

/**
 * Apply min/max constraints to a size
 */
export function applyConstraints(
  size: number,
  item: FlexItem,
  containerDirection: FlexDirection
): number {
  const props = item.properties;
  const minSize = containerDirection === 'row' 
    ? (props.minWidth ?? 0)
    : (props.minHeight ?? 0);
  const maxSize = containerDirection === 'row'
    ? (props.maxWidth ?? Infinity)
    : (props.maxHeight ?? Infinity);
  
  return Math.max(minSize, Math.min(maxSize, size));
}

/**
 * Distribute available space among items
 * Handles both flex-grow (positive space) and flex-shrink (negative space)
 */
export function distributeSpace(
  items: LayoutItem[],
  availableSpace: number,
  direction: FlexDirection
): Map<string, number> {
  const result = new Map<string, number>();
  
  if (items.length === 0) {
    return result;
  }

  // If no available space, return basis sizes
  if (availableSpace === 0) {
    for (const layoutItem of items) {
      result.set(layoutItem.item.id, layoutItem.basis);
    }
    return result;
  }

  // Separate items into those that can grow and those that can shrink
  const growItems: LayoutItem[] = [];
  const shrinkItems: LayoutItem[] = [];
  
  for (const layoutItem of items) {
    const grow = layoutItem.item.properties.flexGrow ?? 0;
    const shrink = layoutItem.item.properties.flexShrink ?? 1;
    
    if (grow > 0) {
      growItems.push(layoutItem);
    }
    if (shrink > 0) {
      shrinkItems.push(layoutItem);
    }
  }

  if (availableSpace > 0) {
    // Positive space: distribute using flex-grow
    if (growItems.length === 0) {
      // No items can grow, space remains unused
      for (const layoutItem of items) {
        result.set(layoutItem.item.id, layoutItem.basis);
      }
      return result;
    }

    // Calculate total flex-grow
    const totalGrow = growItems.reduce((sum, item) => 
      sum + (item.item.properties.flexGrow ?? 0), 0);

    // Distribute space proportionally
    for (const layoutItem of items) {
      if (growItems.includes(layoutItem)) {
        const grow = layoutItem.item.properties.flexGrow ?? 0;
        const additionalSpace = (grow / totalGrow) * availableSpace;
        const newSize = layoutItem.basis + additionalSpace;
        result.set(layoutItem.item.id, newSize);
      } else {
        result.set(layoutItem.item.id, layoutItem.basis);
      }
    }
  } else {
    // Negative space: compress using flex-shrink
    if (shrinkItems.length === 0) {
      // No items can shrink, items overflow
      for (const layoutItem of items) {
        result.set(layoutItem.item.id, layoutItem.basis);
      }
      return result;
    }

    // Calculate total weighted shrink
    // Weight = flex-shrink * basis
    let totalWeightedShrink = 0;
    for (const layoutItem of shrinkItems) {
      const shrink = layoutItem.item.properties.flexShrink ?? 1;
      totalWeightedShrink += shrink * layoutItem.basis;
    }

    // Distribute compression proportionally
    const compression = Math.abs(availableSpace);
    for (const layoutItem of items) {
      if (shrinkItems.includes(layoutItem)) {
        const shrink = layoutItem.item.properties.flexShrink ?? 1;
        const weight = shrink * layoutItem.basis;
        const compressionAmount = (weight / totalWeightedShrink) * compression;
        const newSize = Math.max(0, layoutItem.basis - compressionAmount);
        result.set(layoutItem.item.id, newSize);
      } else {
        result.set(layoutItem.item.id, layoutItem.basis);
      }
    }
  }

  // Apply min/max constraints
  for (const [id, size] of result.entries()) {
    const item = items.find(li => li.item.id === id);
    if (item) {
      const constrainedSize = applyConstraints(size, item.item, direction);
      result.set(id, constrainedSize);
    }
  }

  return result;
}

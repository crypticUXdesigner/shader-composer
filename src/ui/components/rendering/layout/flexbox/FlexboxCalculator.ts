/**
 * Core Flexbox Calculation Logic
 * 
 * Implements the main flexbox layout algorithm, including:
 * - Single-pass layout for non-wrapping containers
 * - Multi-pass layout for wrapping containers
 * - Nested container support
 * - Content-based sizing
 */

import type { FlexboxProperties, FlexItem, FlexboxLayoutResult, LayoutResult } from './FlexboxTypes';
import type { LayoutItem, FlexLine } from './FlexboxTypes';
import { calculateFlexBasis, distributeSpace } from './SpaceDistributor';
import { applyJustifyContent, applyAlignItems, applyAlignContent } from './AlignmentCalculator';

/**
 * Calculate layout for a flex container
 */
export function calculateFlexboxLayout(
  containerX: number,
  containerY: number,
  containerWidth: number,
  containerHeight: number | undefined,
  containerProps: FlexboxProperties,
  items: FlexItem[]
): FlexboxLayoutResult {
  // Handle empty container
  if (items.length === 0) {
    const height = containerHeight ?? 0;
    return {
      container: {
        x: containerX,
        y: containerY,
        width: containerWidth,
        height
      },
      items: new Map()
    };
  }

  // Sort items by order
  const sortedItems = [...items].sort((a, b) => {
    const orderA = a.properties.order ?? 0;
    const orderB = b.properties.order ?? 0;
    return orderA - orderB;
  });

  // Get gap values
  const gap = containerProps.gap ?? 0;
  const gapRow = containerProps.gapRow ?? gap;
  const gapColumn = containerProps.gapColumn ?? gap;
  const mainGap = containerProps.direction === 'row' ? gapColumn : gapRow;
  const crossGap = containerProps.direction === 'row' ? gapRow : gapColumn;

  // Check if wrapping is enabled
  const shouldWrap = containerProps.flexWrap === 'wrap' || containerProps.flexWrap === 'wrap-reverse';

  if (shouldWrap) {
    return calculateWrappingLayout(
      containerX,
      containerY,
      containerWidth,
      containerHeight,
      containerProps,
      sortedItems,
      mainGap,
      crossGap
    );
  } else {
    return calculateNonWrappingLayout(
      containerX,
      containerY,
      containerWidth,
      containerHeight,
      containerProps,
      sortedItems,
      mainGap
    );
  }
}

/**
 * Calculate layout for non-wrapping container
 */
function calculateNonWrappingLayout(
  containerX: number,
  containerY: number,
  containerWidth: number,
  containerHeight: number | undefined,
  containerProps: FlexboxProperties,
  items: FlexItem[],
  gap: number
): FlexboxLayoutResult {
  const direction = containerProps.direction;
  const isRow = direction === 'row';

  // Step 1: Calculate flex basis for all items
  const layoutItems: LayoutItem[] = items.map(item => {
    const basis = calculateFlexBasis(item, direction);
    return {
      item,
      basis,
      size: basis,
      position: 0,
      crossPosition: 0,
      crossSize: 0,
      order: item.properties.order ?? 0
    };
  });

  // Step 2: Calculate intrinsic cross sizes (for align-items)
  const itemCrossSizes = new Map<string, number>();
  for (const layoutItem of layoutItems) {
    const crossSize = isRow
      ? (layoutItem.item.properties.height ?? 0)
      : (layoutItem.item.properties.width ?? 0);
    itemCrossSizes.set(layoutItem.item.id, crossSize);
    layoutItem.crossSize = crossSize;
  }

  // Step 3: Calculate available space on main axis
  const totalBasis = layoutItems.reduce((sum, item) => sum + item.basis, 0);
  const totalGapSpace = gap * (items.length - 1);
  // For content-based height (undefined), use intrinsic size so items keep their basis and container wraps content
  const containerMainSize = isRow
    ? containerWidth
    : (containerHeight ?? totalBasis + totalGapSpace);
  const availableSpace = containerMainSize - totalBasis - totalGapSpace;

  // Step 4: Distribute space (flex-grow/shrink)
  const finalSizes = distributeSpace(layoutItems, availableSpace, direction);
  for (const layoutItem of layoutItems) {
    layoutItem.size = finalSizes.get(layoutItem.item.id) ?? layoutItem.basis;
  }

  // Step 5: Calculate container cross size (if not provided)
  let containerCrossSize: number;
  if (isRow) {
    containerCrossSize = containerHeight ?? Math.max(...Array.from(itemCrossSizes.values()));
  } else {
    containerCrossSize = containerWidth;
  }

  // Step 6: Apply justify-content (main axis alignment)
  const totalItemsSize = layoutItems.reduce((sum, item) => sum + item.size, 0);
  applyJustifyContent(layoutItems, containerMainSize, totalItemsSize, containerProps.justifyContent, gap);

  // Step 7: Apply align-items (cross axis alignment)
  applyAlignItems(layoutItems, containerCrossSize, containerProps.alignItems, itemCrossSizes);

  // Step 8: Calculate final container height (if content-based)
  let finalContainerHeight: number;
  if (isRow) {
    finalContainerHeight = containerHeight ?? containerCrossSize;
  } else {
    const totalMainSize = totalItemsSize + totalGapSpace;
    finalContainerHeight = containerHeight ?? totalMainSize;
  }

  // Step 9: Convert to absolute positions and handle nested containers
  const resultItems = new Map<string, FlexboxLayoutResult | LayoutResult>();
  
  for (const layoutItem of layoutItems) {
    const itemX = isRow ? containerX + layoutItem.position : containerX + layoutItem.crossPosition;
    const itemY = isRow ? containerY + layoutItem.crossPosition : containerY + layoutItem.position;
    const itemWidth = isRow ? layoutItem.size : layoutItem.crossSize;
    const itemHeight = isRow ? layoutItem.crossSize : layoutItem.size;

    if (layoutItem.item.isContainer && layoutItem.item.children) {
      // Recursive call for nested container
      const nestedResult = calculateFlexboxLayout(
        itemX,
        itemY,
        itemWidth,
        itemHeight,
        containerProps, // Use same props for now (could be different)
        layoutItem.item.children
      );
      resultItems.set(layoutItem.item.id, nestedResult);
    } else {
      resultItems.set(layoutItem.item.id, {
        x: itemX,
        y: itemY,
        width: itemWidth,
        height: itemHeight
      });
    }
  }

  return {
    container: {
      x: containerX,
      y: containerY,
      width: containerWidth,
      height: finalContainerHeight
    },
    items: resultItems
  };
}

/**
 * Calculate layout for wrapping container
 */
function calculateWrappingLayout(
  containerX: number,
  containerY: number,
  containerWidth: number,
  containerHeight: number | undefined,
  containerProps: FlexboxProperties,
  items: FlexItem[],
  mainGap: number,
  crossGap: number
): FlexboxLayoutResult {
  const direction = containerProps.direction;
  const isRow = direction === 'row';
  const containerMainSize = isRow ? containerWidth : (containerHeight ?? 0);

  // Step 1: Calculate flex basis and group items into lines
  const lines: FlexLine[] = [];
  let currentLine: LayoutItem[] = [];
  let currentLineSize = 0;

  for (const item of items) {
    const basis = calculateFlexBasis(item, direction);
    const layoutItem: LayoutItem = {
      item,
      basis,
      size: basis,
      position: 0,
      crossPosition: 0,
      crossSize: 0,
      order: item.properties.order ?? 0
    };

    const itemSize = basis;
    const wouldExceed = currentLine.length > 0 && 
      (currentLineSize + mainGap + itemSize > containerMainSize);

    if (wouldExceed && currentLine.length > 0) {
      // Start new line
      lines.push({
        items: currentLine,
        mainSize: currentLineSize,
        crossSize: 0
      });
      currentLine = [layoutItem];
      currentLineSize = itemSize;
    } else {
      // Add to current line
      if (currentLine.length > 0) {
        currentLineSize += mainGap;
      }
      currentLine.push(layoutItem);
      currentLineSize += itemSize;
    }
  }

  // Add last line
  if (currentLine.length > 0) {
    lines.push({
      items: currentLine,
      mainSize: currentLineSize,
      crossSize: 0
    });
  }

  // Step 2: Distribute space within each line
  for (const line of lines) {
    const totalBasis = line.items.reduce((sum, item) => sum + item.basis, 0);
    const totalGapSpace = mainGap * (line.items.length - 1);
    const availableSpace = containerMainSize - totalBasis - totalGapSpace;

    const finalSizes = distributeSpace(line.items, availableSpace, direction);
    for (const layoutItem of line.items) {
      layoutItem.size = finalSizes.get(layoutItem.item.id) ?? layoutItem.basis;
    }

    line.mainSize = line.items.reduce((sum, item) => sum + item.size, 0) + totalGapSpace;
  }

  // Step 3: Calculate cross sizes for each line
  for (const line of lines) {
    const crossSizes = line.items.map(item => {
      return isRow
        ? (item.item.properties.height ?? 0)
        : (item.item.properties.width ?? 0);
    });
    line.crossSize = Math.max(...crossSizes);
    
    // Apply cross sizes to items
    for (let i = 0; i < line.items.length; i++) {
      line.items[i].crossSize = crossSizes[i];
    }
  }

  // Step 4: Apply justify-content to each line
  for (const line of lines) {
    const totalItemsSize = line.items.reduce((sum, item) => sum + item.size, 0);
    applyJustifyContent(line.items, containerMainSize, totalItemsSize, containerProps.justifyContent, mainGap);
  }

  // Step 5: Apply align-items to each line
  for (const line of lines) {
    const itemCrossSizes = new Map<string, number>();
    for (const layoutItem of line.items) {
      itemCrossSizes.set(layoutItem.item.id, layoutItem.crossSize);
    }
    applyAlignItems(line.items, line.crossSize, containerProps.alignItems, itemCrossSizes);
  }

  // Step 6: Reverse lines if wrap-reverse
  if (containerProps.flexWrap === 'wrap-reverse') {
    lines.reverse();
  }

  // Step 7: Apply align-content
  const totalLinesSize = lines.reduce((sum, line) => sum + line.crossSize, 0);
  const totalCrossGapSpace = crossGap * (lines.length - 1);
  const containerCrossSize = isRow 
    ? (containerHeight ?? totalLinesSize + totalCrossGapSpace)
    : containerWidth;

  if (containerProps.alignContent) {
    applyAlignContent(lines, containerCrossSize, totalLinesSize, containerProps.alignContent, crossGap);
  } else {
    // Default: flex-start
    let currentPos = 0;
    for (const line of lines) {
      line.items.forEach(item => {
        item.crossPosition = currentPos;
      });
      currentPos += line.crossSize + crossGap;
    }
  }

  // Step 8: Calculate final container size
  let finalContainerHeight: number;
  if (isRow) {
    finalContainerHeight = containerHeight ?? (totalLinesSize + totalCrossGapSpace);
  } else {
    const maxLineSize = Math.max(...lines.map(line => line.mainSize));
    finalContainerHeight = containerHeight ?? maxLineSize;
  }

  // Step 9: Convert to absolute positions
  const resultItems = new Map<string, FlexboxLayoutResult | LayoutResult>();
  
  for (const line of lines) {
    for (const layoutItem of line.items) {
      const itemX = isRow ? containerX + layoutItem.position : containerX + layoutItem.crossPosition;
      const itemY = isRow ? containerY + layoutItem.crossPosition : containerY + layoutItem.position;
      const itemWidth = isRow ? layoutItem.size : layoutItem.crossSize;
      const itemHeight = isRow ? layoutItem.crossSize : layoutItem.size;

      if (layoutItem.item.isContainer && layoutItem.item.children) {
        // Recursive call for nested container
        const nestedResult = calculateFlexboxLayout(
          itemX,
          itemY,
          itemWidth,
          itemHeight,
          containerProps,
          layoutItem.item.children
        );
        resultItems.set(layoutItem.item.id, nestedResult);
      } else {
        resultItems.set(layoutItem.item.id, {
          x: itemX,
          y: itemY,
          width: itemWidth,
          height: itemHeight
        });
      }
    }
  }

  return {
    container: {
      x: containerX,
      y: containerY,
      width: containerWidth,
      height: finalContainerHeight
    },
    items: resultItems
  };
}

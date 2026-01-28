/**
 * Alignment Calculation Logic
 * 
 * Handles justify-content and align-items calculations for positioning
 * items within a flex container.
 */

import type { FlexboxProperties, LayoutItem, FlexLine } from './FlexboxTypes';

/**
 * Apply justify-content to items in a line
 * Positions items along the main axis
 */
export function applyJustifyContent(
  items: LayoutItem[],
  containerSize: number,
  totalItemsSize: number,
  justifyContent: FlexboxProperties['justifyContent'],
  gap: number
): void {
  if (items.length === 0) {
    return;
  }

  const availableSpace = containerSize - totalItemsSize;
  const gapSpace = gap * (items.length - 1);
  const totalGapSpace = gapSpace;
  const spaceAfterGaps = availableSpace - totalGapSpace;

  let startPosition = 0;

  switch (justifyContent) {
    case 'flex-start':
      startPosition = 0;
      break;
    
    case 'flex-end':
      startPosition = availableSpace;
      break;
    
    case 'center':
      startPosition = availableSpace / 2;
      break;
    
    case 'space-between':
      if (items.length === 1) {
        startPosition = 0;
      } else {
        startPosition = 0;
        // Space between items, none at edges
        const spaceBetween = spaceAfterGaps / (items.length - 1);
        let currentPos = 0;
        for (let i = 0; i < items.length; i++) {
          items[i].position = currentPos;
          currentPos += items[i].size + gap + spaceBetween;
        }
        return; // Early return, positions already set
      }
      break;
    
    case 'space-around':
      if (items.length === 0) {
        return;
      }
      const spaceAround = spaceAfterGaps / items.length;
      let currentPos = spaceAround / 2;
      for (let i = 0; i < items.length; i++) {
        items[i].position = currentPos;
        currentPos += items[i].size + gap + spaceAround;
      }
      return; // Early return, positions already set
    
    case 'space-evenly':
      if (items.length === 0) {
        return;
      }
      const spaceEvenly = spaceAfterGaps / (items.length + 1);
      let currentPosEven = spaceEvenly;
      for (let i = 0; i < items.length; i++) {
        items[i].position = currentPosEven;
        currentPosEven += items[i].size + gap + spaceEvenly;
      }
      return; // Early return, positions already set
  }

  // For flex-start, flex-end, center: position items sequentially
  let currentPos = startPosition;
  for (let i = 0; i < items.length; i++) {
    items[i].position = currentPos;
    currentPos += items[i].size + gap;
  }
}

/**
 * Apply align-items to items in a line
 * Positions items along the cross axis
 */
export function applyAlignItems(
  items: LayoutItem[],
  containerCrossSize: number,
  alignItems: FlexboxProperties['alignItems'],
  itemCrossSizes: Map<string, number>
): void {
  for (const item of items) {
    const crossSize = itemCrossSizes.get(item.item.id) ?? item.crossSize;
    const alignSelf = item.item.properties.alignSelf ?? 'auto';
    const alignment = alignSelf === 'auto' ? alignItems : alignSelf;

    switch (alignment) {
      case 'flex-start':
        item.crossPosition = 0;
        break;
      
      case 'flex-end':
        item.crossPosition = containerCrossSize - crossSize;
        break;
      
      case 'center':
        item.crossPosition = (containerCrossSize - crossSize) / 2;
        break;
      
      case 'stretch':
        item.crossPosition = 0;
        item.crossSize = containerCrossSize;
        break;
      
      case 'baseline':
        // For baseline, treat as flex-start for now
        // Full baseline support would require font metrics
        item.crossPosition = 0;
        break;
    }
  }
}

/**
 * Apply align-content to lines (for wrapping)
 * Positions lines along the cross axis
 */
export function applyAlignContent(
  lines: FlexLine[],
  containerCrossSize: number,
  totalLinesSize: number,
  alignContent: FlexboxProperties['alignContent'],
  gap: number
): void {
  if (lines.length === 0) {
    return;
  }

  const availableSpace = containerCrossSize - totalLinesSize;
  const gapSpace = gap * (lines.length - 1);
  const spaceAfterGaps = availableSpace - gapSpace;

  let startPosition = 0;

  switch (alignContent) {
    case 'flex-start':
      startPosition = 0;
      break;
    
    case 'flex-end':
      startPosition = availableSpace;
      break;
    
    case 'center':
      startPosition = availableSpace / 2;
      break;
    
    case 'stretch':
      // Stretch all lines to fill container
      const stretchedLineSize = (containerCrossSize - gapSpace) / lines.length;
      let currentPos = 0;
      for (const line of lines) {
        line.crossSize = stretchedLineSize;
        line.items.forEach(item => {
          item.crossSize = stretchedLineSize;
          item.crossPosition = currentPos;
        });
        currentPos += stretchedLineSize + gap;
      }
      return; // Early return, positions already set
    
    case 'space-between':
      if (lines.length === 1) {
        startPosition = 0;
      } else {
        const spaceBetween = spaceAfterGaps / (lines.length - 1);
        let currentPos = 0;
        for (let i = 0; i < lines.length; i++) {
          lines[i].items.forEach(item => {
            item.crossPosition = currentPos;
          });
          currentPos += lines[i].crossSize + gap + spaceBetween;
        }
        return; // Early return, positions already set
      }
      break;
    
    case 'space-around':
      if (lines.length === 0) {
        return;
      }
      const spaceAround = spaceAfterGaps / lines.length;
      let currentPosAround = spaceAround / 2;
      for (const line of lines) {
        line.items.forEach(item => {
          item.crossPosition = currentPosAround;
        });
        currentPosAround += line.crossSize + gap + spaceAround;
      }
      return; // Early return, positions already set
  }

  // For flex-start, flex-end, center: position lines sequentially
  let currentPos = startPosition;
  for (const line of lines) {
    line.items.forEach(item => {
      item.crossPosition = currentPos;
    });
    currentPos += line.crossSize + gap;
  }
}

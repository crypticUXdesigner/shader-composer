/**
 * Flexbox Layout Engine
 * 
 * Core engine for calculating flexbox layouts. Converts flexbox CSS properties
 * into absolute positions suitable for canvas rendering.
 * 
 * This is the foundation for the entire layout system redesign.
 */

import type { FlexboxProperties, FlexItem, FlexboxLayoutResult } from './FlexboxTypes';
import { calculateFlexboxLayout } from './FlexboxCalculator';
import { getCSSVariableAsNumber, getCSSVariable } from '../../../../../utils/cssTokens';

/**
 * Main Flexbox Layout Engine class
 */
export class FlexboxLayoutEngine {
  /**
   * Calculate layout for a flex container
   * @param containerX Starting X position (absolute)
   * @param containerY Starting Y position (absolute)
   * @param containerWidth Available width
   * @param containerHeight Available height (or undefined for content-based)
   * @param containerProps Flexbox properties for container
   * @param items Array of flex items
   * @returns Layout result with positions for all items
   */
  calculateLayout(
    containerX: number,
    containerY: number,
    containerWidth: number,
    containerHeight: number | undefined,
    containerProps: FlexboxProperties,
    items: FlexItem[]
  ): FlexboxLayoutResult {
    return calculateFlexboxLayout(
      containerX,
      containerY,
      containerWidth,
      containerHeight,
      containerProps,
      items
    );
  }

  /**
   * Get flexbox properties from CSS tokens
   * @param tokenPrefix Prefix for CSS variable names (e.g., 'node-header' for --node-header-flex-direction)
   * @param defaults Default values if tokens are not found
   */
  static getFlexboxPropertiesFromTokens(
    tokenPrefix: string,
    defaults: Partial<FlexboxProperties> = {}
  ): FlexboxProperties {
    const getString = (name: string, fallback: string): string => {
      return getCSSVariable(`${tokenPrefix}-${name}`, fallback);
    };

    const getNumber = (name: string, fallback: number): number => {
      return getCSSVariableAsNumber(`${tokenPrefix}-${name}`, fallback);
    };

    return {
      direction: (getString('flex-direction', defaults.direction ?? 'column') as 'row' | 'column'),
      justifyContent: (getString('justify-content', defaults.justifyContent ?? 'flex-start') as FlexboxProperties['justifyContent']),
      alignItems: (getString('align-items', defaults.alignItems ?? 'stretch') as FlexboxProperties['alignItems']),
      alignContent: defaults.alignContent ? (getString('align-content', defaults.alignContent) as FlexboxProperties['alignContent']) : undefined,
      flexWrap: defaults.flexWrap ? (getString('flex-wrap', defaults.flexWrap) as FlexboxProperties['flexWrap']) : undefined,
      gap: getNumber('gap', defaults.gap ?? 0),
      gapRow: defaults.gapRow !== undefined ? getNumber('gap-row', defaults.gapRow) : undefined,
      gapColumn: defaults.gapColumn !== undefined ? getNumber('gap-column', defaults.gapColumn) : undefined
    };
  }

  /**
   * Get flex item properties from CSS tokens
   * @param tokenPrefix Prefix for CSS variable names (e.g., 'param-cell' for --param-cell-flex-grow)
   * @param defaults Default values if tokens are not found
   */
  static getFlexItemPropertiesFromTokens(
    tokenPrefix: string,
    defaults: Partial<FlexItem['properties']> = {}
  ): FlexItem['properties'] {
    const getNumber = (name: string, fallback: number | undefined): number | undefined => {
      const value = getCSSVariableAsNumber(`${tokenPrefix}-${name}`, fallback ?? 0);
      return value === 0 && fallback === undefined ? undefined : value;
    };

    const getString = (name: string, fallback: string | undefined): string | undefined => {
      const value = getCSSVariable(`${tokenPrefix}-${name}`, fallback ?? '');
      return value || fallback;
    };

    const flexBasisValue = getString('flex-basis', defaults.flexBasis as string | undefined);
    let flexBasis: FlexItem['properties']['flexBasis'] = undefined;
    if (flexBasisValue) {
      if (flexBasisValue === 'auto' || flexBasisValue === 'content') {
        flexBasis = flexBasisValue;
      } else {
        const numValue = parseFloat(flexBasisValue);
        if (!isNaN(numValue)) {
          flexBasis = numValue;
        }
      }
    }

    return {
      order: getNumber('order', defaults.order),
      flexGrow: getNumber('flex-grow', defaults.flexGrow),
      flexShrink: getNumber('flex-shrink', defaults.flexShrink),
      flexBasis: flexBasis ?? defaults.flexBasis,
      alignSelf: defaults.alignSelf ? (getString('align-self', defaults.alignSelf) as FlexItem['properties']['alignSelf']) : undefined,
      minWidth: getNumber('min-width', defaults.minWidth),
      minHeight: getNumber('min-height', defaults.minHeight),
      maxWidth: getNumber('max-width', defaults.maxWidth),
      maxHeight: getNumber('max-height', defaults.maxHeight),
      width: getNumber('width', defaults.width),
      height: getNumber('height', defaults.height)
    };
  }
}

// Re-export types for convenience
export type { FlexboxProperties, FlexItem, FlexboxLayoutResult, LayoutResult } from './FlexboxTypes';

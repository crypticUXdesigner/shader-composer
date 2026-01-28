/**
 * Type definitions for the Flexbox Layout Engine
 */

export type FlexDirection = 'row' | 'column';
export type JustifyContent = 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
export type AlignItems = 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
export type AlignContent = 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'space-between' | 'space-around';
export type FlexWrap = 'nowrap' | 'wrap' | 'wrap-reverse';
export type AlignSelf = 'auto' | 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
export type FlexBasis = number | 'auto' | 'content';

/**
 * Flexbox properties for a container
 */
export interface FlexboxProperties {
  direction: FlexDirection;
  justifyContent: JustifyContent;
  alignItems: AlignItems;
  alignContent?: AlignContent;
  flexWrap?: FlexWrap;
  gap?: number; // Single value for both axes
  gapRow?: number; // Row gap (for column direction) or column gap (for row direction)
  gapColumn?: number; // Column gap (for column direction) or row gap (for row direction)
}

/**
 * Flex properties for an individual item
 */
export interface FlexItemProperties {
  order?: number;
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: FlexBasis;
  alignSelf?: AlignSelf;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  width?: number; // Intrinsic width (for content-based sizing)
  height?: number; // Intrinsic height (for content-based sizing)
}

/**
 * A flex item (can be a container or a leaf element)
 */
export interface FlexItem {
  id: string;
  properties: FlexItemProperties;
  children?: FlexItem[]; // For nested containers
  isContainer?: boolean;
}

/**
 * Layout result for a single element
 */
export interface LayoutResult {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Complete flexbox layout result (recursive for nested containers)
 */
export interface FlexboxLayoutResult {
  container: LayoutResult;
  items: Map<string, FlexboxLayoutResult | LayoutResult>; // Recursive for nested
}

/**
 * Internal representation of an item during layout calculation
 */
export interface LayoutItem {
  item: FlexItem;
  basis: number; // Calculated flex basis
  size: number; // Final size after flex-grow/shrink
  position: number; // Position within container
  crossPosition: number; // Position on cross axis
  crossSize: number; // Size on cross axis
  order: number; // Applied order
}

/**
 * A line of items (for wrapping)
 */
export interface FlexLine {
  items: LayoutItem[];
  mainSize: number; // Total size on main axis
  crossSize: number; // Size on cross axis
}

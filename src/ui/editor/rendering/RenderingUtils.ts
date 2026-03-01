/**
 * Shared rendering utilities
 *
 * Common helper methods used by multiple renderers.
 */

import { getCSSColor, getCSSVariableAsNumber } from '../../../utils/cssTokens';
import { getCategoryStyleColor } from '../../../utils/categoryStyleMap';

/** Short display labels for port types in the node UI. */
const PORT_TYPE_DISPLAY_LABELS: Record<string, string> = {
  float: 'ft',
  vec2: 'v2',
  vec3: 'v3',
  vec4: 'v4',
};

/**
 * Return the short display label for a port type (e.g. float → ft, vec2 → v2).
 * Unknown types are returned as-is.
 */
export function getPortTypeDisplayLabel(type: string): string {
  return PORT_TYPE_DISPLAY_LABELS[type] ?? type;
}

/**
 * Options for the value-box primitive (rounded background + formatted number).
 * Used by InputParameterRenderer, KnobParameterRenderer, and RemapRangeElement row-2.
 *
 * Token set: `input-value-font-size`, `input-value-color`, `input-value-bg`,
 * `input-value-radius`, `input-value-padding-horizontal`, `input-value-padding-vertical`,
 * `input-value-animated-color` (all from tokens-node-editor.css).
 *
 * @param paramType - 'int' rounds; 'float' uses toFixed(3)
 * @param isAnimated - when true, text uses input-value-animated-color (reserved global)
 * @param align - 'center': (x,y) is box center; 'top': (x,y) is top-center of box
 * @param width - optional max width (e.g. for Remap row); box width = min(measured, width)
 * @param category - optional node category for per-category input-value-color/bg (ignored when isAnimated)
 */
export interface DrawValueBoxOptions {
  paramType?: 'int' | 'float';
  isAnimated?: boolean;
  align?: 'center' | 'top';
  width?: number;
  category?: string;
}

/**
 * Draw a value box (rounded background + mono numeric text).
 * Uses only `input-*` tokens. Callers: InputParameterRenderer, KnobParameterRenderer, RemapRangeElement row-2.
 */
export function drawValueBox(
  ctx: CanvasRenderingContext2D,
  value: number,
  x: number,
  y: number,
  options?: DrawValueBoxOptions
): void {
  const paramType = options?.paramType ?? 'float';
  const isAnimated = options?.isAnimated ?? false;
  const align = options?.align ?? 'center';
  const maxWidth = options?.width;
  const category = options?.category;

  const fontSize = getCSSVariableAsNumber('input-value-font-size', 18);
  const color = isAnimated
    ? (category != null
        ? getCategoryStyleColor(category, 'inputValueColorConnected', getCSSColor('input-value-color-connected', '#2f8a6b'))
        : getCSSColor('input-value-color-connected', '#2f8a6b'))
    : (category != null
        ? getCategoryStyleColor(category, 'inputValueColor', '#ebeff0')
        : getCSSColor('input-value-color', '#ebeff0'));
  const bg = isAnimated
    ? (category != null
        ? getCategoryStyleColor(category, 'inputValueBgConnected', getCSSColor('input-value-bg-connected', '#ffffff60'))
        : getCSSColor('input-value-bg-connected', '#ffffff60'))
    : (category != null
        ? getCategoryStyleColor(category, 'inputValueBg', '#000000d9')
        : getCSSColor('input-value-bg', '#000000d9'));
  const radius = getCSSVariableAsNumber('input-value-radius', 6);
  const paddingH = getCSSVariableAsNumber('input-value-padding-horizontal', 16);
  const paddingV = getCSSVariableAsNumber('input-value-padding-vertical', 6);

  const displayText =
    paramType === 'int' ? Math.round(value).toString() : value.toFixed(3);

  ctx.font = `${fontSize}px "JetBrains Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const textMetrics = ctx.measureText(displayText);
  let boxWidth = textMetrics.width + paddingH * 2;
  if (typeof maxWidth === 'number' && maxWidth > 0) {
    boxWidth = Math.min(boxWidth, maxWidth);
  }
  const boxHeight = fontSize + paddingV * 2;

  let boxX: number;
  let boxY: number;
  let textY: number;
  if (align === 'top') {
    boxX = x - boxWidth / 2;
    boxY = y;
    textY = y + boxHeight / 2; // (x,y) is top-center; draw text at box center
  } else {
    boxX = x - boxWidth / 2;
    boxY = y - boxHeight / 2;
    textY = y;
  }

  ctx.fillStyle = bg;
  drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, radius);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.fillText(displayText, x, textY);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/**
 * Draw a rounded rectangle on the canvas
 */
export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Draw a rounded rectangle to a Path2D
 */
export function drawRoundedRectToPath(
  path: Path2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  path.moveTo(x + radius, y);
  path.lineTo(x + width - radius, y);
  path.quadraticCurveTo(x + width, y, x + width, y + radius);
  path.lineTo(x + width, y + height - radius);
  path.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  path.lineTo(x + radius, y + height);
  path.quadraticCurveTo(x, y + height, x, y + height - radius);
  path.lineTo(x, y + radius);
  path.quadraticCurveTo(x, y, x + radius, y);
  path.closePath();
}

/**
 * Draw a vertical range slider (track + active region, optional hover/dragging styling).
 * Used by RangeParameterRenderer, RemapRangeElement, and NodeRenderer (legacy range-editor path).
 * Bottom = low value, top = high value.
 */
export function drawVerticalRangeSlider(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  minNorm: number,
  maxNorm: number,
  bgColor: string,
  trackColor: string,
  activeColor: string,
  radius: number,
  isHovered: boolean = false,
  isDragging: boolean = false
): void {
  const trackX = x;
  const trackWidth = width;
  const trackLeft = trackX - trackWidth / 2;
  
  // Draw full slider track background (inactive areas)
  ctx.fillStyle = bgColor;
  drawRoundedRect(ctx, trackLeft, y, trackWidth, height, radius);
  ctx.fill();
  
  // Draw track border for better definition
  ctx.strokeStyle = trackColor;
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, trackLeft, y, trackWidth, height, radius);
  ctx.stroke();
  
  // Draw active range (between min and max handles)
  const actualMinNorm = Math.min(minNorm, maxNorm);
  const actualMaxNorm = Math.max(minNorm, maxNorm);
  const activeTopY = y + (1 - actualMaxNorm) * height;
  const activeBottomY = y + (1 - actualMinNorm) * height;
  const activeHeight = Math.max(0, activeBottomY - activeTopY);
  if (activeHeight > 0) {
    ctx.fillStyle = activeColor;
    drawRoundedRect(ctx, trackLeft, activeTopY, trackWidth, activeHeight, radius);
    ctx.fill();
  }
  
  // Draw edge highlighting when hovering or dragging
  if (isHovered || isDragging) {
    const highlightWidth = 2;
    const highlightOpacity = 0.6;
    
    ctx.fillStyle = `rgba(255, 255, 255, ${highlightOpacity})`;
    ctx.fillRect(trackLeft, y, trackWidth, highlightWidth);
    ctx.fillRect(trackLeft, y + height - highlightWidth, trackWidth, highlightWidth);
  }
}

/**
 * Draw a horizontal range slider with two handles
 * Left = low value (0), right = high value (1)
 * Optional track edge strips: edgeThickness + edgeColor.
 * Optional active-range edge strips: activeEdgeThickness + activeEdgeColor.
 */
export function drawHorizontalRangeSlider(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  minNorm: number,
  maxNorm: number,
  bgColor: string,
  trackColor: string,
  activeColor: string,
  radius: number,
  isHovered: boolean = false,
  isDragging: boolean = false,
  edgeThickness: number = 0,
  edgeColor?: string,
  activeEdgeThickness: number = 0,
  activeEdgeColor?: string
): void {
  // Draw full slider track background (inactive areas)
  ctx.fillStyle = bgColor;
  drawRoundedRect(ctx, x, y, width, height, radius);
  ctx.fill();

  // Draw track border for better definition
  ctx.strokeStyle = trackColor;
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, x, y, width, height, radius);
  ctx.stroke();

  // Draw active range (between min and max handles)
  const actualMinNorm = Math.min(minNorm, maxNorm);
  const actualMaxNorm = Math.max(minNorm, maxNorm);
  const activeLeft = x + actualMinNorm * width;
  const activeWidth = Math.max(0, (actualMaxNorm - actualMinNorm) * width);
  if (activeWidth > 0) {
    ctx.fillStyle = activeColor;
    drawRoundedRect(ctx, activeLeft, y, activeWidth, height, radius);
    ctx.fill();

    // Draw configurable left/right edge strips on the active range
    if (activeEdgeThickness > 0 && activeEdgeColor) {
      const tw = Math.min(activeEdgeThickness, activeWidth / 2);
      ctx.fillStyle = activeEdgeColor;
      ctx.fillRect(activeLeft, y, tw, height);
      ctx.fillRect(activeLeft + activeWidth - tw, y, tw, height);
    }
  }

  // Draw configurable left/right edge strips (full track)
  if (edgeThickness > 0 && edgeColor) {
    ctx.fillStyle = edgeColor;
    ctx.fillRect(x, y, edgeThickness, height);
    ctx.fillRect(x + width - edgeThickness, y, edgeThickness, height);
  }

  // Draw edge highlighting when hovering or dragging
  if (isHovered || isDragging) {
    const highlightHeight = 2;
    const highlightOpacity = 0.6;

    ctx.fillStyle = `rgba(255, 255, 255, ${highlightOpacity})`;
    ctx.fillRect(x, y, highlightHeight, height);
    ctx.fillRect(x + width - highlightHeight, y, highlightHeight, height);
  }
}

/**
 * Draw an arrow from point (x1, y1) to point (x2, y2)
 */
export function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width: number
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  
  // Draw arrowhead
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const arrowSize = 6;
  const arrowX = x2 - Math.cos(angle) * arrowSize;
  const arrowY = y2 - Math.sin(angle) * arrowSize;
  
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(arrowX - Math.cos(angle - Math.PI / 6) * arrowSize, arrowY - Math.sin(angle - Math.PI / 6) * arrowSize);
  ctx.lineTo(arrowX - Math.cos(angle + Math.PI / 6) * arrowSize, arrowY - Math.sin(angle + Math.PI / 6) * arrowSize);
  ctx.closePath();
  ctx.fill();
}

// Parameter cell and port: extracted to RenderingUtilsParameterCell.ts; re-export for same public API
export {
  renderParameterCell,
  drawParameterPort,
  type ParameterPortState,
  type ParameterCellMetrics,
  type ParameterCellRenderState,
  type ParameterCellModeOptions,
  type RenderParameterCellOptions
} from './RenderingUtilsParameterCell';

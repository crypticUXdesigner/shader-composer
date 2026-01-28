/**
 * Viewport utilities for culling off-screen elements
 * 
 * Used to optimize rendering by only drawing elements visible in the viewport.
 */

export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
}

/**
 * Check if a rectangle is visible in the viewport
 * 
 * @param rectX - Rectangle X position (in canvas coordinates)
 * @param rectY - Rectangle Y position (in canvas coordinates)
 * @param rectW - Rectangle width (in canvas coordinates)
 * @param rectH - Rectangle height (in canvas coordinates)
 * @param viewport - Viewport information
 * @returns true if rectangle is visible (fully or partially)
 */
export function isRectVisible(
  rectX: number,
  rectY: number,
  rectW: number,
  rectH: number,
  viewport: Viewport
): boolean {
  // Calculate screen-space bounds of the rectangle
  const screenX = rectX * viewport.zoom + viewport.x;
  const screenY = rectY * viewport.zoom + viewport.y;
  const screenW = rectW * viewport.zoom;
  const screenH = rectH * viewport.zoom;
  
  // Calculate rectangle bounds
  const rectLeft = screenX;
  const rectRight = screenX + screenW;
  const rectTop = screenY;
  const rectBottom = screenY + screenH;
  
  // Viewport bounds (always 0, 0 to width, height in screen space)
  const viewportLeft = 0;
  const viewportRight = viewport.width;
  const viewportTop = 0;
  const viewportBottom = viewport.height;
  
  // Rectangle is visible if it overlaps with viewport
  // Overlap occurs when: rectLeft < viewportRight AND rectRight > viewportLeft
  // AND rectTop < viewportBottom AND rectBottom > viewportTop
  return (
    rectLeft < viewportRight &&
    rectRight > viewportLeft &&
    rectTop < viewportBottom &&
    rectBottom > viewportTop
  );
}

/**
 * Calculate viewport bounds in canvas coordinates
 * 
 * @param viewport - Viewport information
 * @returns Bounding box of viewport in canvas coordinates
 */
export function getViewportBounds(viewport: Viewport): {
  left: number;
  top: number;
  right: number;
  bottom: number;
} {
  const left = -viewport.x / viewport.zoom;
  const top = -viewport.y / viewport.zoom;
  const right = (viewport.width - viewport.x) / viewport.zoom;
  const bottom = (viewport.height - viewport.y) / viewport.zoom;
  
  return { left, top, right, bottom };
}

/**
 * Check if a rectangle is visible in viewport (with margin for smooth panning)
 * 
 * @param rectX - Rectangle X position (in canvas coordinates)
 * @param rectY - Rectangle Y position (in canvas coordinates)
 * @param rectW - Rectangle width (in canvas coordinates)
 * @param rectH - Rectangle height (in canvas coordinates)
 * @param viewport - Viewport information
 * @param margin - Margin in pixels (default: 100)
 * @returns true if rectangle is visible (fully or partially) within the expanded viewport
 */
export function isRectVisibleWithMargin(
  rectX: number,
  rectY: number,
  rectW: number,
  rectH: number,
  viewport: Viewport,
  margin: number = 100
): boolean {
  // Calculate screen-space bounds of the rectangle
  const screenX = rectX * viewport.zoom + viewport.x;
  const screenY = rectY * viewport.zoom + viewport.y;
  const screenW = rectW * viewport.zoom;
  const screenH = rectH * viewport.zoom;
  
  // Calculate rectangle bounds
  const rectLeft = screenX;
  const rectRight = screenX + screenW;
  const rectTop = screenY;
  const rectBottom = screenY + screenH;
  
  // Viewport bounds expanded by margin (in screen space)
  // Expand viewport by margin pixels in all directions
  const viewportLeft = -margin;
  const viewportRight = viewport.width + margin;
  const viewportTop = -margin;
  const viewportBottom = viewport.height + margin;
  
  // Rectangle is visible if it overlaps with expanded viewport
  // Overlap occurs when: rectLeft < viewportRight AND rectRight > viewportLeft
  // AND rectTop < viewportBottom AND rectBottom > viewportTop
  return (
    rectLeft < viewportRight &&
    rectRight > viewportLeft &&
    rectTop < viewportBottom &&
    rectBottom > viewportTop
  );
}

/**
 * Get viewport from pan/zoom and canvas dimensions
 * 
 * @param panX - Pan X offset (in screen coordinates)
 * @param panY - Pan Y offset (in screen coordinates)
 * @param zoom - Zoom level
 * @param canvasWidth - Canvas width (in screen pixels)
 * @param canvasHeight - Canvas height (in screen pixels)
 * @returns Viewport object
 */
export function getCanvasViewport(
  panX: number,
  panY: number,
  zoom: number,
  canvasWidth: number,
  canvasHeight: number
): Viewport {
  return {
    x: panX,
    y: panY,
    width: canvasWidth,
    height: canvasHeight,
    zoom: zoom
  };
}

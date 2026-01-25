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
  
  // Check if rectangle overlaps with viewport (0, 0, width, height)
  // Rectangle is visible if it's not completely outside the viewport
  return !(
    screenX + screenW < 0 ||
    screenX > viewport.width ||
    screenY + screenH < 0 ||
    screenY > viewport.height
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

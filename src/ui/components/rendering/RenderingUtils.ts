/**
 * Shared rendering utilities
 * 
 * Common helper methods used by multiple renderers.
 */

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
 * Draw a vertical range slider with two handles
 * Bottom = low value, top = high value
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

/**
 * EdgeScrollManager
 * 
 * Manages edge scrolling when dragging nodes or connections near canvas edges.
 */
export interface EdgeScrollContext {
  getCanvasRect: () => DOMRect;
  getMousePosition: () => { x: number; y: number };
  onPanChanged: (deltaX: number, deltaY: number) => void;
}

export class EdgeScrollManager {
  private animationFrame: number | null = null;
  private velocityX: number = 0;
  private velocityY: number = 0;
  private readonly EDGE_SCROLL_ZONE = 0.1; // 10% of width/height
  private readonly MAX_EDGE_SCROLL_SPEED = 800; // pixels per second
  private context?: EdgeScrollContext;

  /**
   * Set the context for edge scrolling
   */
  setContext(context: EdgeScrollContext): void {
    this.context = context;
  }

  /**
   * Update edge scroll velocity based on mouse position
   */
  updateVelocity(mouseX: number, mouseY: number): void {
    if (!this.context) return;

    const rect = this.context.getCanvasRect();
    const canvasWidth = rect.width;
    const canvasHeight = rect.height;
    const scrollZoneWidth = canvasWidth * this.EDGE_SCROLL_ZONE;
    const scrollZoneHeight = canvasHeight * this.EDGE_SCROLL_ZONE;

    // Calculate distance from edges
    const distFromLeft = mouseX - rect.left;
    const distFromRight = rect.right - mouseX;
    const distFromTop = mouseY - rect.top;
    const distFromBottom = rect.bottom - mouseY;

    // Calculate velocity for X axis
    let velocityX = 0;
    if (distFromLeft < scrollZoneWidth) {
      const proximity = 1 - (distFromLeft / scrollZoneWidth);
      velocityX = this.MAX_EDGE_SCROLL_SPEED * proximity * proximity; // Quadratic for smoother acceleration
    } else if (distFromRight < scrollZoneWidth) {
      const proximity = 1 - (distFromRight / scrollZoneWidth);
      velocityX = -this.MAX_EDGE_SCROLL_SPEED * proximity * proximity;
    }

    // Calculate velocity for Y axis
    let velocityY = 0;
    if (distFromTop < scrollZoneHeight) {
      const proximity = 1 - (distFromTop / scrollZoneHeight);
      velocityY = this.MAX_EDGE_SCROLL_SPEED * proximity * proximity;
    } else if (distFromBottom < scrollZoneHeight) {
      const proximity = 1 - (distFromBottom / scrollZoneHeight);
      velocityY = -this.MAX_EDGE_SCROLL_SPEED * proximity * proximity;
    }

    this.velocityX = velocityX;
    this.velocityY = velocityY;
  }

  /**
   * Start edge scrolling animation loop
   */
  start(): void {
    if (this.animationFrame !== null || !this.context) {
      return; // Already running or no context
    }

    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
      lastTime = currentTime;

      // Update velocity based on current mouse position
      const mousePos = this.context!.getMousePosition();
      this.updateVelocity(mousePos.x, mousePos.y);

      // Only scroll if there's velocity
      if (this.velocityX !== 0 || this.velocityY !== 0) {
        // Update pan based on velocity and delta time
        this.context!.onPanChanged(
          this.velocityX * deltaTime,
          this.velocityY * deltaTime
        );
      }

      // Continue animation if still active
      if (this.animationFrame !== null) {
        this.animationFrame = requestAnimationFrame(animate);
      }
    };

    this.animationFrame = requestAnimationFrame(animate);
  }

  /**
   * Stop edge scrolling
   */
  stop(): void {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    this.velocityX = 0;
    this.velocityY = 0;
  }

  /**
   * Check if edge scrolling is active
   */
  isActive(): boolean {
    return this.animationFrame !== null;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stop();
    this.context = undefined;
  }
}

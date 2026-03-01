/**
 * FrameBuffer - Manages frame buffer for incremental rendering
 * 
 * Phase 3.1: Implements frame buffer system to enable incremental rendering.
 * Saves and restores canvas state to avoid full redraws on every change.
 */

export class FrameBuffer {
  private buffer: ImageData | null = null;
  private width: number;
  private height: number;
  
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
  
  /**
   * Save current canvas state to buffer
   */
  save(ctx: CanvasRenderingContext2D): void {
    try {
      this.buffer = ctx.getImageData(0, 0, this.width, this.height);
    } catch (e) {
      // If getImageData fails (e.g., canvas is tainted), clear buffer
      this.buffer = null;
    }
  }
  
  /**
   * Restore saved canvas state from buffer
   */
  restore(ctx: CanvasRenderingContext2D): void {
    if (this.buffer) {
      try {
        ctx.putImageData(this.buffer, 0, 0);
      } catch (e) {
        // If putImageData fails, clear buffer
        this.buffer = null;
      }
    }
  }
  
  /**
   * Clear the buffer
   */
  clear(): void {
    this.buffer = null;
  }
  
  /**
   * Check if buffer has saved data
   */
  hasBuffer(): boolean {
    return this.buffer !== null;
  }
  
  /**
   * Resize the buffer (clears existing buffer)
   */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.clear();
  }
}

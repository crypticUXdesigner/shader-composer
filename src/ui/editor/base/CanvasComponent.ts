/**
 * Canvas Component Base Class
 * 
 * Provides a foundation for all canvas-based UI components.
 * Implements lifecycle hooks, state management, and hit testing.
 * 
 * Phase 2.1: Architecture Improvements
 */

export interface ComponentMetrics {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ComponentState {
  [key: string]: unknown;
}

/**
 * Abstract base class for all canvas components
 * 
 * Provides:
 * - Lifecycle hooks (mount, unmount, update)
 * - State management
 * - Metrics calculation
 * - Hit testing
 * - Utility methods
 */
export abstract class CanvasComponent {
  protected metrics: ComponentMetrics;
  protected state: ComponentState;
  protected ctx: CanvasRenderingContext2D;
  private mounted: boolean = false;
  
  constructor(ctx: CanvasRenderingContext2D, initialState: ComponentState = {}) {
    this.ctx = ctx;
    this.state = initialState;
    this.metrics = { x: 0, y: 0, width: 0, height: 0 };
  }
  
  /**
   * Render the component
   * Must be implemented by subclasses
   */
  abstract render(): void;
  
  /**
   * Calculate component metrics (position, size)
   * Must be implemented by subclasses
   */
  abstract calculateMetrics(): ComponentMetrics;
  
  /**
   * Test if a point hits this component
   * Must be implemented by subclasses
   * 
   * @param x - X coordinate in canvas space
   * @param y - Y coordinate in canvas space
   * @returns true if point is inside component bounds
   */
  abstract hitTest(x: number, y: number): boolean;
  
  /**
   * Lifecycle: Called when component is mounted
   * Override in subclasses to perform initialization
   */
  onMount?(): void;
  
  /**
   * Lifecycle: Called when component is unmounted
   * Override in subclasses to perform cleanup
   */
  onUnmount?(): void;
  
  /**
   * Lifecycle: Called when state updates
   * Override in subclasses to react to state changes
   * 
   * @param prevState - Previous state before update
   */
  onUpdate?(prevState: ComponentState): void;
  
  /**
   * Update component state
   * Triggers metrics recalculation and onUpdate hook
   * 
   * @param newState - Partial state to merge with current state
   */
  setState(newState: Partial<ComponentState>): void {
    const prevState = { ...this.state };
    this.state = { ...this.state, ...newState };
    
    // Recalculate metrics if state changed
    this.metrics = this.calculateMetrics();
    
    // Call update hook
    this.onUpdate?.(prevState);
  }
  
  /**
   * Mount the component
   * Initializes metrics and calls onMount hook
   */
  mount(): void {
    if (!this.mounted) {
      this.mounted = true;
      this.metrics = this.calculateMetrics();
      this.onMount?.();
    }
  }
  
  /**
   * Unmount the component
   * Calls onUnmount hook and marks as unmounted
   */
  unmount(): void {
    if (this.mounted) {
      this.mounted = false;
      this.onUnmount?.();
    }
  }
  
  /**
   * Get component bounds (position and size)
   * 
   * @returns Copy of current metrics
   */
  getBounds(): ComponentMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Check if a point is inside component bounds
   * Utility method for hit testing
   * 
   * @param x - X coordinate
   * @param y - Y coordinate
   * @returns true if point is inside bounds
   */
  protected isPointInside(x: number, y: number): boolean {
    const bounds = this.getBounds();
    return x >= bounds.x &&
           x <= bounds.x + bounds.width &&
           y >= bounds.y &&
           y <= bounds.y + bounds.height;
  }
  
  /**
   * Get current state
   * 
   * @returns Copy of current state
   */
  getState(): ComponentState {
    return { ...this.state };
  }
  
  /**
   * Check if component is mounted
   * 
   * @returns true if component is mounted
   */
  isMounted(): boolean {
    return this.mounted;
  }
}

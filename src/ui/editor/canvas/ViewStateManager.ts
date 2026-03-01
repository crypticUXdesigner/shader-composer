/**
 * ViewStateManager
 * 
 * Manages canvas view state (pan, zoom) and provides coordinate transformation utilities.
 * Tracks previous values to detect viewport changes that require full redraws.
 */
export interface ViewState {
  zoom: number;
  panX: number;
  panY: number;
}

export interface ViewStateChangeListener {
  onViewStateChanged?: (state: ViewState) => void;
}

export class ViewStateManager {
  private state: ViewState;
  private previousState: ViewState;
  private listener?: ViewStateChangeListener;

  constructor(initialState?: Partial<ViewState>) {
    this.state = {
      zoom: initialState?.zoom ?? 1.0,
      panX: initialState?.panX ?? 0,
      panY: initialState?.panY ?? 0,
    };
    this.previousState = { ...this.state };
  }

  /**
   * Get current view state
   */
  getState(): ViewState {
    return { ...this.state };
  }

  /**
   * Get previous view state (for detecting changes)
   */
  getPreviousState(): ViewState {
    return { ...this.previousState };
  }

  /**
   * Check if viewport has changed (pan or zoom)
   */
  hasViewportChanged(): boolean {
    return (
      this.state.panX !== this.previousState.panX ||
      this.state.panY !== this.previousState.panY ||
      this.state.zoom !== this.previousState.zoom
    );
  }

  /**
   * Update pan values
   */
  setPan(panX: number, panY: number): void {
    this.previousState = { ...this.state };
    this.state.panX = panX;
    this.state.panY = panY;
    this.notifyChange();
  }

  /**
   * Update pan by delta
   */
  addPan(deltaX: number, deltaY: number): void {
    this.previousState = { ...this.state };
    this.state.panX += deltaX;
    this.state.panY += deltaY;
    this.notifyChange();
  }

  /**
   * Set zoom level
   */
  setZoom(zoom: number): void {
    const clampedZoom = Math.max(0.10, Math.min(1.0, zoom));
    this.previousState = { ...this.state };
    this.state.zoom = clampedZoom;
    this.notifyChange();
  }

  /**
   * Set zoom with pan adjustment to keep a point fixed
   */
  setZoomAtPoint(zoom: number, screenX: number, screenY: number, screenToCanvas: (x: number, y: number) => { x: number; y: number }): void {
    const clampedZoom = Math.max(0.10, Math.min(1.0, zoom));
    
    // Get canvas position before zoom
    const canvasPos = screenToCanvas(screenX, screenY);
    
    // Calculate new pan to keep the point fixed
    const newPanX = screenX - canvasPos.x * clampedZoom;
    const newPanY = screenY - canvasPos.y * clampedZoom;
    
    this.previousState = { ...this.state };
    this.state.zoom = clampedZoom;
    this.state.panX = newPanX;
    this.state.panY = newPanY;
    this.notifyChange();
  }

  /**
   * Set both zoom and pan
   */
  setViewState(state: Partial<ViewState>): void {
    this.previousState = { ...this.state };
    if (state.zoom !== undefined) {
      this.state.zoom = Math.max(0.10, Math.min(1.0, state.zoom));
    }
    if (state.panX !== undefined) {
      this.state.panX = state.panX;
    }
    if (state.panY !== undefined) {
      this.state.panY = state.panY;
    }
    this.notifyChange();
  }

  /**
   * Convert screen coordinates to canvas coordinates
   */
  screenToCanvas(screenX: number, screenY: number, canvasRect: DOMRect): { x: number; y: number } {
    const x = (screenX - canvasRect.left - this.state.panX) / this.state.zoom;
    const y = (screenY - canvasRect.top - this.state.panY) / this.state.zoom;
    return { x, y };
  }

  /**
   * Convert canvas coordinates to screen coordinates
   */
  canvasToScreen(canvasX: number, canvasY: number, canvasRect: DOMRect): { x: number; y: number } {
    const x = canvasX * this.state.zoom + this.state.panX + canvasRect.left;
    const y = canvasY * this.state.zoom + this.state.panY + canvasRect.top;
    return { x, y };
  }

  /**
   * Update previous state to current state (call after rendering)
   */
  markRendered(): void {
    this.previousState = { ...this.state };
  }

  /**
   * Set change listener
   */
  setListener(listener: ViewStateChangeListener): void {
    this.listener = listener;
  }

  private notifyChange(): void {
    this.listener?.onViewStateChanged?.(this.state);
  }
}

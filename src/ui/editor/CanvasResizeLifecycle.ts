/**
 * CanvasResizeLifecycle - Handles canvas resize observer, debounce, and viewport centering.
 * Extracted from NodeEditorCanvas to reduce its size and separate lifecycle/resize concerns.
 */

export interface CanvasResizeLifecycleDeps {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  viewStateManager: {
    getState: () => { panX: number; panY: number; zoom: number };
    setPan: (panX: number, panY: number) => void;
  };
  getViewStateInternal: () => { panX: number; panY: number; zoom: number };
  renderState: { markFullRedraw: () => void };
  fillBackground: () => void;
  requestRender: () => void;
  /** Called after resize has been processed; e.g. used to invalidate overlay dimension cache. */
  onResizeProcessed?: () => void;
}

const RESIZE_DEBOUNCE_MS = 320;
const MIN_ZOOM = 0.10;

export class CanvasResizeLifecycle {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private deps: CanvasResizeLifecycleDeps;
  private pendingResize = false;
  private cachedViewportWidth = 0;
  private cachedViewportHeight = 0;
  private resizeTimeout: number | null = null;
  private resizeFrameScheduled = false;
  private resizeDebounceTimeout: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(deps: CanvasResizeLifecycleDeps) {
    this.canvas = deps.canvas;
    this.ctx = deps.ctx;
    this.deps = deps;
  }

  getCachedViewportDimensions(): { width: number; height: number } {
    return { width: this.cachedViewportWidth, height: this.cachedViewportHeight };
  }

  startObserving(): void {
    this.resizeObserver = new ResizeObserver(() => {
      if (this.resizeDebounceTimeout !== null) window.clearTimeout(this.resizeDebounceTimeout);
      this.resizeDebounceTimeout = window.setTimeout(() => {
        this.resizeDebounceTimeout = null;
        this.handleResize();
      }, RESIZE_DEBOUNCE_MS);
    });
    this.resizeObserver.observe(this.canvas);
    const initialRect = this.canvas.getBoundingClientRect();
    this.cachedViewportWidth = initialRect.width;
    this.cachedViewportHeight = initialRect.height;
  }

  handleResize(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const newWidth = rect.width * dpr;
    const newHeight = rect.height * dpr;

    if (this.canvas.width !== newWidth || this.canvas.height !== newHeight) {
      this.canvas.width = newWidth;
      this.canvas.height = newHeight;
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(dpr, dpr);
      this.ctx.clearRect(0, 0, rect.width, rect.height);
      this.deps.fillBackground();
    }

    this.pendingResize = true;
    if (this.resizeFrameScheduled) return;
    this.resizeFrameScheduled = true;
    this.resizeTimeout = requestAnimationFrame(() => {
      if (this.pendingResize) {
        this.resize();
        this.deps.requestRender();
      }
      this.resizeFrameScheduled = false;
      this.resizeTimeout = null;
    });
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const oldWidth = this.canvas.width;
    const oldHeight = this.canvas.height;

    if (this.cachedViewportWidth === 0 && this.cachedViewportHeight === 0) {
      this.cachedViewportWidth = rect.width;
      this.cachedViewportHeight = rect.height;
    }

    const oldViewportWidth = this.cachedViewportWidth;
    const oldViewportHeight = this.cachedViewportHeight;
    const newWidth = rect.width * dpr;
    const newHeight = rect.height * dpr;
    const newViewportWidth = rect.width;
    const newViewportHeight = rect.height;

    this.cachedViewportWidth = newViewportWidth;
    this.cachedViewportHeight = newViewportHeight;

    const viewState = this.deps.getViewStateInternal();
    const isAtMinZoom = Math.abs(viewState.zoom - MIN_ZOOM) < 0.001;

    if (
      oldViewportWidth > 0 &&
      oldViewportHeight > 0 &&
      (oldViewportWidth !== newViewportWidth || oldViewportHeight !== newViewportHeight) &&
      !isAtMinZoom
    ) {
      const oldCenterX = oldViewportWidth / 2;
      const oldCenterY = oldViewportHeight / 2;
      const canvasCenterX = (oldCenterX - viewState.panX) / viewState.zoom;
      const canvasCenterY = (oldCenterY - viewState.panY) / viewState.zoom;
      const newCenterX = newViewportWidth / 2;
      const newCenterY = newViewportHeight / 2;
      this.deps.viewStateManager.setPan(
        newCenterX - canvasCenterX * viewState.zoom,
        newCenterY - canvasCenterY * viewState.zoom
      );
    }

    if (oldWidth !== newWidth || oldHeight !== newHeight) {
      this.deps.renderState.markFullRedraw();
    }
    this.deps.onResizeProcessed?.();
    this.pendingResize = false;
  }

  dispose(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.resizeTimeout !== null) {
      cancelAnimationFrame(this.resizeTimeout);
      this.resizeTimeout = null;
    }
    if (this.resizeDebounceTimeout !== null) {
      window.clearTimeout(this.resizeDebounceTimeout);
      this.resizeDebounceTimeout = null;
    }
  }
}

/**
 * CanvasOverlayRenderer - Renders to parameter-connections and top overlay canvases.
 * Extracted from NodeEditorCanvas to reduce its size and separate overlay rendering.
 *
 * Overlay dimensions are cached (canvas pixels: CSS size × devicePixelRatio) to avoid
 * per-frame getBoundingClientRect during pan/zoom. Cache is refreshed when overlay
 * elements are resized (via invalidateOverlayDimensions, e.g. from main canvas resize
 * lifecycle) or when overlay canvas refs change in updateDependencies.
 */

export interface CanvasOverlayRendererDeps {
  parameterConnectionsOverlayCanvas: HTMLCanvasElement | null;
  topOverlayCanvas: HTMLCanvasElement | null;
  getViewStateInternal: () => { panX: number; panY: number; zoom: number };
  /** Only parameter connections are drawn here so they appear above DOM nodes. Regular (I/O) connections stay on main canvas below nodes. */
  renderParameterConnectionLayer: (ctx: CanvasRenderingContext2D) => void;
  getIsConnecting: () => boolean;
  renderTemporaryConnection: (ctx: CanvasRenderingContext2D) => void;
  renderSmartGuides: (ctx?: CanvasRenderingContext2D) => void;
  renderSelectionRectangle: (ctx?: CanvasRenderingContext2D) => void;
  getCurrentSmartGuides: () => { vertical: unknown[]; horizontal: unknown[] };
  getIsDraggingNode: () => boolean;
  getSelectionRectangle: () => { x: number; y: number; width: number; height: number } | null;
}

/** Cached dimensions in canvas pixels (CSS size × dpr). w/h 0 means cache is cold/invalid. */
interface CachedDimensions {
  w: number;
  h: number;
}

export class CanvasOverlayRenderer {
  private deps: CanvasOverlayRendererDeps;
  /** Cache for parameter-connections overlay; refreshed on resize or when overlay ref changes. */
  private cachedParamConnections: CachedDimensions = { w: 0, h: 0 };
  /** Cache for top overlay; refreshed on resize or when overlay ref changes. */
  private cachedTop: CachedDimensions = { w: 0, h: 0 };

  constructor(deps: CanvasOverlayRendererDeps) {
    this.deps = deps;
  }

  updateDependencies(deps: Partial<CanvasOverlayRendererDeps>): void {
    if (deps.parameterConnectionsOverlayCanvas !== undefined && deps.parameterConnectionsOverlayCanvas !== this.deps.parameterConnectionsOverlayCanvas) {
      this.cachedParamConnections = { w: 0, h: 0 };
    }
    if (deps.topOverlayCanvas !== undefined && deps.topOverlayCanvas !== this.deps.topOverlayCanvas) {
      this.cachedTop = { w: 0, h: 0 };
    }
    this.deps = { ...this.deps, ...deps };
  }

  /**
   * Invalidates cached overlay dimensions so the next render will measure via getBoundingClientRect.
   * Call when overlay elements are resized (e.g. from main canvas resize lifecycle).
   */
  invalidateOverlayDimensions(): void {
    this.cachedParamConnections = { w: 0, h: 0 };
    this.cachedTop = { w: 0, h: 0 };
  }

  renderParameterConnectionsToOverlay(): void {
    const overlay = this.deps.parameterConnectionsOverlayCanvas;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    let w: number;
    let h: number;
    if (this.cachedParamConnections.w > 0 && this.cachedParamConnections.h > 0) {
      w = this.cachedParamConnections.w;
      h = this.cachedParamConnections.h;
    } else {
      const rect = overlay.getBoundingClientRect();
      w = rect.width * dpr;
      h = rect.height * dpr;
      this.cachedParamConnections = { w, h };
    }
    if (overlay.width !== w || overlay.height !== h) {
      overlay.width = w;
      overlay.height = h;
    }
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    const viewState = this.deps.getViewStateInternal();
    ctx.translate(viewState.panX, viewState.panY);
    ctx.scale(viewState.zoom, viewState.zoom);
    this.deps.renderParameterConnectionLayer(ctx);
    ctx.restore();
  }

  renderTopOverlayToCanvas(): void {
    const overlay = this.deps.topOverlayCanvas;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    let w: number;
    let h: number;
    if (this.cachedTop.w > 0 && this.cachedTop.h > 0) {
      w = this.cachedTop.w;
      h = this.cachedTop.h;
    } else {
      const rect = overlay.getBoundingClientRect();
      w = rect.width * dpr;
      h = rect.height * dpr;
      this.cachedTop = { w, h };
    }
    if (overlay.width !== w || overlay.height !== h) {
      overlay.width = w;
      overlay.height = h;
    }
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    const viewState = this.deps.getViewStateInternal();
    ctx.translate(viewState.panX, viewState.panY);
    ctx.scale(viewState.zoom, viewState.zoom);
    if (this.deps.getIsConnecting()) {
      this.deps.renderTemporaryConnection(ctx);
    }
    if (
      this.deps.getCurrentSmartGuides().vertical.length > 0 ||
      this.deps.getCurrentSmartGuides().horizontal.length > 0 ||
      this.deps.getIsDraggingNode()
    ) {
      this.deps.renderSmartGuides(ctx);
    }
    if (this.deps.getSelectionRectangle()) {
      this.deps.renderSelectionRectangle(ctx);
    }
    ctx.restore();
  }
}

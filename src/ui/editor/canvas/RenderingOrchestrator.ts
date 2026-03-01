/**
 * RenderingOrchestrator
 * 
 * Orchestrates rendering operations for the node editor canvas.
 * Handles render loop coordination, dirty region management, and visibility culling.
 */

import type { NodeGraph, NodeInstance, Connection } from '../../../data-model/types';
import type { NodeSpec } from '../../../types/nodeSpec';
import type { NodeRenderMetrics } from '../NodeRenderer';
import { NodeRenderer } from '../NodeRenderer';
import { LayerManager } from '../rendering/LayerManager';
import { RenderState } from '../rendering/RenderState';
import { ViewStateManager } from './ViewStateManager';
import { ConnectionStateManager } from './ConnectionStateManager';
import { getCSSColor } from '../../../utils/cssTokens';
import type { IAudioManager } from '../../../runtime/types';
import {
  isNodeVisible as isNodeVisibleImpl,
  isConnectionVisible as isConnectionVisibleImpl,
  recalculateMetricsForDirtyNodes,
  updateDirtyRegions
} from './RenderingOrchestratorDirtyRegions';

/** Frame time (ms) above which we skip overlay draws for one frame to avoid sustained overload. ~33 ms ≈ 30 fps. */
const FRAME_TIME_BACKOFF_MS = 33;
/** Frame time above this (ms) is treated as long idle; we do not apply back-off so we don't reduce quality after resume. */
const FRAME_TIME_IDLE_CAP_MS = 500;

export interface RenderingOrchestratorDependencies {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  graph: NodeGraph;
  nodeSpecs: Map<string, NodeSpec>;
  nodeMetrics: Map<string, NodeRenderMetrics>;
  nodeRenderer: NodeRenderer;
  layerManager: LayerManager;
  renderState: RenderState;
  viewStateManager: ViewStateManager;
  connectionStateManager: ConnectionStateManager;
  audioManager?: IAudioManager;
  // Callbacks for rendering overlays
  getViewStateInternal: () => { panX: number; panY: number; zoom: number };
  getSelectionState: () => { selectedNodeIds: Set<string>; selectedConnectionIds: Set<string> };
  getCachedViewportDimensions: () => { width: number; height: number };
  renderSmartGuides: () => void;
  renderSelectionRectangle: () => void;
  getCurrentSmartGuides: () => { vertical: Array<{ x: number; startY: number; endY: number }>; horizontal: Array<{ y: number; startX: number; endX: number }> };
  getIsDraggingNode: () => boolean;
  getDraggingNodeId: () => string | null;
  getSelectionRectangle: () => { x: number; y: number; width: number; height: number } | null;
  processPendingResize: () => void;
  /** When set, called after main render to draw parameter connections to overlay (above DOM nodes). */
  renderParameterConnectionsOverlay?: () => void;
  /** When set, called after param connections to draw temp connection, smart guides, selection rect above nodes. */
  renderTopOverlay?: () => void;
}

export class RenderingOrchestrator {
  private dependencies: RenderingOrchestratorDependencies;
  
  // Rendering state
  private renderRequested: boolean = false;
  private pendingRenderFrame: number | null = null;
  private previousPanX: number = 0;
  private previousPanY: number = 0;
  private previousZoom: number = 1.0;

  /** Incremented on each viewport-only frame (pan/zoom changed, no dirty nodes/connections). Reset when not viewport-only. Used to skip overlay draws on every 2nd frame during pan/zoom. */
  private viewportOnlyFrameCount: number = 0;

  /** Time when the last render() completed (performance.now()). 0 = no previous frame (first frame or reset); used for frame-time back-off. */
  private lastRenderEndTime: number = 0;

  constructor(dependencies: RenderingOrchestratorDependencies) {
    this.dependencies = dependencies;
    
    // Initialize previous pan/zoom values
    const viewState = dependencies.viewStateManager.getState();
    this.previousPanX = viewState.panX;
    this.previousPanY = viewState.panY;
    this.previousZoom = viewState.zoom;
  }

  /**
   * Update one or more dependencies (e.g. when graph is replaced via setGraph).
   * Call this from NodeEditorCanvas.setGraph so the orchestrator uses the new graph.
   */
  updateDependencies(updates: Partial<RenderingOrchestratorDependencies>): void {
    Object.assign(this.dependencies, updates);
  }

  /**
   * Request a render on the next animation frame
   * Batches multiple render requests into a single frame
   */
  requestRender(): void {
    if (this.renderRequested) {
      return; // Already scheduled
    }
    
    this.renderRequested = true;
    this.pendingRenderFrame = requestAnimationFrame(() => {
      this.render();
      this.renderRequested = false;
      this.pendingRenderFrame = null;
    });
  }

  /**
   * Mark full redraw needed and request render
   */
  markFullRedraw(): void {
    this.dependencies.renderState.markFullRedraw();
    this.requestRender();
  }

  /**
   * Main render method - orchestrates the entire rendering process
   */
  render(): void {
    const now = performance.now();
    // Frame time = time since last render completion. 0 on first frame or after long idle; used for back-off.
    const frameTime =
      this.lastRenderEndTime > 0 ? now - this.lastRenderEndTime : 0;

    // Process pending resize before rendering
    // Resize is handled by handleResize() which processes it on next frame
    // But if we're rendering and resize is pending, process it now for immediate update
    this.dependencies.processPendingResize();
    
    const { width, height } = this.dependencies.canvas;
    
    // Detect pan/zoom changes (require full redraw for incremental rendering)
    const viewState = this.dependencies.getViewStateInternal();
    const panChanged = viewState.panX !== this.previousPanX || viewState.panY !== this.previousPanY;
    const zoomChanged = viewState.zoom !== this.previousZoom;
    
    // PERFORMANCE OPTIMIZATION: Check if this is a pan-only update (no content changes)
    const dirtyNodes = this.dependencies.renderState.getDirtyNodes();
    const dirtyConnections = this.dependencies.renderState.getDirtyConnections();
    const isPanOnly = panChanged && !zoomChanged && dirtyNodes.size === 0 && dirtyConnections.size === 0;
    /** Viewport changed (pan or zoom) with no dirty nodes/connections — used to skip overlay draws on alternate frames. */
    const isViewportOnlyUpdate =
      (panChanged || zoomChanged) && dirtyNodes.size === 0 && dirtyConnections.size === 0;

    if (panChanged || zoomChanged) {
      // Viewport changed - require full redraw
      this.dependencies.renderState.markFullRedraw();
      
      // Update previous values
      this.previousPanX = viewState.panX;
      this.previousPanY = viewState.panY;
      this.previousZoom = viewState.zoom;
      this.dependencies.viewStateManager.markRendered();
    }

    // Overlay skip: during viewport-only updates, skip param-connections and top overlay on every 2nd frame
    if (isViewportOnlyUpdate) {
      this.viewportOnlyFrameCount += 1;
    } else {
      this.viewportOnlyFrameCount = 0;
    }
    
    // PERFORMANCE OPTIMIZATION: Skip unnecessary recalculations during pan-only updates
    // When only panning (no nodes/connections changed), we don't need to recalculate
    // metrics or dirty regions - just render with the new pan offset
    if (!isPanOnly) {
      recalculateMetricsForDirtyNodes(this.dependencies);
      updateDirtyRegions(this.dependencies);
    }
    
    // Standard rendering: always clear and render everything
    // FrameBuffer removed - getImageData/putImageData was too expensive
    this.dependencies.ctx.clearRect(0, 0, width, height);
    this.fillBackground();
    
    // Always render all visible content
    // Note: Without FrameBuffer, we can't do true incremental rendering (restore previous frame)
    // So we always render everything visible, but layers can use dirty regions as optimization hints
    this.renderContent();
    
    // Frame-time back-off: when frame time is over threshold during viewport-only updates,
    // skip overlays for this frame to reduce load (nodes/connections still render).
    const skipOverlaysThisFrame =
      isViewportOnlyUpdate &&
      frameTime >= FRAME_TIME_BACKOFF_MS &&
      frameTime <= FRAME_TIME_IDLE_CAP_MS;

    // Parameter connections and top overlay: during viewport-only (pan/zoom, no dirty), skip on every 2nd frame to reduce work.
    const shouldDrawOverlays =
      (!isViewportOnlyUpdate || this.viewportOnlyFrameCount % 2 === 1) &&
      !skipOverlaysThisFrame;
    if (shouldDrawOverlays) {
      this.dependencies.renderParameterConnectionsOverlay?.();
      this.dependencies.renderTopOverlay?.();
    }

    // Clear dirty state after rendering
    this.dependencies.renderState.clear();

    this.lastRenderEndTime = performance.now();
  }

  /**
   * Fill canvas background (public for resize handling)
   */
  public fillBackground(): void {
    const canvasBg = getCSSColor('canvas-bg', getCSSColor('color-gray-40', '#0a0a0e'));
    this.dependencies.ctx.fillStyle = canvasBg;
    this.dependencies.ctx.fillRect(0, 0, this.dependencies.canvas.width, this.dependencies.canvas.height);
  }

  /**
   * Render all content (grid, nodes, connections, etc.)
   */
  private renderContent(): void {
    // LayerManager is always initialized in constructor
    if (!this.dependencies.layerManager) {
      console.error('LayerManager not initialized');
      return;
    }
    
    // Save context
    this.dependencies.ctx.save();
    
    // Apply pan/zoom transform
    const viewState = this.dependencies.getViewStateInternal();
    this.dependencies.ctx.translate(viewState.panX, viewState.panY);
    this.dependencies.ctx.scale(viewState.zoom, viewState.zoom);
    
    // Render layers (grid, connections, nodes, ports, overlays)
    // Overlay (temp connection, smart guides, selection rect) is either in OverlayLayerRenderer
    // or rendered to top overlay canvas above DOM nodes
    this.dependencies.layerManager.render(this.dependencies.ctx, this.dependencies.renderState);
    
    // Restore context
    this.dependencies.ctx.restore();
  }

  /** No-op: nodes are DOM-rendered. Kept for API compatibility. */
  renderNode(_node: NodeInstance, _skipPorts: boolean = false): void {
    // Nodes are DOM-rendered (DomNodeLayer)
  }

  /** No-op: nodes are DOM-rendered. Kept for API compatibility. */
  renderNodePorts(): void {
    // Nodes are DOM-rendered (DomNodeLayer)
  }

  isNodeVisible(node: NodeInstance, metrics: NodeRenderMetrics): boolean {
    return isNodeVisibleImpl(this.dependencies, node, metrics);
  }

  isConnectionVisible(conn: Connection): boolean {
    return isConnectionVisibleImpl(this.dependencies, conn);
  }

  /**
   * Cancel pending render frame
   */
  cancelPendingRender(): void {
    if (this.pendingRenderFrame !== null) {
      cancelAnimationFrame(this.pendingRenderFrame);
      this.pendingRenderFrame = null;
      this.renderRequested = false;
    }
  }
}

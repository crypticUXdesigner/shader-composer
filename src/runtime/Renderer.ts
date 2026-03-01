/**
 * Renderer - Canvas and Rendering Management
 * 
 * Manages canvas, viewport, and rendering loop.
 * Implements the Renderer class from Runtime Integration Specification.
 */

import { ShaderInstance } from './ShaderInstance';
import { WebGLContextError } from './errors';
import type { Disposable } from '../utils/Disposable';

export class Renderer implements Disposable {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private shaderInstance: ShaderInstance | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private pendingResize: boolean = false;
  /** PERF: Debounce resize during panel open/close (0.3s transition) so we don't run every frame and tank FPS. */
  private static readonly RESIZE_DEBOUNCE_MS = 320;
  private resizeDebounceTimeout: number | null = null;
  
  // Event listeners for cleanup
  private contextLostHandler: ((e: Event) => void) | null = null;
  private contextRestoredHandler: (() => void) | null = null;
  private onContextRestoredCallback: (() => void) | null = null;
  private onContextLostCallback: (() => void) | null = null;
  
  // Dirty flag system for conditional rendering
  private isDirty: boolean = false;
  private dirtyReasons: Set<string> = new Set();
  private forceRender: boolean = false;
  
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    // Some browsers return null for 0x0 canvas; ensure non-zero backing size.
    if (canvas.width < 1 || canvas.height < 1) {
      canvas.width = Math.max(1, canvas.clientWidth || 1);
      canvas.height = Math.max(1, canvas.clientHeight || 1);
    }
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      preserveDrawingBuffer: true  // For export
    });
    
    if (!gl) {
      throw new WebGLContextError('WebGL2 not supported');
    }
    
    this.gl = gl;
    this.setupViewport();
    this.setupResizeHandler();
    this.setupContextLossHandling();
  }
  
  /**
   * Set shader instance for rendering.
   */
  setShaderInstance(instance: ShaderInstance): void {
    this.shaderInstance = instance;
    
    // Force initial render when shader is set
    this.forceRenderOnce();
  }
  
  /**
   * Mark renderer as dirty (needs rendering).
   */
  markDirty(reason: string = 'unknown'): void {
    this.isDirty = true;
    this.dirtyReasons.add(reason);
  }
  
  /**
   * Clear dirty flags after rendering.
   */
  private clearDirty(): void {
    this.isDirty = false;
    this.dirtyReasons.clear();
  }
  
  /**
   * Force a render (bypass dirty check).
   * Use sparingly - for initial render, etc.
   */
  forceRenderOnce(): void {
    this.forceRender = true;
    this.render();
  }
  
  /**
   * Render a single frame (only if dirty).
   */
  render(): void {
    if (this.gl.isContextLost && this.gl.isContextLost()) {
      this.shaderInstance = null;
      this.clearDirty();
      return;
    }
    // Always process pending resize
    if (this.pendingResize) {
      this.setupViewport();
      this.pendingResize = false;
      this.markDirty('resize');
    }
    
    // Only render if dirty or if forced
    if (!this.isDirty && !this.forceRender) {
      return; // Skip render - nothing changed
    }
    
    if (!this.shaderInstance) {
      this.clearDirty();
      return; // No shader to render
    }
    
    // Update resolution if changed
    const width = this.canvas.width;
    const height = this.canvas.height;
    this.shaderInstance.setResolution(width, height);
    
    // Clear
    this.gl.clearColor(0, 0, 0, 1);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    
    // Render
    this.shaderInstance.render(width, height);
    
    // Clear dirty flags after rendering
    this.clearDirty();
    this.forceRender = false;
  }
  
  /**
   * Start animation loop.
   * NOTE: Animation loop is handled by main.ts App class, this method is kept for API compatibility
   * but does not start a separate loop to avoid double rendering.
   */
  startAnimation(): void {
    // Animation loop is handled by main.ts, do nothing here
    // This prevents double rendering
  }
  
  /**
   * Stop animation loop.
   * NOTE: Animation loop is handled by main.ts App class, this method is kept for API compatibility.
   */
  stopAnimation(): void {
    // Animation loop is handled by main.ts, do nothing here
  }
  
  /**
   * Setup viewport based on canvas size.
   */
  private setupViewport(): void {
    const dpr = window.devicePixelRatio || 1;
    const width = this.canvas.clientWidth * dpr;
    const height = this.canvas.clientHeight * dpr;
    
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
  }
  
  /**
   * Setup resize handler.
   * Uses ResizeObserver for more accurate resize detection; debounced during panel transition to avoid FPS drops.
   */
  private setupResizeHandler(): void {
    this.resizeObserver = new ResizeObserver(() => {
      if (this.resizeDebounceTimeout !== null) window.clearTimeout(this.resizeDebounceTimeout);
      this.resizeDebounceTimeout = window.setTimeout(() => {
        this.resizeDebounceTimeout = null;
        this.handleResize();
      }, Renderer.RESIZE_DEBOUNCE_MS);
    });
    this.resizeObserver.observe(this.canvas);
  }
  
  /**
   * Handle resize event - marks resize as pending for processing in render loop.
   */
  private handleResize(): void {
    if (!this.pendingResize) {
      this.pendingResize = true;
      // Viewport will be updated in next render() call
    }
  }
  
  /**
   * Cleanup all resources.
   * Releases the WebGL context so it does not count toward the per-page context limit
   * (important for HMR or re-initialization).
   */
  destroy(): void {
    if (this.resizeDebounceTimeout !== null) {
      window.clearTimeout(this.resizeDebounceTimeout);
      this.resizeDebounceTimeout = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    
    // Remove event listeners before losing context (avoids firing during loseContext)
    if (this.contextLostHandler) {
      this.canvas.removeEventListener('webglcontextlost', this.contextLostHandler);
      this.contextLostHandler = null;
    }
    
    if (this.contextRestoredHandler) {
      this.canvas.removeEventListener('webglcontextrestored', this.contextRestoredHandler);
      this.contextRestoredHandler = null;
    }
    
    // Clean up shader instance if it exists
    if (this.shaderInstance) {
      this.shaderInstance.destroy();
      this.shaderInstance = null;
    }
    // Do not call loseContext() here. It was causing the live app's context to be killed when
    // a second App was created (e.g. DOMContentLoaded firing after a module re-run). The context
    // is released when the canvas is GC'd or the page unloads.
  }
  
  /**
   * Setup WebGL context loss handling.
   */
  private setupContextLossHandling(): void {
    this.contextLostHandler = (e: Event) => {
      e.preventDefault();
      console.warn('WebGL context lost');
      // Stop using the invalid context so we don't flood INVALID_OPERATION every frame.
      this.shaderInstance = null;
      this.onContextLostCallback?.();
    };
    
    this.contextRestoredHandler = () => {
      console.log('WebGL context restored');
      this.shaderInstance = null;
      this.setupViewport();
      this.onContextRestoredCallback?.();
    };
    
    this.canvas.addEventListener('webglcontextlost', this.contextLostHandler);
    this.canvas.addEventListener('webglcontextrestored', this.contextRestoredHandler);
  }
  
  /**
   * Register a callback to run when the WebGL context is restored after loss.
   * Used to trigger recompile so the new context gets a new ShaderInstance.
   */
  setOnContextRestored(callback: () => void): void {
    this.onContextRestoredCallback = callback;
  }

  /**
   * Register a callback to run when the WebGL context is lost.
   * Used so the app can stop its animation loop and avoid touching the invalid context.
   */
  setOnContextLost(callback: () => void): void {
    this.onContextLostCallback = callback;
  }

  /**
   * Get WebGL context (for CompilationManager).
   */
  getGLContext(): WebGL2RenderingContext {
    return this.gl;
  }
  
  /**
   * Get canvas element.
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }
}

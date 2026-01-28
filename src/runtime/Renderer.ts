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
  
  // Event listeners for cleanup
  private contextLostHandler: ((e: Event) => void) | null = null;
  private contextRestoredHandler: (() => void) | null = null;
  
  // Dirty flag system for conditional rendering
  private isDirty: boolean = false;
  private dirtyReasons: Set<string> = new Set();
  private forceRender: boolean = false;
  
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
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
   * Uses ResizeObserver for more accurate resize detection and throttles to render loop.
   */
  private setupResizeHandler(): void {
    // Use ResizeObserver for accurate canvas size changes
    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
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
   */
  destroy(): void {
    // Clean up resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    
    // Remove event listeners
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
  }
  
  /**
   * Setup WebGL context loss handling.
   */
  private setupContextLossHandling(): void {
    this.contextLostHandler = (e: Event) => {
      e.preventDefault();
      console.warn('WebGL context lost');
      this.stopAnimation();
      // Attempt recovery - context will be restored automatically
    };
    
    this.contextRestoredHandler = () => {
      console.log('WebGL context restored');
      this.setupViewport();
      // Note: Shader instance will need to be recreated by CompilationManager
    };
    
    this.canvas.addEventListener('webglcontextlost', this.contextLostHandler);
    this.canvas.addEventListener('webglcontextrestored', this.contextRestoredHandler);
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

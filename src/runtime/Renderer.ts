/**
 * Renderer - Canvas and Rendering Management
 * 
 * Manages canvas, viewport, and rendering loop.
 * Implements the Renderer class from Runtime Integration Specification.
 */

import { ShaderInstance } from './ShaderInstance';
import { WebGLContextError } from './errors';

export class Renderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private shaderInstance: ShaderInstance | null = null;
  
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
  }
  
  /**
   * Render a single frame.
   */
  render(): void {
    if (!this.shaderInstance) return;
    
    // Update resolution if changed
    const width = this.canvas.width;
    const height = this.canvas.height;
    this.shaderInstance.setResolution(width, height);
    
    // Clear
    this.gl.clearColor(0, 0, 0, 1);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    
    // Render
    this.shaderInstance.render(width, height);
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
   */
  private setupResizeHandler(): void {
    window.addEventListener('resize', () => {
      this.setupViewport();
      this.render();
    });
  }
  
  /**
   * Setup WebGL context loss handling.
   */
  private setupContextLossHandling(): void {
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      console.warn('WebGL context lost');
      this.stopAnimation();
      // Attempt recovery - context will be restored automatically
    });
    
    this.canvas.addEventListener('webglcontextrestored', () => {
      console.log('WebGL context restored');
      this.setupViewport();
      // Note: Shader instance will need to be recreated by CompilationManager
    });
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

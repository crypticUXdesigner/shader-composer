/**
 * ShaderInstance - WebGL Shader Program Management
 * 
 * Manages a single WebGL shader program and its uniform locations.
 * Implements the ShaderInstance class from Runtime Integration Specification.
 */

import type { CompilationResult } from './types';
import { getUniformName } from './utils';
import { ShaderCompilationError } from './errors';
import type { Disposable } from '../utils/Disposable';

/**
 * Base vertex shader (static, used for all shaders - fullscreen quad).
 */
const BASE_VERTEX_SHADER = `#version 300 es
in vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

/** Message thrown when WebGL context is lost so callers can skip without reporting a compilation error. */
export const SHADER_INSTANCE_CONTEXT_LOST_MESSAGE = 'WEBGL_CONTEXT_LOST';

export class ShaderInstance implements Disposable {
  /** Same as SHADER_INSTANCE_CONTEXT_LOST_MESSAGE; use for catch checks. */
  static readonly CONTEXT_LOST_MESSAGE = SHADER_INSTANCE_CONTEXT_LOST_MESSAGE;

  private gl: WebGL2RenderingContext;
  private program: WebGLProgram | null = null;
  private vertexShader: WebGLShader | null = null;
  private fragmentShader: WebGLShader | null = null;
  
  // Uniform location cache
  private uniformLocations: Map<string, WebGLUniformLocation> = new Map();
  
  // Uniform type cache (for type checking)
  private uniformTypes: Map<string, string> = new Map();
  
  /** Parameter values that map to uniforms: scalar (float/int) or vec4. */
  private parameters: Map<string, number | [number, number, number, number]> = new Map();
  
  // Global uniforms
  private time: number = 0.0;
  private timelineTime: number = 0.0;
  private resolution: [number, number] = [0, 0];
  
  // Cached position buffer (reused every frame for performance)
  private positionBuffer: WebGLBuffer | null = null;
  private positionAttribLocation: number = -1;
  
  constructor(gl: WebGL2RenderingContext, compilationResult: CompilationResult) {
    if (gl.isContextLost && gl.isContextLost()) {
      throw new Error(ShaderInstance.CONTEXT_LOST_MESSAGE);
    }
    this.gl = gl;
    this.createProgram(compilationResult);
    this.cacheUniformLocations(compilationResult);
    this.setupPositionBuffer();
  }
  
  /**
   * Create and link WebGL shader program.
   */
  private createProgram(compilationResult: CompilationResult): void {
    // Create vertex shader
    this.vertexShader = this.createShader(
      this.gl.VERTEX_SHADER,
      BASE_VERTEX_SHADER
    );
    if (!this.vertexShader) {
      throw new Error('Failed to create vertex shader');
    }
    
    // Create fragment shader
    const fragmentError = this.createShaderAndCaptureError(
      this.gl.FRAGMENT_SHADER,
      compilationResult.shaderCode
    );
    this.fragmentShader = fragmentError.shader;
    if (!this.fragmentShader) {
      throw new ShaderCompilationError(
        'Fragment shader compile failed',
        fragmentError.infoLog || 'Unknown error',
        compilationResult.shaderCode
      );
    }
    
    // Create and link program
    this.program = this.gl.createProgram();
    if (!this.program) {
      throw new Error('Failed to create WebGL program');
    }
    
    this.gl.attachShader(this.program, this.vertexShader);
    this.gl.attachShader(this.program, this.fragmentShader);
    this.gl.linkProgram(this.program);
    
    // Check link status
    if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
      const error = this.gl.getProgramInfoLog(this.program);
      this.destroy();
      throw new ShaderCompilationError(
        'Shader program link failed',
        error || 'Unknown error',
        compilationResult.shaderCode
      );
    }
  }
  
  /**
   * Create and compile a shader; on failure return null and the info log.
   * If the context is lost, throws so the caller can skip without reporting a compile error.
   */
  private createShaderAndCaptureError(type: number, source: string): { shader: WebGLShader | null; infoLog: string | null } {
    if (this.gl.isContextLost && this.gl.isContextLost()) {
      throw new Error(ShaderInstance.CONTEXT_LOST_MESSAGE);
    }
    const shader = this.gl.createShader(type);
    if (!shader) return { shader: null, infoLog: 'createShader returned null' };

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (this.gl.isContextLost && this.gl.isContextLost()) {
      this.gl.deleteShader(shader);
      throw new Error(ShaderInstance.CONTEXT_LOST_MESSAGE);
    }
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const infoLog = this.gl.getShaderInfoLog(shader);
      const shaderType = type === this.gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT';
      console.error(`[${shaderType} Shader] compile error:`, infoLog);
      console.error(`[${shaderType} Shader] source (first 2000 chars):`, source.substring(0, 2000));
      if (source.length > 2000) {
        console.error(`[${shaderType} Shader] source (last 500 chars):`, source.substring(source.length - 500));
      }
      this.gl.deleteShader(shader);
      return { shader: null, infoLog };
    }

    return { shader, infoLog: null };
  }

  /**
   * Create and compile a shader.
   */
  private createShader(type: number, source: string): WebGLShader | null {
    return this.createShaderAndCaptureError(type, source).shader;
  }
  
  /**
   * Cache uniform locations from compilation metadata.
   */
  private cacheUniformLocations(compilationResult: CompilationResult): void {
    if (!this.program) return;
    
    // Cache from compilation metadata (preferred - exact mapping)
    for (const uniform of compilationResult.uniforms) {
      const location = this.gl.getUniformLocation(this.program, uniform.name);
      if (location) {
        this.uniformLocations.set(uniform.name, location);
        this.uniformTypes.set(uniform.name, uniform.type);
        
        // Initialize with default value
        this.setUniformValue(uniform.name, uniform.type, uniform.defaultValue);
      } else {
        // Uniform was optimized out by WebGL - this is expected for unused uniforms
        // No need to log a warning since we now only declare uniforms that are actually used
      }
    }
    
    // Also cache global uniforms
    const globalUniforms = ['uTime', 'uResolution', 'uTimelineTime'];
    for (const name of globalUniforms) {
      const location = this.gl.getUniformLocation(this.program, name);
      if (location) {
        this.uniformLocations.set(name, location);
      }
    }
  }
  
  /**
   * Set uniform value (type-safe).
   */
  private setUniformValue(
    name: string,
    type: string,
    value: number | [number, number] | [number, number, number] | [number, number, number, number]
  ): void {
    if (!this.program) return;
    
    const location = this.uniformLocations.get(name);
    if (!location) {
      console.warn(`Uniform ${name} location not found (may be optimized out by shader compiler)`);
      return;
    }
    
    this.gl.useProgram(this.program);
    
    switch (type) {
      case 'float':
        this.gl.uniform1f(location, value as number);
        break;
      case 'int':
        this.gl.uniform1i(location, Math.round(value as number));
        break;
      case 'vec2':
        const v2 = value as [number, number];
        this.gl.uniform2f(location, v2[0], v2[1]);
        break;
      case 'vec3':
        const v3 = value as [number, number, number];
        this.gl.uniform3f(location, v3[0], v3[1], v3[2]);
        break;
      case 'vec4':
        const v4 = value as [number, number, number, number];
        this.gl.uniform4f(location, v4[0], v4[1], v4[2], v4[3]);
        break;
      default:
        console.warn(`Unknown uniform type: ${type}`);
    }
  }
  
  /**
   * Update node parameter value (scalar for float/int uniforms, vec4 tuple for vec4 uniforms).
   */
  setParameter(nodeId: string, paramName: string, value: number | [number, number, number, number]): void {
    const key = `${nodeId}.${paramName}`;
    this.parameters.set(key, value);

    const uniformName = getUniformName(nodeId, paramName);
    const uniformType = this.uniformTypes.get(uniformName);

    if (!uniformType) return;

    this.setUniformValue(uniformName, uniformType, value);
  }

  /**
   * Batch parameter updates (more efficient).
   */
  setParameters(updates: Array<{ nodeId: string, paramName: string, value: number | [number, number, number, number] }>): void {
    if (!this.program) return;
    
    this.gl.useProgram(this.program);
    
    for (const update of updates) {
      const key = `${update.nodeId}.${update.paramName}`;
      this.parameters.set(key, update.value);
      
      const uniformName = getUniformName(update.nodeId, update.paramName);
      const uniformType = this.uniformTypes.get(uniformName);
      
      if (uniformType) {
        this.setUniformValue(uniformName, uniformType, update.value);
      }
    }
  }

  /**
   * Set audio uniform (for audio node outputs that are uniforms)
   * Silently skips when uniform is not in shader (e.g. panel band not connected to any parameter).
   */
  setAudioUniform(nodeId: string, outputName: string, value: number): void {
    const uniformName = getUniformName(nodeId, outputName);
    if (!this.uniformLocations.has(uniformName)) {
      return; // Not in shader (optimized out or not declared) - expected for unused audio bands
    }
    const uniformType = this.uniformTypes.get(uniformName) || 'float';
    this.setUniformValue(uniformName, uniformType, value);
  }
  
  /**
   * Set time uniform.
   */
  setTime(time: number): void {
    this.time = time;
    
    if (!this.program) return;
    
    const location = this.uniformLocations.get('uTime');
    if (location) {
      this.gl.useProgram(this.program);
      this.gl.uniform1f(location, time);
    }
  }

  /**
   * Set timeline time uniform (for automation; WP 03).
   * Set each frame from timeline currentTime so automation in shader stays in sync.
   */
  setTimelineTime(time: number): void {
    this.timelineTime = time;
    if (!this.program) return;
    const location = this.uniformLocations.get('uTimelineTime');
    if (location) {
      this.gl.useProgram(this.program);
      this.gl.uniform1f(location, time);
    }
  }

  getTime(): number {
    return this.time;
  }

  getTimelineTime(): number {
    return this.timelineTime;
  }
  
  /**
   * Set resolution uniform.
   */
  setResolution(width: number, height: number): void {
    if (this.resolution[0] === width && this.resolution[1] === height) {
      return;  // No change
    }
    
    this.resolution = [width, height];
    
    if (!this.program) return;
    
    const location = this.uniformLocations.get('uResolution');
    if (location) {
      this.gl.useProgram(this.program);
      this.gl.uniform2f(location, width, height);
    }
  }
  
  /**
   * Get all parameter values (for transfer to new instance).
   */
  getParameters(): Map<string, number | [number, number, number, number]> {
    return new Map(this.parameters);
  }
  
  /**
   * Setup position buffer (called once during construction).
   */
  private setupPositionBuffer(): void {
    if (!this.program) {
      console.warn('[ShaderInstance] Cannot setup position buffer: program not created yet');
      return;
    }
    
    // Create buffer once
    this.positionBuffer = this.gl.createBuffer();
    if (!this.positionBuffer) {
      console.error('[ShaderInstance] Failed to create position buffer');
      return;
    }
    
    // Cache attribute location
    this.positionAttribLocation = this.gl.getAttribLocation(this.program, 'a_position');
    if (this.positionAttribLocation === -1) {
      console.warn('[ShaderInstance] Position attribute location not found');
    }
    
    // Set buffer data (static, never changes)
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    const positions = new Float32Array([
      -1, -1,  // Bottom-left
       1, -1,  // Bottom-right
      -1,  1,  // Top-left
       1,  1   // Top-right
    ]);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);
  }
  
  /**
   * Render fullscreen quad.
   */
  render(width: number, height: number): void {
    if (!this.program || !this.positionBuffer) return;
    
    this.gl.useProgram(this.program);
    
    // Set global uniforms (only if changed - setResolution checks internally)
    this.setResolution(width, height);
    
    // Ensure time uniform is set (setTime is called every frame from animation loop,
    // but we set it here too in case render() is called directly from resize/compilation)
    const timeLocation = this.uniformLocations.get('uTime');
    if (timeLocation) {
      this.gl.uniform1f(timeLocation, this.time);
    }

    const timelineTimeLocation = this.uniformLocations.get('uTimelineTime');
    if (timelineTimeLocation) {
      this.gl.uniform1f(timelineTimeLocation, this.timelineTime);
    }
    
    // Use cached position buffer
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.enableVertexAttribArray(this.positionAttribLocation);
    this.gl.vertexAttribPointer(this.positionAttribLocation, 2, this.gl.FLOAT, false, 0, 0);
    
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }
  
  /**
   * Destroy shader instance and clean up resources.
   */
  destroy(): void {
    if (this.vertexShader) {
      this.gl.deleteShader(this.vertexShader);
      this.vertexShader = null;
    }
    if (this.fragmentShader) {
      this.gl.deleteShader(this.fragmentShader);
      this.fragmentShader = null;
    }
    if (this.program) {
      this.gl.deleteProgram(this.program);
      this.program = null;
    }
    if (this.positionBuffer) {
      this.gl.deleteBuffer(this.positionBuffer);
      this.positionBuffer = null;
    }
    this.uniformLocations.clear();
    this.uniformTypes.clear();
    this.parameters.clear();
  }
}

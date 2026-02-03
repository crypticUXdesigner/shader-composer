/**
 * Factory Functions for Runtime Components
 * 
 * Provides factory functions for creating runtime components with dependency injection.
 * This enables better testability and reduces coupling between components.
 */

import { Renderer } from './Renderer';
import { AudioManager } from './AudioManager';
import { CompilationManager } from './CompilationManager';
import { RuntimeManager } from './RuntimeManager';
import type { ShaderCompiler, ErrorCallback, IRenderer, IAudioManager, ICompilationManager } from './types';

/**
 * Create a Renderer instance.
 * @param canvas - HTML canvas element for rendering
 * @returns Renderer instance
 */
export function createRenderer(canvas: HTMLCanvasElement): IRenderer {
  return new Renderer(canvas);
}

/**
 * Create an AudioManager instance.
 * @param errorHandler - Optional error handler
 * @returns AudioManager instance
 */
export function createAudioManager(errorHandler?: import('../utils/errorHandling').ErrorHandler): IAudioManager {
  return new AudioManager(errorHandler);
}

/**
 * Create a CompilationManager instance.
 * @param compiler - Shader compiler instance
 * @param renderer - Renderer instance
 * @param errorCallback - Optional error callback (deprecated, use errorHandler)
 * @param errorHandler - Optional error handler
 * @returns CompilationManager instance
 */
export function createCompilationManager(
  compiler: ShaderCompiler,
  renderer: IRenderer,
  errorCallback?: ErrorCallback,
  errorHandler?: import('../utils/errorHandling').ErrorHandler
): ICompilationManager {
  return new CompilationManager(
    compiler,
    renderer as Renderer, // Type assertion needed because CompilationManager expects concrete Renderer
    errorCallback,
    errorHandler
  );
}

/**
 * Create a RuntimeManager instance with all dependencies injected.
 * @param canvas - HTML canvas element for rendering
 * @param compiler - Shader compiler instance
 * @param errorCallback - Optional error callback (deprecated, use errorHandler)
 * @param errorHandler - Optional error handler
 * @returns RuntimeManager instance
 */
export function createRuntimeManager(
  canvas: HTMLCanvasElement,
  compiler: ShaderCompiler,
  errorCallback?: ErrorCallback,
  errorHandler?: import('../utils/errorHandling').ErrorHandler
): RuntimeManager {
  // Create dependencies using factories
  const renderer = createRenderer(canvas);
  const audioManager = createAudioManager(errorHandler);
  const compilationManager = createCompilationManager(compiler, renderer, errorCallback, errorHandler);

  // Create RuntimeManager with injected dependencies
  return new RuntimeManager(renderer, audioManager, compilationManager, errorCallback, errorHandler);
}

/**
 * Create a RuntimeManager instance with custom dependencies (for testing).
 * @param renderer - Renderer instance
 * @param audioManager - AudioManager instance
 * @param compilationManager - CompilationManager instance
 * @param errorCallback - Optional error callback (deprecated, use errorHandler)
 * @param errorHandler - Optional error handler
 * @returns RuntimeManager instance
 */
export function createRuntimeManagerWithDependencies(
  renderer: IRenderer,
  audioManager: IAudioManager,
  compilationManager: ICompilationManager,
  errorCallback?: ErrorCallback,
  errorHandler?: import('../utils/errorHandling').ErrorHandler
): RuntimeManager {
  return new RuntimeManager(renderer, audioManager, compilationManager, errorCallback, errorHandler);
}

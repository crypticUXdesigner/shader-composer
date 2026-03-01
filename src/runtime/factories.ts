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
import type { ShaderCompiler, IRenderer, IAudioManager, ICompilationManager } from './types';
import type { NodeSpec } from '../types';

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
 * @param errorHandler - Optional error handler (falls back to globalErrorHandler when not set)
 * @param worker - Optional compilation worker; when set, recompile runs in worker
 * @returns CompilationManager instance
 */
export function createCompilationManager(
  compiler: ShaderCompiler,
  renderer: IRenderer,
  errorHandler?: import('../utils/errorHandling').ErrorHandler,
  worker: Worker | null = null
): ICompilationManager {
  const cm = new CompilationManager(
    compiler,
    renderer as Renderer, // Type assertion needed because CompilationManager expects concrete Renderer
    errorHandler
  );
  if (worker !== null) {
    cm.setWorker(worker);
  }
  return cm;
}

const INIT_TIMEOUT_MS = 5000;

/**
 * Wait for the compilation worker to reply with 'inited' after init.
 * Rejects on timeout or worker error.
 */
function waitForWorkerInited(worker: Worker): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('Compilation worker init timeout'));
    }, INIT_TIMEOUT_MS);

    const onMessage = (ev: MessageEvent) => {
      if (ev.data?.type === 'inited') {
        cleanup();
        resolve();
      }
    };

    const onError = (err: ErrorEvent) => {
      cleanup();
      reject(err.message ? new Error(err.message) : new Error('Compilation worker init error'));
    };

    const cleanup = () => {
      clearTimeout(timeoutId);
      worker.onmessage = null;
      worker.onerror = null;
    };

    worker.onmessage = onMessage;
    worker.onerror = onError;
  });
}

/**
 * Create a RuntimeManager instance with all dependencies injected.
 * When nodeSpecsForWorker is provided, a compilation worker is created, inited, and passed to CompilationManager (async).
 * When omitted, no worker is created and compilation runs on the main thread (sync).
 * @param canvas - HTML canvas element for rendering
 * @param compiler - Shader compiler instance
 * @param errorHandler - Optional error handler (falls back to globalErrorHandler when not set)
 * @param nodeSpecsForWorker - Optional node specs to init the compilation worker; when provided, returns Promise
 * @returns RuntimeManager, or Promise<RuntimeManager> when nodeSpecsForWorker is provided
 */
export function createRuntimeManager(
  canvas: HTMLCanvasElement,
  compiler: ShaderCompiler,
  errorHandler?: import('../utils/errorHandling').ErrorHandler,
  nodeSpecsForWorker?: Map<string, NodeSpec> | Record<string, NodeSpec>
): RuntimeManager | Promise<RuntimeManager> {
  const renderer = createRenderer(canvas);
  const audioManager = createAudioManager(errorHandler);

  if (nodeSpecsForWorker == null) {
    const compilationManager = createCompilationManager(compiler, renderer, errorHandler);
    return new RuntimeManager(renderer, audioManager, compilationManager, errorHandler);
  }

  return (async (): Promise<RuntimeManager> => {
    // Use Vite's ?worker import so the worker is bundled with correct MIME type and base path (avoids video/mp2t in production)
    const { default: WorkerConstructor } = await import(
      './compilation/compilationWorker.ts?worker'
    );
    const worker = new WorkerConstructor();
    const nodeSpecsObj =
      nodeSpecsForWorker instanceof Map ? Object.fromEntries(nodeSpecsForWorker) : nodeSpecsForWorker;
    worker.postMessage({ type: 'init', nodeSpecs: nodeSpecsObj });
    await waitForWorkerInited(worker);
    const compilationManager = createCompilationManager(compiler, renderer, errorHandler, worker);
    return new RuntimeManager(renderer, audioManager, compilationManager, errorHandler);
  })();
}

/**
 * Create a RuntimeManager instance with custom dependencies (for testing).
 * @param renderer - Renderer instance
 * @param audioManager - AudioManager instance
 * @param compilationManager - CompilationManager instance
 * @param errorHandler - Optional error handler (falls back to globalErrorHandler when not set)
 * @returns RuntimeManager instance
 */
export function createRuntimeManagerWithDependencies(
  renderer: IRenderer,
  audioManager: IAudioManager,
  compilationManager: ICompilationManager,
  errorHandler?: import('../utils/errorHandling').ErrorHandler
): RuntimeManager {
  return new RuntimeManager(renderer, audioManager, compilationManager, errorHandler);
}

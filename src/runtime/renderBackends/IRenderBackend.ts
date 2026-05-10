import type { ShaderInstance } from '../ShaderInstance';
import type { CompilationResult, PreviewProgramInstance } from '../types';
import type { RenderBackendSelection } from './renderBackendTypes';

/**
 * Render backend seam (preview only, Task 01).
 * Keep surface minimal; expand only when later tasks require it.
 */
export interface IRenderBackend {
  /** Debug/telemetry selection metadata. */
  readonly selection: RenderBackendSelection;

  markDirty(reason?: string): void;
  render(): void;

  /** Keep legacy name to minimize churn in compilation/runtime code paths. */
  setShaderInstance(instance: ShaderInstance): void;

  /**
   * (Task 03) Optional WebGPU program install path.
   * When `result.backend === 'webgpu' && result.supported`, the backend may install a WebGPU pipeline
   * and return the active program sink for time/param/audio updates. Returning null means "not handled".
   */
  setWebGpuProgram?(result: CompilationResult): PreviewProgramInstance | null;

  getCanvas(): HTMLCanvasElement;
  getGLContext(): WebGL2RenderingContext;

  setOnContextRestored(callback: () => void): void;
  setOnContextLost(callback: () => void): void;

  /** Match {@link import('../types').IRenderer.notifyPreviewLayoutChanged}. */
  notifyPreviewLayoutChanged?(): void;

  /** Match {@link import('../types').IRenderer.needsPresentationFlush}. */
  needsPresentationFlush?(): boolean;
}


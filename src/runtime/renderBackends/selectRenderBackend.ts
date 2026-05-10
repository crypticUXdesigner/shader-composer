import type { ErrorHandler } from '../../utils/errorHandling';
import type { IRenderBackend } from './IRenderBackend';
import { WebGpuRenderBackend } from './WebGpuRenderBackend';
import { WebGlRenderBackend } from './WebGlRenderBackend';
import type { RenderBackendMode, RenderBackendSelection } from './renderBackendTypes';

function hasNavigatorGpu(): boolean {
  const nav = typeof navigator !== 'undefined' ? (navigator as unknown as { gpu?: unknown }) : undefined;
  return !!nav?.gpu;
}

export function selectRenderBackend(
  canvas: HTMLCanvasElement,
  mode: RenderBackendMode,
  errorHandler?: ErrorHandler
): IRenderBackend {
  const selection: RenderBackendSelection = (() => {
    if (mode === 'webgl') {
      return { mode, selected: 'webgl2', reason: 'forced.webgl' };
    }
    if (mode === 'webgpu') {
      return { mode, selected: 'webgpu', reason: 'forced.webgpu' };
    }
    // auto
    if (hasNavigatorGpu()) {
      return { mode, selected: 'webgpu', reason: 'auto.webgpu.navigator.gpu.present' };
    }
    return { mode, selected: 'webgl2', reason: 'auto.webgl2.navigator.gpu.absent' };
  })();

  if (selection.selected === 'webgpu') {
    return new WebGpuRenderBackend(canvas, selection, errorHandler);
  }

  return new WebGlRenderBackend(canvas, selection);
}


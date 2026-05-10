/**
 * P0 live-preview performance marks (User Timing).
 * Stable User Timing mark names for preview / compile / editor (DevTools + instrumentation).
 * Safe in workers, tests, and environments without performance.mark.
 */

const perf: Performance | undefined =
  typeof globalThis !== 'undefined' && 'performance' in globalThis
    ? (globalThis.performance as Performance)
    : undefined;

/** Low-allocation mark helper; no string concatenation. */
export function previewPerformanceMark(name: string): void {
  if (!perf?.mark) return;
  try {
    perf.mark(name);
  } catch {
    // Quota or unsupported — ignore
  }
}

/** Stable mark names for DevTools Performance + future P1a subscribers. */
export const PreviewPerfMark = {
  previewFrameStart: 'preview.frame.start',
  previewFrameEnd: 'preview.frame.end',
  previewUniformsStart: 'preview.uniforms.start',
  previewUniformsEnd: 'preview.uniforms.end',
  previewDrawStart: 'preview.draw.start',
  previewDrawEnd: 'preview.draw.end',
  compileRequested: 'compile.requested',
  compileWorkerStart: 'compile.worker.start',
  compileWorkerEnd: 'compile.worker.end',
  compileMainThreadLinkStart: 'compile.mainThreadLink.start',
  compileMainThreadLinkEnd: 'compile.mainThreadLink.end',
  editorDragStart: 'editor.drag.start',
  editorDragEnd: 'editor.drag.end',
  editorPanZoomStart: 'editor.panZoom.start',
  editorPanZoomEnd: 'editor.panZoom.end',
  interactionReleaseSettleFrame: 'interaction.release.settleFrame',
  /** Fires when preview backing store dimensions change (debounced resize path). */
  previewViewportLayout: 'preview.viewport.layout'
} as const;

/** Main-thread counters (no per-frame allocation); for DevTools / future debug API. */
export const previewPerfCounters = {
  previewFrameCommits: 0,
  compileRequests: 0,
  // Task 12: WebGPU perf counters (best-effort; dev overlay).
  webgpuShaderModuleCreates: 0,
  webgpuShaderModuleCacheHits: 0,
  webgpuRenderPipelineCreates: 0,
  webgpuRenderPipelineCacheHits: 0,
  /** LRU evictions (oldest WGSL previews dropped) once cache exceeds WEBGPU_PREVIEW_CACHE_MAX_MODULES */
  webgpuShaderPipelineCacheEvictions: 0
};

export function previewPerfResetCounters(): void {
  previewPerfCounters.previewFrameCommits = 0;
  previewPerfCounters.compileRequests = 0;
  previewPerfCounters.webgpuShaderModuleCreates = 0;
  previewPerfCounters.webgpuShaderModuleCacheHits = 0;
  previewPerfCounters.webgpuRenderPipelineCreates = 0;
  previewPerfCounters.webgpuRenderPipelineCacheHits = 0;
  previewPerfCounters.webgpuShaderPipelineCacheEvictions = 0;
}

/** Max WGSL fullscreen preview shader+pipeline pairs retained per preview WebGpuRenderBackend session. */
export const WEBGPU_PREVIEW_CACHE_MAX_MODULES = 64;

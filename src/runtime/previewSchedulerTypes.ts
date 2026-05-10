/**
 * Preview scheduler contract types.
 * Subset of dirty keys — extend as more sources are wired.
 */

import type { RenderBackendSelection } from './renderBackends/renderBackendTypes';

/** Typed dirty reason keys (expand as the scheduler grows). */
export type PreviewDirtyReasonKey =
  | 'graph.semantic'
  | 'graph.layoutOnly'
  | 'runtime.time'
  | 'runtime.timeline'
  | 'runtime.audio'
  | 'runtime.parameter'
  | 'renderer.resize'
  | 'renderer.dprChange'
  | 'compile.started'
  | 'compile.succeeded'
  | 'compile.failed'
  | 'interaction.started'
  | 'interaction.ended'
  | 'visibility.hidden'
  | 'visibility.visible'
  | 'manual.markDirty'
  | 'unknown';

export interface PreviewDirtyEvent {
  reason: PreviewDirtyReasonKey;
  /** Subsystem label for traces (e.g. Renderer, CompilationManager). */
  source: string;
  timestampMs: number;
  requestedUniformWork: boolean;
  requestedPresent: boolean;
  coalesced: boolean;
  dropped: boolean;
  dropNote?: string;
}

/** Scheduler states (debug/telemetry). */
export type PreviewSchedulerState =
  | 'idleStatic'
  | 'needsSingleFrame'
  | 'playingFullRate'
  | 'playingCapped'
  | 'interactionReduced'
  | 'audioReactivePaused'
  | 'compilePendingLastGoodFrame'
  | 'hiddenThrottled'
  | 'legacyStub';

export interface PreviewSchedulerDebugState {
  mode: PreviewSchedulerState;
  lastDirty: PreviewDirtyReasonKey | null;
  lastCompilePhase: 'idle' | 'started' | 'succeeded' | 'failed';
  renderBackendSelection?: RenderBackendSelection;
  /**
   * Effective backend used for the most recently applied program.
   * This can differ from `renderBackendSelection.selected` during fallback-by-coverage.
   *
   * `details` carries the compiler's `unsupportedReasons` when WebGPU was requested but
   * the graph fell back to WebGL (e.g. fractal presets using `generic-raymarcher`). Surfaced
   * by the dev overlay so the reason is visible without inspecting compiler output by hand.
   */
  effectiveBackend?: {
    selected: RenderBackendSelection['selected'];
    reason: string;
    details?: string[];
  };
  /** Monotonic preview frame transactions observed (Renderer full commit). */
  previewFrameCommitCount: number;
  /**
   * Last preview framebuffer + layout sizes from {@link Renderer.setupViewport}
   * (shader draws at `backingPx`; CSS box is `layoutCssPx`).
   */
  previewViewport?: {
    backingPx: { width: number; height: number };
    layoutCssPx: { width: number; height: number };
    /** DPR multiplier applied in setupViewport (may differ from `window.devicePixelRatio` when adaptive preview caps). */
    effectivePreviewDpr: number;
  };
  /** Last N dirty events (newest last). */
  recentEvents: PreviewDirtyEvent[];
}

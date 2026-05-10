/**
 * Preview scheduler (dev/debug): records dirty + compile signals.
 * Does not change presentation cadence.
 *
 * Task 11 — selection vs effective preview backend:
 * - `renderBackendSelection` mirrors URL/engine choice (`auto` / forced WebGPU / WebGL).
 * - `effectiveBackend` reflects what actually draws the current frame: WebGPU when a WGSL
 *   program is installed, otherwise WebGL2 — including automatic fallback when WebGPU init,
 *   device-lost, coverage, or **WebGPU compile failure** occurs (`CompilationManager`
 *   calls {@link PreviewScheduler.setEffectiveBackend} with reasons in `details`).
 */

import type {
  PreviewDirtyEvent,
  PreviewDirtyReasonKey,
  PreviewSchedulerDebugState,
  PreviewSchedulerState
} from './previewSchedulerTypes';
import type { RenderBackendSelection } from './renderBackends/renderBackendTypes';
import { previewPerfCounters } from './previewPerformanceMarks';
import { clearPreviewCompileProgressToast } from '../lib/stores/previewCompileStatusStore';

const MAX_EVENTS = 64;

/** Map legacy Renderer.markDirty strings to taxonomy keys. */
export function mapLegacyDirtyReason(reason: string | undefined): PreviewDirtyReasonKey {
  switch (reason) {
    case 'time':
      return 'runtime.time';
    case 'audio':
      return 'runtime.audio';
    case 'compilation':
      return 'compile.succeeded';
    case 'resize':
      return 'renderer.resize';
    case 'parameter':
      return 'runtime.parameter';
    default:
      return 'unknown';
  }
}

const ADAPTIVE_PREVIEW_STORAGE_KEY = 'shadernoice.previewAdaptive';

export class PreviewScheduler {
  private mode: PreviewSchedulerState = 'legacyStub';
  private lastDirty: PreviewDirtyReasonKey | null = null;
  private lastCompilePhase: PreviewSchedulerDebugState['lastCompilePhase'] = 'idle';
  private renderBackendSelection: RenderBackendSelection | undefined = undefined;
  private effectiveBackend: PreviewSchedulerDebugState['effectiveBackend'] | undefined = undefined;
  private events: PreviewDirtyEvent[] = [];
  private previewFrameCommitCount = 0;
  private marksEnabled = true;
  private overlayTimer: ReturnType<typeof setInterval> | null = null;
  private overlayEl: HTMLDivElement | null = null;
  /** When true, preview may cap DPR during interaction and settle after release. */
  private adaptivePreviewEnabled =
    typeof localStorage !== 'undefined' && localStorage.getItem(ADAPTIVE_PREVIEW_STORAGE_KEY) === '1';
  /** Next `Renderer.setupViewport` uses full device DPR once. */
  private adaptiveSettleFullDprOnce = false;

  recordDirty(
    legacyReason: string | undefined,
    options?: {
      source?: string;
      requestedUniformWork?: boolean;
      requestedPresent?: boolean;
      coalesced?: boolean;
      dropped?: boolean;
      dropNote?: string;
    }
  ): void {
    const reason = mapLegacyDirtyReason(legacyReason);
    const ev: PreviewDirtyEvent = {
      reason,
      source: options?.source ?? 'Renderer',
      timestampMs: typeof performance !== 'undefined' ? performance.now() : Date.now(),
      requestedUniformWork: options?.requestedUniformWork ?? true,
      requestedPresent: options?.requestedPresent ?? true,
      coalesced: options?.coalesced ?? false,
      dropped: options?.dropped ?? false,
      dropNote: options?.dropNote
    };
    this.pushEvent(ev);
    this.lastDirty = reason;
  }

  recordTypedDirty(
    reason: PreviewDirtyReasonKey,
    source: string,
    partial?: Partial<Omit<PreviewDirtyEvent, 'reason' | 'source' | 'timestampMs'>>
  ): void {
    const ev: PreviewDirtyEvent = {
      reason,
      source,
      timestampMs: typeof performance !== 'undefined' ? performance.now() : Date.now(),
      requestedUniformWork: partial?.requestedUniformWork ?? true,
      requestedPresent: partial?.requestedPresent ?? true,
      coalesced: partial?.coalesced ?? false,
      dropped: partial?.dropped ?? false,
      dropNote: partial?.dropNote
    };
    this.pushEvent(ev);
    this.lastDirty = reason;
  }

  recordCompileStarted(): void {
    this.lastCompilePhase = 'started';
    this.mode = 'compilePendingLastGoodFrame';
    this.recordTypedDirty('compile.started', 'CompilationManager', {
      requestedUniformWork: false,
      requestedPresent: false
    });
  }

  recordCompileSucceeded(): void {
    clearPreviewCompileProgressToast();
    this.lastCompilePhase = 'succeeded';
    this.mode = 'legacyStub';
    this.recordTypedDirty('compile.succeeded', 'CompilationManager');
  }

  recordCompileFailed(): void {
    clearPreviewCompileProgressToast();
    this.lastCompilePhase = 'failed';
    this.mode = 'legacyStub';
    this.recordTypedDirty('compile.failed', 'CompilationManager', {
      requestedPresent: false
    });
  }

  /** Editor began a continuous interaction (interactionReduced). */
  recordInteractionStart(source: string): void {
    this.mode = 'interactionReduced';
    this.recordTypedDirty('interaction.started', source, {
      requestedUniformWork: false,
      requestedPresent: true
    });
  }

  /** Editor ended interaction; scheduler may settle. */
  recordInteractionEnd(source: string): void {
    this.recordTypedDirty('interaction.ended', source);
    if (this.lastCompilePhase !== 'started') {
      this.mode = 'legacyStub';
    }
    if (this.adaptivePreviewEnabled) {
      this.adaptiveSettleFullDprOnce = true;
    }
  }

  isAdaptivePreviewEnabled(): boolean {
    return this.adaptivePreviewEnabled;
  }

  setAdaptivePreviewEnabled(on: boolean): void {
    this.adaptivePreviewEnabled = on;
    if (typeof localStorage !== 'undefined') {
      if (on) localStorage.setItem(ADAPTIVE_PREVIEW_STORAGE_KEY, '1');
      else localStorage.removeItem(ADAPTIVE_PREVIEW_STORAGE_KEY);
    }
  }

  /** Renderer: next `setupViewport` uses full DPR once (settle), then returns false. */
  consumeAdaptiveSettleFullDprOnce(): boolean {
    if (!this.adaptiveSettleFullDprOnce) return false;
    this.adaptiveSettleFullDprOnce = false;
    return true;
  }

  /** Called when a full preview frame transaction commits (see Renderer). */
  recordPreviewFrameCommit(): void {
    this.previewFrameCommitCount += 1;
  }

  private previewViewport:
    | PreviewSchedulerDebugState['previewViewport']
    | undefined;

  /**
   * Updated whenever the preview backing store / viewport is recomputed (same path as shader resolution).
   */
  recordPreviewViewportSnapshot(snapshot: NonNullable<PreviewSchedulerDebugState['previewViewport']>): void {
    this.previewViewport = snapshot;
  }

  getState(): PreviewSchedulerDebugState {
    return {
      mode: this.mode,
      lastDirty: this.lastDirty,
      lastCompilePhase: this.lastCompilePhase,
      renderBackendSelection: this.renderBackendSelection,
      effectiveBackend: this.effectiveBackend,
      previewFrameCommitCount: this.previewFrameCommitCount,
      previewViewport: this.previewViewport,
      recentEvents: this.events.slice()
    };
  }

  setRenderBackendSelection(selection: RenderBackendSelection): void {
    this.renderBackendSelection = selection;
  }

  setEffectiveBackend(
    selected: RenderBackendSelection['selected'],
    reason: string,
    details?: string[]
  ): void {
    this.effectiveBackend = {
      selected,
      reason,
      details: details && details.length > 0 ? [...details] : undefined,
    };
  }

  getLastFrames(_n: number): PreviewDirtyEvent[] {
    return this.events.slice();
  }

  enableMarks(on: boolean): void {
    this.marksEnabled = on;
  }

  areMarksEnabled(): boolean {
    return this.marksEnabled;
  }

  enableOverlay(on: boolean): void {
    if (!on) {
      if (this.overlayTimer !== null) {
        clearInterval(this.overlayTimer);
        this.overlayTimer = null;
      }
      if (this.overlayEl?.parentNode) {
        this.overlayEl.parentNode.removeChild(this.overlayEl);
      }
      this.overlayEl = null;
      return;
    }
    if (typeof document === 'undefined') return;
    if (this.overlayTimer !== null) return;

    this.overlayEl = document.createElement('div');
    this.overlayEl.setAttribute('data-preview-scheduler-overlay', 'true');
    const st = this.overlayEl.style;
    st.position = 'fixed';
    st.right = '8px';
    st.bottom = '8px';
    st.zIndex = '99999';
    st.maxWidth = '340px';
    st.padding = '8px 10px';
    st.font = '11px/1.35 system-ui, sans-serif';
    st.color = '#e8e8e8';
    st.background = 'rgba(20,20,24,0.88)';
    st.borderRadius = '6px';
    st.pointerEvents = 'none';
    st.whiteSpace = 'pre-wrap';
    document.body.appendChild(this.overlayEl);

    const tick = (): void => {
      if (!this.overlayEl) return;
      const s = this.getState();
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
      const vp = s.previewViewport;
      const renderLine = vp
        ? `shader output (backing): ${vp.backingPx.width}×${vp.backingPx.height} px`
        : 'shader output (backing): —';
      const layoutLine = vp
        ? `preview layout (CSS): ${Math.round(vp.layoutCssPx.width)}×${Math.round(vp.layoutCssPx.height)} px`
        : 'preview layout (CSS): —';
      const previewDprLine = vp
        ? `preview DPR (effective): ${vp.effectivePreviewDpr === Math.floor(vp.effectivePreviewDpr) ? vp.effectivePreviewDpr : vp.effectivePreviewDpr.toFixed(3)}`
        : 'preview DPR (effective): —';
      const backend = s.renderBackendSelection
        ? `${s.renderBackendSelection.selected} (${s.renderBackendSelection.reason})`
        : '—';
      const effective = s.effectiveBackend
        ? `${s.effectiveBackend.selected} (${s.effectiveBackend.reason})${
            s.effectiveBackend.details && s.effectiveBackend.details.length > 0
              ? ` [${s.effectiveBackend.details.slice(0, 3).join('; ')}${s.effectiveBackend.details.length > 3 ? '; …' : ''}]`
              : ''
          }`
        : '—';
      this.overlayEl.textContent = [
        `mode: ${s.mode}`,
        renderLine,
        layoutLine,
        previewDprLine,
        `compile: ${s.lastCompilePhase}`,
        `lastDirty: ${s.lastDirty ?? '—'}`,
        `backend: ${backend}`,
        `effective: ${effective}`,
        `previewCommits: ${s.previewFrameCommitCount}`,
        `wgpu modules: +${previewPerfCounters.webgpuShaderModuleCreates} (hit ${previewPerfCounters.webgpuShaderModuleCacheHits})`,
        `wgpu cache evict: ${previewPerfCounters.webgpuShaderPipelineCacheEvictions}`,
        `wgpu pipes: +${previewPerfCounters.webgpuRenderPipelineCreates} (hit ${previewPerfCounters.webgpuRenderPipelineCacheHits})`,
        `adaptive: ${this.adaptivePreviewEnabled ? 'on' : 'off'}`,
        `window.devicePixelRatio: ${dpr}`
      ].join('\n');
    };
    tick();
    this.overlayTimer = setInterval(tick, 300);
  }

  private pushEvent(ev: PreviewDirtyEvent): void {
    this.events.push(ev);
    if (this.events.length > MAX_EVENTS) {
      this.events.splice(0, this.events.length - MAX_EVENTS);
    }
  }
}

let schedulerSingleton: PreviewScheduler | null = null;

export function getPreviewScheduler(): PreviewScheduler {
  if (!schedulerSingleton) {
    schedulerSingleton = new PreviewScheduler();
  }
  return schedulerSingleton;
}

export type PreviewSchedulerDebugApi = {
  getState: () => PreviewSchedulerDebugState;
  getLastFrames: (n: number) => PreviewDirtyEvent[];
  enableMarks: (on: boolean) => void;
  enableOverlay: (on: boolean) => void;
  /** Toggle adaptive preview DPR cap (persists `localStorage` key). */
  setAdaptivePreview: (on: boolean) => void;
};

/**
 * Attach dev-only debug API (plan §6 P1a). After calling, `window.__previewSchedulerDebug` exposes:
 * `getState()`, `getLastFrames(n)`, `enableMarks(on)` (reserved; P0 marks always on), `enableOverlay(on)`.
 */
export function installPreviewSchedulerDebugGlobal(): void {
  if (typeof window === 'undefined') return;
  if (!import.meta.env.DEV) return;

  const api: PreviewSchedulerDebugApi = {
    getState: () => getPreviewScheduler().getState(),
    getLastFrames: (n) => getPreviewScheduler().getLastFrames(n),
    enableMarks: (on) => getPreviewScheduler().enableMarks(on),
    enableOverlay: (on) => getPreviewScheduler().enableOverlay(on),
    setAdaptivePreview: (on) => getPreviewScheduler().setAdaptivePreviewEnabled(on)
  };

  (window as unknown as { __previewSchedulerDebug: PreviewSchedulerDebugApi }).__previewSchedulerDebug = api;
}

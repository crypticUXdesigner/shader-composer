/**
 * CompilationManager - Compilation Coordination
 * 
 * Coordinates compilation triggers, manages shader instance lifecycle,
 * handles parameter updates (recompile vs uniform-only), and debouncing.
 * Implements the CompilationManager class from Runtime Integration Specification.
 */

import { ShaderInstance, SHADER_INSTANCE_PROGRAM_PENDING_MESSAGE } from './ShaderInstance';
import type {
  PreviewProgramInstance,
  ShaderCompiler,
  CompilationResult,
  PreviewDependencyMask,
  RenderBackendKind
} from './types';
import type { NodeGraph, ParameterValue } from '../data-model/types';
import type { AudioSetup } from '../data-model/audioSetupTypes';
import { hashGraph } from './utils';
import type { ErrorHandler } from '../utils/errorHandling';
import { globalErrorHandler, ErrorUtils } from '../utils/errorHandling';
import type { Disposable } from '../utils/Disposable';
import { GraphChangeDetector } from '../utils/changeDetection/GraphChangeDetector';
import { isRuntimeOnlyParameter } from '../utils/runtimeOnlyParams';
import {
  applyUniformDefaults as applyUniformDefaultsImpl,
  transferParameters as transferParametersImpl,
  transferParametersFromGraph as transferParametersFromGraphImpl
} from './compilation/parameterTransfer';
import { reportCompilationErrors, reportCompilationError } from './compilation/compilationErrorReporting';
import { cloneableCompilePayload, type WorkerCompilePayload, type WorkerReplyMessage } from './compilation/workerMessages';
import {
  previewPerformanceMark,
  PreviewPerfMark,
  previewPerfCounters
} from './previewPerformanceMarks';
import { getPreviewScheduler } from './PreviewScheduler';
import {
  beginPreviewCompileProgressToast,
  clearPreviewCompileProgressToast,
  shouldDeferPreviewCompileToast,
} from '../lib/stores/previewCompileStatusStore';
import type { IRenderBackend } from './renderBackends/IRenderBackend';

/** Debounce for {@link CompilationManager.onGraphStructureChange} when `immediate === true` (wiring, automation region times). */
const CONNECTION_STRUCTURE_COMPILE_DEBOUNCE_MS = 80;

/** Change snapshot from {@link CompilationManager.detectGraphChanges} for one compile kick. */
type GraphCompileChanges = {
  addedNodes: string[];
  removedNodes: string[];
  changedConnections: boolean;
  addedConnectionIds: string[];
  removedConnectionIds: string[];
  changedNodeIds: Set<string>;
  affectedNodeIds: Set<string>;
};

/**
 * WebGPU MVP unsupported reasons tied to the Output node (`final-output`) contract.
 * When the last compile failed for one of these, {@link CompilationManager.shouldSkipPreviewRecompileForIdleGraphChanges}
 * must not treat connection edits on “orphan” branches as idle: those endpoints are often outside the upstream
 * slice of an unwired Output, so skipping would freeze the same user-facing error while the user wires step-by-step
 * (e.g. Look-at Camera → Raymarch before the branch reaches Output).
 */
const WEBGPU_FINAL_OUTPUT_GATE_UNSUPPORTED = new Set<string>(['missing final-output node']);

/** True if value can be applied to a single uniform (float/int or vec4). */
function isUniformValue(v: ParameterValue): v is number | [number, number, number, number] {
  if (typeof v === 'number') return true;
  if (Array.isArray(v) && v.length === 4 && v.every(x => typeof x === 'number')) return true;
  return false;
}

export class CompilationManager implements Disposable {
  private shaderInstance: PreviewProgramInstance | null = null;
  private compiler: ShaderCompiler;
  private renderer: IRenderBackend;
  private graph: NodeGraph | null = null;
  private audioSetup: AudioSetup | null = null;
  private compileIdleCallback: number | null = null;
  
  // Debounce compilation
  private compileTimeout: number | null = null;
  private immediateCompileScheduled: boolean = false;
  private pendingKickRaf1: number | null = null;
  private pendingKickRaf2: number | null = null;
  private readonly COMPILE_DEBOUNCE_MS = 100;
  
  // Track if graph structure changed
  private lastGraphHash: string = '';
  
  // Track previous graph for change detection (incremental compilation)
  private previousGraph: NodeGraph | null = null;
  
  // Track previous graph state metadata for incremental compilation
  private previousGraphState: {
    nodeIds: Set<string>;
    connectionIds: Set<string>;
    executionOrder: string[];
  } | null = null;
  
  // Store compilation metadata for incremental compilation
  private compilationMetadata: {
    result: CompilationResult;
    executionOrder: string[];
  } | null = null;
  
  // Error handling - single interface (ErrorHandler); fallback to global when not injected
  private errorHandler?: ErrorHandler;

  /** Called after successful recompile so runtime can mark dirty and sync time on next frame. */
  private onRecompiled?: () => void;

  /** Called with the new program instance before its first render so runtime can push audio uniforms. */
  private onBeforeFirstRender?: (instance: PreviewProgramInstance) => void;

  // Worker compilation (optional)
  private worker: Worker | null = null;
  private workerCompileId: number = 0;
  /** When set, a worker `result` is scheduled to apply on the next frame (keeps `onmessage` short for responsiveness). */
  private pendingWorkerApplyRafId: number | null = null;
  private pendingApplyRetryRafId: number | null = null;
  private pendingApplyRetryResult: CompilationResult | null = null;
  private pendingApplyRetryWorkerId: number | null = null;

  /** Backend requested for the most recent compile kick (Task 04 coverage fallback). */
  private lastRequestedBackend: RenderBackendKind = 'webgl';

  /**
   * `unsupportedReasons` captured from the last WebGPU compile that fell back to WebGL.
   * Surfaced through `PreviewScheduler.setEffectiveBackend(..., details)` so the dev
   * overlay shows *why* a graph (e.g. fractal presets using `generic-raymarcher`) renders
   * via the WebGL fallback path. Cleared whenever a WebGPU compile succeeds or the
   * requested backend is WebGL.
   */
  private lastWebgpuFallbackReasons: string[] | null = null;

  /**
   * Last error-handler info notice emitted for a WebGPU→WebGL fallback. Used to
   * suppress repeated notices on every recompile of the same graph snapshot — only
   * a fresh fallback (different reasons or recovery in between) re-emits.
   */
  private lastNotifiedFallbackKey: string | null = null;

  /** After a WebGL fallback toast, the next successful WebGPU preview shows a short recovery notice. */
  private webglFallbackToastShown: boolean = false;

  // Parameter update batching
  private parameterRenderScheduled: boolean = false;

  /** Snapshot from last successful compile; not inferred per frame from the graph. */
  private previewDependencyMask: PreviewDependencyMask | null = null;

  constructor(
    compiler: ShaderCompiler,
    renderer: IRenderBackend,
    errorHandler?: ErrorHandler
  ) {
    this.compiler = compiler;
    this.renderer = renderer;
    this.errorHandler = errorHandler;
  }

  /** Resolve the active error handler (injected or global). */
  private getErrorHandler(): ErrorHandler {
    return this.errorHandler ?? globalErrorHandler;
  }

  /**
   * Surface a single, non-alarming `info` notice the first time WebGPU compilation falls
   * back to WebGL for a given set of reasons. Subsequent recompiles of the same graph
   * snapshot are deduplicated via `lastNotifiedFallbackKey` to avoid toast spam — only a
   * fresh fallback (different reasons) re-emits.
   *
   * Treated as informational because the runtime continues to render correctly via the
   * existing WebGL path; the message exists so developers / advanced users can see *why*
   * a graph (e.g. fractal presets that need `generic-raymarcher` in WGSL) is not on the
   * WebGPU pipeline yet.
   */
  private notifyWebgpuFallback(reasons: string[] | null): void {
    if (!reasons || reasons.length === 0) return;
    const key = reasons.slice().sort().join('|');
    if (this.lastNotifiedFallbackKey === key) return;
    this.lastNotifiedFallbackKey = key;
    this.webglFallbackToastShown = true;
    this.getErrorHandler().report('runtime', 'info', 'Switching to WebGL fallback...', reasons);
  }

  /**
   * True when the worker/WebGPU compile attempt should not drive preview (recompile WebGL).
   * WebGL `CompilationResult`s from an explicit fallback compile must return false so we do not loop.
   */
  private webGpuCompileUnusable(result: CompilationResult): boolean {
    if (result.backend === 'webgl') {
      return false;
    }
    return (
      result.metadata.errors.length > 0 ||
      result.backend !== 'webgpu' ||
      result.supported !== true
    );
  }

  /**
   * Reasons for dev overlay / deduped info toast when falling back WebGPU → WebGL.
   * Includes unsupportedReasons, compiler error strings, and structural signals.
   */
  private captureWebgpuFallbackReasons(result: CompilationResult): string[] {
    const parts: string[] = [];
    if (result.unsupportedReasons && result.unsupportedReasons.length > 0) {
      parts.push(...result.unsupportedReasons);
    }
    for (const err of result.metadata.errors) {
      parts.push(`compile.error:${err}`);
    }
    if (!result.supported && !(result.unsupportedReasons && result.unsupportedReasons.length > 0)) {
      parts.push('compile.supported:false');
    }
    const seen = new Set<string>();
    const deduped = parts.filter((p) => (!seen.has(p) ? (seen.add(p), true) : false));
    return deduped.length > 0 ? deduped : ['webgpu.compile.unusable'];
  }
  
  /**
   * Set the node graph.
   */
  setGraph(graph: NodeGraph): void {
    this.graph = graph;
  }

  /**
   * Set callback invoked after a successful recompile (e.g. so runtime marks dirty and syncs time).
   */
  setOnRecompiled(callback: () => void): void {
    this.onRecompiled = callback;
  }

  /**
   * Set callback invoked with the new shader instance before its first render (e.g. to push audio uniforms).
   */
  setOnBeforeFirstRender(callback: (instance: PreviewProgramInstance) => void): void {
    this.onBeforeFirstRender = callback;
  }

  /**
   * Set the compilation worker. When non-null, recompile posts to the worker and applies results on message.
   * When null, compilation runs on the main thread as before.
   */
  setWorker(worker: Worker | null): void {
    this.clearPendingWorkerApplyRaf();
    this.clearPendingApplyRetryRaf();
    if (this.worker !== null) {
      this.worker.onmessage = null;
    }
    this.worker = worker;
    if (worker !== null) {
      worker.onmessage = (ev: MessageEvent<WorkerReplyMessage>) => this.handleWorkerMessage(ev);
    }
  }

  /**
   * Handle messages from the compilation worker. Ignores result/error replies whose id does not match workerCompileId.
   * Successful `result` messages defer `applyCompilationResult` to the next animation frame so the worker `message`
   * handler returns quickly (avoids long main-thread blocking inside `onmessage`; WebGL link still runs next frame).
   */
  private handleWorkerMessage(ev: MessageEvent<WorkerReplyMessage>): void {
    const data = ev.data;
    if (data.type === 'inited') return;
    if (data.type === 'result' || data.type === 'error') {
      if (data.id !== this.workerCompileId) return;
    }

    if (data.type === 'result') {
      const result = data.result;
      const id = data.id;
      this.clearPendingWorkerApplyRaf();
      this.clearPendingApplyRetryRaf();
      this.pendingWorkerApplyRafId = requestAnimationFrame(() => {
        this.pendingWorkerApplyRafId = null;
        if (id !== this.workerCompileId) return;
        // Task 04/11: WebGPU → WebGL fallback when WGSL output is unusable: unsupported coverage,
        // compile errors in metadata, or inconsistent backend/support flags.
        if (
          this.worker !== null &&
          this.graph !== null &&
          this.lastRequestedBackend === 'webgpu' &&
          this.webGpuCompileUnusable(result)
        ) {
          this.lastWebgpuFallbackReasons = this.captureWebgpuFallbackReasons(result);
          this.notifyWebgpuFallback(this.lastWebgpuFallbackReasons);

          this.workerCompileId += 1;
          const payload: WorkerCompilePayload = {
            type: 'compile',
            id: this.workerCompileId,
            targetBackend: 'webgl',
            graph: this.graph,
            audioSetup: this.audioSetup,
            previousResult: null,
            affectedNodeIds: [],
            tryIncremental: false,
          };
          this.worker.postMessage(cloneableCompilePayload(payload));
          return;
        }
        if (result.metadata.errors.length > 0) {
          getPreviewScheduler().recordCompileFailed();
          reportCompilationErrors(result.metadata.errors, (err) => this.getErrorHandler().reportError(err));
          return;
        }
        try {
          this.applyCompilationResult(result);
        } catch (err) {
          const e = err instanceof Error ? err : new Error(String(err));
          if (e.message === SHADER_INSTANCE_PROGRAM_PENDING_MESSAGE) {
            this.scheduleApplyRetry(result, id);
            return;
          }
          getPreviewScheduler().recordCompileFailed();
          this.getErrorHandler().reportError(
            ErrorUtils.compilationError(e.message, undefined, { originalError: e })
          );
        }
      });
      return;
    }
    if (data.type === 'error') {
      getPreviewScheduler().recordCompileFailed();
      this.getErrorHandler().reportError(
        ErrorUtils.compilationError(data.message)
      );
    }
  }

  private clearPendingWorkerApplyRaf(): void {
    if (this.pendingWorkerApplyRafId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.pendingWorkerApplyRafId);
    }
    this.pendingWorkerApplyRafId = null;
  }

  private clearPendingApplyRetryRaf(): void {
    if (this.pendingApplyRetryRafId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.pendingApplyRetryRafId);
    }
    this.pendingApplyRetryRafId = null;
    this.pendingApplyRetryResult = null;
    this.pendingApplyRetryWorkerId = null;
  }

  private scheduleApplyRetry(result: CompilationResult, workerId: number | null): void {
    this.pendingApplyRetryResult = result;
    this.pendingApplyRetryWorkerId = workerId;
    if (this.pendingApplyRetryRafId !== null) return;
    this.pendingApplyRetryRafId = requestAnimationFrame(() => {
      this.pendingApplyRetryRafId = null;
      const r = this.pendingApplyRetryResult;
      const id = this.pendingApplyRetryWorkerId;
      this.pendingApplyRetryResult = null;
      this.pendingApplyRetryWorkerId = null;
      if (!r) return;
      if (id !== null && id !== this.workerCompileId) return;
      try {
        this.applyCompilationResult(r);
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.message === SHADER_INSTANCE_PROGRAM_PENDING_MESSAGE) {
          this.scheduleApplyRetry(r, id);
          return;
        }
        getPreviewScheduler().recordCompileFailed();
        this.getErrorHandler().reportError(
          ErrorUtils.compilationError(e.message, undefined, { originalError: e })
        );
      }
    });
  }

  /**
   * Set audio setup from panel (for uniform generation from audio-derived signals).
   */
  setAudioSetup(audioSetup: AudioSetup | null): void {
    this.audioSetup = audioSetup ?? null;
  }

  /**
   * Recompile after WebGL context restore. The previous ShaderInstance is invalid;
   * clear it and recompile so the new context gets a new instance.
   * When a worker is set, bypasses worker and compiles on main thread.
   */
  recompileAfterContextRestore(): void {
    this.shaderInstance = null;
    if (this.worker !== null) {
      if (!this.graph) return;
      const gl = this.renderer.getGLContext();
      if (gl.isContextLost && gl.isContextLost()) return;
      try {
        previewPerformanceMark(PreviewPerfMark.compileRequested);
        previewPerfCounters.compileRequests += 1;
        getPreviewScheduler().recordCompileStarted();
        const result = this.compiler.compile(this.graph, this.audioSetup);
        if (result.metadata.errors.length > 0) {
          getPreviewScheduler().recordCompileFailed();
          reportCompilationErrors(result.metadata.errors, (err) => this.getErrorHandler().reportError(err));
          return;
        }
        if (gl.isContextLost && gl.isContextLost()) return;
        this.applyCompilationResult(result);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        if (err.message === ShaderInstance.CONTEXT_LOST_MESSAGE) return;
        getPreviewScheduler().recordCompileFailed();
        reportCompilationError(err, (e) => this.getErrorHandler().reportError(e));
      }
    } else {
      this.recompile();
    }
  }

  /**
   * Clear shader instance when WebGL context is lost (do not use or destroy the old instance).
   * Prevents any code path from holding or using the invalid instance until context is restored.
   */
  clearShaderInstanceForContextLoss(): void {
    this.shaderInstance = null;
    this.previewDependencyMask = null;
  }

  /**
   * Handle parameter change.
   * Determines if recompilation is needed or just uniform update.
   * Supports full ParameterValue: number and vec4 trigger uniform update when no recompile is needed;
   * string, number[], number[][] trigger recompile. See docs/architecture/parameters-pipeline.md.
   */
  onParameterChange(nodeId: string, paramName: string, value: ParameterValue): void {
    if (!this.graph) return;

    const node = this.graph.nodes.find(n => n.id === nodeId);
    if (node && isRuntimeOnlyParameter(node.type, paramName)) {
      return;
    }

    const outputNodeId = this.compilationMetadata?.result.metadata.finalOutputNodeId ?? null;
    if (
      this.shaderInstance &&
      outputNodeId &&
      !this.computeUpstreamReachableNodeIds(this.graph, outputNodeId).has(nodeId)
    ) {
      return;
    }

    const graphHash = hashGraph(this.graph);
    const needsRecompile = graphHash !== this.lastGraphHash;

    if (needsRecompile) {
      this.scheduleRecompile();
    } else if (isUniformValue(value)) {
      this.scheduleParameterUpdate(nodeId, paramName, value);
    } else {
      // string, number[], number[][] - affect code gen or multi-slot config
      this.scheduleRecompile();
    }
  }
  
  /**
   * Handle graph structure change (node added/removed, connection added/removed).
   * @param immediate - If true, schedule `recompile()` after a short debounce (**~80 ms**) so bursts coalesce (wiring, automation region times).
   */
  onGraphStructureChange(immediate: boolean = false): void {
    if (immediate) {
      this.cancelPendingRecompile();
      // Defer to next tick so we don't block the connection handler; coalesce bursts into one compile.
      if (this.immediateCompileScheduled) return;
      this.immediateCompileScheduled = true;
      this.compileTimeout = window.setTimeout(() => {
        this.immediateCompileScheduled = false;
        this.compileTimeout = null;
        this.recompile();
      }, CONNECTION_STRUCTURE_COMPILE_DEBOUNCE_MS);
    } else {
      this.scheduleRecompile();
    }
  }

  /**
   * Cancel any pending recompilation (used before immediate recompile).
   * Incrementing workerCompileId causes in-flight worker replies to be ignored.
   */
  private cancelPendingRecompile(): void {
    this.workerCompileId += 1;
    this.immediateCompileScheduled = false;
    this.clearPendingRecompileKickRafs();
    if (this.compileIdleCallback !== null && typeof window !== 'undefined' && window.cancelIdleCallback) {
      window.cancelIdleCallback(this.compileIdleCallback);
      this.compileIdleCallback = null;
    }
    if (this.compileTimeout) {
      clearTimeout(this.compileTimeout);
      this.compileTimeout = null;
    }
  }

  private clearPendingRecompileKickRafs(): void {
    if (this.pendingKickRaf1 !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.pendingKickRaf1);
    }
    if (this.pendingKickRaf2 !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.pendingKickRaf2);
    }
    this.pendingKickRaf1 = null;
    this.pendingKickRaf2 = null;
  }
  
  /**
   * Schedule parameter update for next frame (batching).
   * Updates uniforms immediately (cheap operation) but defers rendering.
   */
  private scheduleParameterUpdate(
    nodeId: string,
    paramName: string,
    value: number | [number, number, number, number]
  ): void {
    if (!this.graph || !this.shaderInstance) return;
    
    // Update uniform immediately (cheap operation, doesn't block)
    // Check if parameter is connected to an output
    const isConnected = this.graph.connections.some(
      conn => conn.targetNodeId === nodeId && conn.targetParameter === paramName
    );
    
    if (isConnected) {
      // Parameter has input connection - check the input mode
      const node = this.graph.nodes.find(n => n.id === nodeId);
      if (node) {
        // Get the input mode from node override (if explicitly set)
        const inputMode = node.parameterInputModes?.[paramName];
        
        // If mode is explicitly set to 'override', the input completely replaces the config value,
        // so the uniform is not used and we can skip updating it.
        // But if mode is 'add', 'subtract', 'multiply', or undefined (might default to something other than override),
        // the uniform IS used in the combination expression, so we MUST update it.
        // To be safe and ensure correctness, we'll update the uniform unless mode is explicitly 'override'.
        if (inputMode !== 'override') {
          // Mode is add/subtract/multiply or undefined - uniform is used in combination, so update it
          this.shaderInstance.setParameter(nodeId, paramName, value);
        }
        // If mode is explicitly 'override', skip uniform update (input completely replaces config)
      }
    } else {
      // No input connection - just update uniform
      this.shaderInstance.setParameter(nodeId, paramName, value);
    }
    
    // Mark renderer as dirty
    this.renderer.markDirty('parameter');
    
    // Schedule render for next frame (if not already scheduled)
    if (!this.parameterRenderScheduled) {
      this.parameterRenderScheduled = true;
      requestAnimationFrame(() => {
        this.flushParameterRender();
      });
    }
  }
  
  /**
   * Flush pending parameter render (called on next animation frame).
   */
  private flushParameterRender(): void {
    this.parameterRenderScheduled = false;
    
    // All uniforms were already updated in scheduleParameterUpdate()
    // Just need to render once per frame
    this.renderer.render();
  }
  
  /**
   * Schedule recompilation (with debouncing).
   */
  private scheduleRecompile(): void {
    this.cancelPendingRecompile();

    if (window.requestIdleCallback) {
      this.compileIdleCallback = window.requestIdleCallback(
        () => {
          this.recompile();
          this.compileIdleCallback = null;
        },
        { timeout: this.COMPILE_DEBOUNCE_MS }
      );
    } else {
      this.compileTimeout = window.setTimeout(() => {
        this.compileTimeout = null;
        this.recompile();
      }, this.COMPILE_DEBOUNCE_MS);
    }
  }
  
  /**
   * Apply a compilation result on the main thread: create ShaderInstance, transfer params/time, update state, render.
   * Used by both main-thread compile path and worker result handler. Run inside try/catch at call site; reports errors via getErrorHandler().
   */
  private applyCompilationResult(result: CompilationResult): void {
    const prevInstance = this.shaderInstance;

    // Task 03: allow WebGPU backend to consume WGSL compilation results.
    // Important: do not route WebGL fallback results through the WebGPU install hook.
    if (
      result.backend === 'webgpu' &&
      this.renderer.selection.selected === 'webgpu' &&
      typeof this.renderer.setWebGpuProgram === 'function'
    ) {
      const maybe = this.renderer.setWebGpuProgram(result);
      // If we requested/received a WebGPU compilation result but the backend isn't ready to install a program yet,
      // do NOT fall back to the legacy WebGL path with an incompatible (WGSL/empty) `CompilationResult`.
      // Instead, signal "program pending" so the existing retry mechanism can re-apply shortly.
      if (!maybe && result.backend === 'webgpu') {
        throw new Error(SHADER_INSTANCE_PROGRAM_PENDING_MESSAGE);
      }
      if (maybe) {
        // WebGPU compile succeeded — clear the cached fallback reasons so the next graph
        // edit doesn't reuse stale `unsupportedReasons` from an earlier failed attempt.
        this.lastWebgpuFallbackReasons = null;
        this.lastNotifiedFallbackKey = null;
        if (this.webglFallbackToastShown) {
          this.webglFallbackToastShown = false;
          this.getErrorHandler().report('runtime', 'info', 'Using WebGPU...');
        }
        getPreviewScheduler().setEffectiveBackend('webgpu', 'compile.webgpu');
        try {
          if (prevInstance) {
            if (this.graph) {
              applyUniformDefaultsImpl(result.uniforms, maybe);
              transferParametersImpl(this.graph, prevInstance, maybe);
              transferParametersFromGraphImpl(this.graph, maybe);
            }
            maybe.setTimelineTime(prevInstance.getTimelineTime());
            maybe.setTime(prevInstance.getTime());
          } else if (this.graph) {
            applyUniformDefaultsImpl(result.uniforms, maybe);
            transferParametersFromGraphImpl(this.graph, maybe);
          }

          this.onBeforeFirstRender?.(maybe);

          this.shaderInstance = maybe;

          this.previewDependencyMask = result.metadata.previewDependencies ?? null;
          this.compilationMetadata = {
            result,
            executionOrder: result.metadata.executionOrder
          };

          if (this.previousGraphState) {
            this.previousGraphState.executionOrder = result.metadata.executionOrder;
          }

          if (this.graph) {
            this.lastGraphHash = hashGraph(this.graph);
          }

          this.renderer.markDirty('compilation');
          this.renderer.render();

          prevInstance?.destroy();

          this.onRecompiled?.();
          getPreviewScheduler().recordCompileSucceeded();
          return;
        } catch (e) {
          if (e instanceof Error && e.message === SHADER_INSTANCE_PROGRAM_PENDING_MESSAGE) {
            // Preserve program pending semantics for the caller (recompileExecute will schedule retry).
            throw e;
          }
          // If WebGPU apply fails, fall back to legacy WebGL path below.
          try {
            maybe.destroy();
          } catch {
            // ignore cleanup errors
          }
          this.shaderInstance = prevInstance;
        }
      }
    }

    // Coverage fallback visibility: when WebGPU was requested but we apply a WebGL program,
    // record the effective backend so the dev overlay is not misleading. The
    // `unsupportedReasons` were captured during the WebGPU result above (see worker handler);
    // forward them here so the overlay/effectiveBackend snapshot includes the cause.
    if (this.lastRequestedBackend === 'webgpu' && result.backend === 'webgl') {
      getPreviewScheduler().setEffectiveBackend(
        'webgl2',
        'fallback.webgl2.wgsl.unsupported',
        this.lastWebgpuFallbackReasons ?? undefined
      );
    } else {
      getPreviewScheduler().setEffectiveBackend('webgl2', 'compile.webgl');
      this.lastWebgpuFallbackReasons = null;
      this.lastNotifiedFallbackKey = null;
    }

    // Legacy WebGL path (unchanged)
    const gl = this.renderer.getGLContext();
    if (gl.isContextLost && gl.isContextLost()) {
      clearPreviewCompileProgressToast();
      return;
    }

    const newInstance = new ShaderInstance(gl, result, { linkCompletionMode: 'deferPending' });

    try {
      if (prevInstance) {
        if (this.graph) {
          applyUniformDefaultsImpl(result.uniforms, newInstance);
          transferParametersImpl(this.graph, prevInstance, newInstance);
          transferParametersFromGraphImpl(this.graph, newInstance);
        }
        newInstance.setTimelineTime(prevInstance.getTimelineTime());
        newInstance.setTime(prevInstance.getTime());
      } else if (this.graph) {
        applyUniformDefaultsImpl(result.uniforms, newInstance);
        transferParametersFromGraphImpl(this.graph, newInstance);
      }

      this.onBeforeFirstRender?.(newInstance);

      // Swap renderer to the new instance; keep old instance alive until after first successful render.
      this.shaderInstance = newInstance;
      this.renderer.setShaderInstance(newInstance);

      this.previewDependencyMask = result.metadata.previewDependencies ?? null;

      this.compilationMetadata = {
        result,
        executionOrder: result.metadata.executionOrder
      };

      if (this.previousGraphState) {
        this.previousGraphState.executionOrder = result.metadata.executionOrder;
      }

      if (this.graph) {
        this.lastGraphHash = hashGraph(this.graph);
      }

      this.renderer.markDirty('compilation');
      this.renderer.render();

      // First render succeeded; now it is safe to release the previous instance.
      prevInstance?.destroy();

      this.onRecompiled?.();
      getPreviewScheduler().recordCompileSucceeded();
    } catch (err) {
      // Roll back to last-good instance if swap/render failed.
      try {
        newInstance.destroy();
      } catch {
        // ignore cleanup errors
      }
      this.shaderInstance = prevInstance;
      if (prevInstance) {
        if (prevInstance instanceof ShaderInstance) {
          this.renderer.setShaderInstance(prevInstance);
        }
      }
      throw err;
    }
  }

  /**
   * Recompile shader from graph.
   * When a worker is set, posts a compile request and returns; result is applied in worker onmessage.
   * Otherwise uses incremental compilation when possible on the main thread.
   *
   * After at least one successful compile, **adding or removing nodes** shows an indeterminate
   * preview toast and defers the heavy compile kick by two animation frames so the shell can paint
   * the toast before `postMessage` / main-thread compile runs.
   */
  private recompile(): void {
    if (!this.graph) return;

    const gl = this.renderer.getGLContext();
    if (gl.isContextLost && gl.isContextLost()) {
      return;
    }

    // If a previous compile kick was deferred by rAF, supersede it with this newer request.
    this.clearPendingRecompileKickRafs();

    const priorGraph = this.previousGraph;
    const changes = this.detectGraphChanges(this.graph);
    const previousResult = this.compilationMetadata?.result ?? null;

    if (this.shouldSkipPreviewRecompileForIdleGraphChanges(this.graph, priorGraph, changes, previousResult)) {
      // Graph changed, but not in the dependency slice that feeds the preview output.
      // Keep the current ShaderInstance; update hash so parameter changes don't trigger recompiles forever.
      this.lastGraphHash = hashGraph(this.graph);
      clearPreviewCompileProgressToast();
      return;
    }
    const tryIncremental =
      previousResult !== null &&
      changes.removedNodes.length === 0 &&
      changes.removedConnectionIds.length === 0 &&
      changes.affectedNodeIds.size < this.graph.nodes.length * 0.5;

    const deferPreviewToast = shouldDeferPreviewCompileToast(previousResult, changes);

    if (deferPreviewToast) {
      beginPreviewCompileProgressToast();
    }

    const kick = (): void => {
      const connectionOnlyCompile =
        changes.changedConnections &&
        changes.addedNodes.length === 0 &&
        changes.removedNodes.length === 0;

      if (!deferPreviewToast) {
        if (connectionOnlyCompile) {
          beginPreviewCompileProgressToast();
        } else {
          clearPreviewCompileProgressToast();
        }
      }

      previewPerformanceMark(PreviewPerfMark.compileRequested);
      previewPerfCounters.compileRequests += 1;
      getPreviewScheduler().recordCompileStarted();
      this.recompileExecute(changes, tryIncremental, previousResult);
    };

    if (deferPreviewToast) {
      this.pendingKickRaf1 = requestAnimationFrame(() => {
        this.pendingKickRaf1 = null;
        this.pendingKickRaf2 = requestAnimationFrame(() => {
          this.pendingKickRaf2 = null;
          kick();
        });
      });
    } else {
      kick();
    }
  }

  private shouldSkipPreviewRecompileForIdleGraphChanges(
    graph: NodeGraph,
    priorGraph: NodeGraph | null,
    changes: GraphCompileChanges,
    previousResult: CompilationResult | null
  ): boolean {
    // Safe default: if we don't know what output we are targeting, always compile.
    const outputNodeId = previousResult?.metadata.finalOutputNodeId ?? null;
    if (!outputNodeId) return false;

    if (!graph.nodes.some((n) => n.id === outputNodeId)) return false;

    // If output node was removed or changed, we must recompile.
    if (changes.removedNodes.includes(outputNodeId) || changes.changedNodeIds.has(outputNodeId)) return false;

    const reachableNew = this.computeUpstreamReachableNodeIds(graph, outputNodeId);
    const reachableOld =
      priorGraph !== null ? this.computeUpstreamReachableNodeIds(priorGraph, outputNodeId) : new Set<string>();

    const unionReach = new Set<string>(reachableNew);
    for (const id of reachableOld) {
      unionReach.add(id);
    }

    const connectionDelta =
      changes.changedConnections &&
      (changes.addedConnectionIds.length > 0 || changes.removedConnectionIds.length > 0);

    if (connectionDelta) {
      if (!priorGraph) return false;
      if (this.webGpuFailedOnFinalOutputGate(previousResult)) return false;
      const touched = new Set<string>();
      for (const id of this.collectConnectionEndpointNodeIds(graph, changes.addedConnectionIds)) {
        touched.add(id);
      }
      for (const id of this.collectConnectionEndpointNodeIds(priorGraph, changes.removedConnectionIds)) {
        touched.add(id);
      }
      for (const id of touched) {
        if (unionReach.has(id)) return false;
      }
    } else if (changes.changedConnections) {
      // Connections flagged changed but we could not classify ids — compile.
      return false;
    }

    for (const id of changes.removedNodes) {
      if (reachableOld.has(id)) return false;
    }

    for (const id of changes.changedNodeIds) {
      if (reachableNew.has(id)) return false;
    }

    // Purely idle structural edits: no impact on preview output.
    return true;
  }

  private webGpuFailedOnFinalOutputGate(result: CompilationResult | null): boolean {
    if (!result || result.backend !== 'webgpu' || result.supported !== false) return false;
    const reasons = result.unsupportedReasons;
    if (!reasons || reasons.length === 0) return false;
    return reasons.some((r) => WEBGPU_FINAL_OUTPUT_GATE_UNSUPPORTED.has(r));
  }

  /** Endpoints (source + target node ids) for the given connection ids in `graph`. */
  private collectConnectionEndpointNodeIds(graph: NodeGraph, connectionIds: string[]): string[] {
    if (connectionIds.length === 0) return [];
    const byId = new Map(graph.connections.map((c) => [c.id, c]));
    const out: string[] = [];
    for (const id of connectionIds) {
      const c = byId.get(id);
      if (!c) continue;
      out.push(c.sourceNodeId, c.targetNodeId);
    }
    return out;
  }

  /**
   * Returns the set of node ids that can affect the output node (inclusive).
   * Traverses connections backwards: output target -> upstream sources.
   */
  private computeUpstreamReachableNodeIds(graph: NodeGraph, outputNodeId: string): Set<string> {
    const upstreamByTarget = new Map<string, string[]>();
    for (const c of graph.connections) {
      const list = upstreamByTarget.get(c.targetNodeId);
      if (list) list.push(c.sourceNodeId);
      else upstreamByTarget.set(c.targetNodeId, [c.sourceNodeId]);
    }

    const reachable = new Set<string>();
    const stack: string[] = [outputNodeId];
    while (stack.length > 0) {
      const id = stack.pop() as string;
      if (reachable.has(id)) continue;
      reachable.add(id);
      const ups = upstreamByTarget.get(id);
      if (!ups) continue;
      for (const srcId of ups) {
        // Connections may refer to virtual sources (e.g. audio-signal:*) that aren't in graph.nodes.
        // Include the id for set membership checks; traversal ends naturally if it has no incoming edges.
        stack.push(srcId);
      }
    }
    return reachable;
  }

  /** Worker post or main-thread compile + apply (after {@link #recompile} has run change detection). */
  private recompileExecute(
    changes: GraphCompileChanges,
    tryIncremental: boolean,
    previousResult: CompilationResult | null
  ): void {
    if (!this.graph) return;

    const gl = this.renderer.getGLContext();
    if (gl.isContextLost && gl.isContextLost()) {
      clearPreviewCompileProgressToast();
      return;
    }

    const targetBackend: RenderBackendKind = this.renderer.selection.selected === 'webgpu' ? 'webgpu' : 'webgl';
    this.lastRequestedBackend = targetBackend;

    if (this.worker !== null) {
      this.workerCompileId += 1;
      const payload: WorkerCompilePayload = {
        type: 'compile',
        id: this.workerCompileId,
        targetBackend,
        graph: this.graph,
        audioSetup: this.audioSetup,
        previousResult,
        affectedNodeIds: Array.from(changes.affectedNodeIds),
        tryIncremental,
      };
      this.worker.postMessage(cloneableCompilePayload(payload));
      return;
    }

    try {
      let result: CompilationResult;
      if (tryIncremental) {
        const incrementalResult = this.compiler.compileIncremental?.(
          this.graph,
          previousResult,
          changes.affectedNodeIds,
          this.audioSetup,
          { backend: targetBackend }
        );
        if (incrementalResult) {
          result = incrementalResult;
        } else {
          result = this.compiler.compile(this.graph, this.audioSetup, { backend: targetBackend });
        }
      } else {
        result = this.compiler.compile(this.graph, this.audioSetup, { backend: targetBackend });
      }

      // Task 04/11: same-thread WebGPU → WebGL fallback (unsupported, compile errors, etc.).
      if (targetBackend === 'webgpu') {
        if (this.webGpuCompileUnusable(result)) {
          this.lastWebgpuFallbackReasons = this.captureWebgpuFallbackReasons(result);
          this.notifyWebgpuFallback(this.lastWebgpuFallbackReasons);
          const fallback = this.compiler.compile(this.graph, this.audioSetup, { backend: 'webgl' });
          if (fallback.metadata.errors.length > 0) {
            getPreviewScheduler().recordCompileFailed();
            reportCompilationErrors(fallback.metadata.errors, (err) => this.getErrorHandler().reportError(err));
            return;
          }
          result = fallback;
        }
      } else if (result.metadata.errors.length > 0) {
        getPreviewScheduler().recordCompileFailed();
        reportCompilationErrors(result.metadata.errors, (err) => this.getErrorHandler().reportError(err));
        return;
      }

      if (gl.isContextLost && gl.isContextLost()) {
        clearPreviewCompileProgressToast();
        return;
      }

      try {
        this.applyCompilationResult(result);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        if (err.message === SHADER_INSTANCE_PROGRAM_PENDING_MESSAGE) {
          this.scheduleApplyRetry(result, null);
          return;
        }
        throw err;
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (err.message === ShaderInstance.CONTEXT_LOST_MESSAGE) {
        clearPreviewCompileProgressToast();
        return;
      }
      getPreviewScheduler().recordCompileFailed();
      reportCompilationError(err, (e) => this.getErrorHandler().reportError(e));
    }
  }
  
  /**
   * Detect what changed in the graph compared to previous state.
   * Returns information about added/removed nodes and affected nodes.
   * Uses unified change detection system.
   */
  private detectGraphChanges(graph: NodeGraph): GraphCompileChanges {
    // Use unified change detection system
    const changeResult = GraphChangeDetector.detectChanges(
      this.previousGraph,
      graph,
      {
        trackAffectedNodes: true,
        includeConnectionIds: true
      }
    );
    
    // Update previous graph state metadata for incremental compilation
    const currentNodeIds = new Set(graph.nodes.map(n => n.id));
    const currentConnectionIds = new Set(graph.connections.map(c => c.id));
    
    if (!this.previousGraphState) {
      // First compilation - initialize state
      this.previousGraphState = {
        nodeIds: currentNodeIds,
        connectionIds: currentConnectionIds,
        executionOrder: []
      };
    } else {
      // Update previous state
      this.previousGraphState = {
        nodeIds: currentNodeIds,
        connectionIds: currentConnectionIds,
        executionOrder: this.previousGraphState.executionOrder // Preserve execution order
      };
    }
    
    // Update previous graph reference for next comparison
    this.previousGraph = graph;
    
    // Build set of changed node IDs (type or parameters changed, plus added nodes)
    const changedNodeIds = new Set<string>();
    changeResult.changedNodeIds.forEach(id => changedNodeIds.add(id));
    changeResult.addedNodeIds.forEach(id => changedNodeIds.add(id));
    
    return {
      addedNodes: changeResult.addedNodeIds,
      removedNodes: changeResult.removedNodeIds,
      changedConnections: changeResult.isConnectionsChanged,
      addedConnectionIds: changeResult.addedConnectionIds,
      removedConnectionIds: changeResult.removedConnectionIds,
      changedNodeIds,
      affectedNodeIds: changeResult.affectedNodeIds
    };
  }
  
  /**
   * Get current shader instance (for time/resolution updates).
   */
  getShaderInstance(): PreviewProgramInstance | null {
    return this.shaderInstance;
  }

  getPreviewDependencyMask(): PreviewDependencyMask | null {
    return this.previewDependencyMask;
  }
  
  /**
   * Cleanup all resources.
   */
  destroy(): void {
    this.clearPendingWorkerApplyRaf();
    if (this.worker !== null) {
      this.worker.terminate();
      this.worker = null;
    }
    if (this.compileTimeout) {
      clearTimeout(this.compileTimeout);
      this.compileTimeout = null;
    }
    if (this.compileIdleCallback !== null && typeof window !== 'undefined' && window.cancelIdleCallback) {
      window.cancelIdleCallback(this.compileIdleCallback);
      this.compileIdleCallback = null;
    }

    if (this.shaderInstance) {
      this.shaderInstance.destroy();
      this.shaderInstance = null;
    }

    this.graph = null;
    this.compilationMetadata = null;
    this.previousGraphState = null;
    this.previousGraph = null;
    this.previewDependencyMask = null;
    clearPreviewCompileProgressToast();
  }
}
/**
 * CompilationManager - Compilation Coordination
 * 
 * Coordinates compilation triggers, manages shader instance lifecycle,
 * handles parameter updates (recompile vs uniform-only), and debouncing.
 * Implements the CompilationManager class from Runtime Integration Specification.
 */

import { ShaderInstance } from './ShaderInstance';
import { Renderer } from './Renderer';
import type { ShaderCompiler, CompilationResult } from './types';
import type { NodeGraph, ParameterValue } from '../data-model/types';
import type { AudioSetup } from '../data-model/audioSetupTypes';
import { hashGraph } from './utils';
import type { ErrorHandler } from '../utils/errorHandling';
import { globalErrorHandler, ErrorUtils } from '../utils/errorHandling';
import type { Disposable } from '../utils/Disposable';
import { GraphChangeDetector } from '../utils/changeDetection/GraphChangeDetector';
import { isRuntimeOnlyParameter } from '../utils/runtimeOnlyParams';
import { transferParameters as transferParametersImpl, transferParametersFromGraph as transferParametersFromGraphImpl } from './compilation/parameterTransfer';
import { reportCompilationErrors, reportCompilationError } from './compilation/compilationErrorReporting';
import { cloneableCompilePayload, type WorkerCompilePayload, type WorkerReplyMessage } from './compilation/workerMessages';

/** True if value can be applied to a single uniform (float/int or vec4). */
function isUniformValue(v: ParameterValue): v is number | [number, number, number, number] {
  if (typeof v === 'number') return true;
  if (Array.isArray(v) && v.length === 4 && v.every(x => typeof x === 'number')) return true;
  return false;
}

export class CompilationManager implements Disposable {
  private shaderInstance: ShaderInstance | null = null;
  private compiler: ShaderCompiler;
  private renderer: Renderer;
  private graph: NodeGraph | null = null;
  private audioSetup: AudioSetup | null = null;
  private compileIdleCallback: number | null = null;
  
  // Debounce compilation
  private compileTimeout: number | null = null;
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

  /** Called with the new shader instance before its first render so runtime can push audio uniforms. */
  private onBeforeFirstRender?: (instance: ShaderInstance) => void;

  // Worker compilation (optional)
  private worker: Worker | null = null;
  private workerCompileId: number = 0;

  // Parameter update batching
  private parameterRenderScheduled: boolean = false;

  constructor(
    compiler: ShaderCompiler,
    renderer: Renderer,
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
  setOnBeforeFirstRender(callback: (instance: ShaderInstance) => void): void {
    this.onBeforeFirstRender = callback;
  }

  /**
   * Set the compilation worker. When non-null, recompile posts to the worker and applies results on message.
   * When null, compilation runs on the main thread as before.
   */
  setWorker(worker: Worker | null): void {
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
   */
  private handleWorkerMessage(ev: MessageEvent<WorkerReplyMessage>): void {
    const data = ev.data;
    if (data.type === 'inited') return;
    if (data.type === 'result' || data.type === 'error') {
      if (data.id !== this.workerCompileId) return;
    }

    if (data.type === 'result') {
      try {
        this.applyCompilationResult(data.result);
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        this.getErrorHandler().reportError(
          ErrorUtils.compilationError(e.message, undefined, { originalError: e })
        );
      }
      return;
    }
    if (data.type === 'error') {
      this.getErrorHandler().reportError(
        ErrorUtils.compilationError(data.message)
      );
    }
  }

  /**
   * Set audio setup from panel (for uniform generation from bands; WP 09).
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
        const result = this.compiler.compile(this.graph, this.audioSetup);
        if (result.metadata.errors.length > 0) {
          reportCompilationErrors(result.metadata.errors, (err) => this.getErrorHandler().reportError(err));
          return;
        }
        if (gl.isContextLost && gl.isContextLost()) return;
        this.applyCompilationResult(result);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        if (err.message === ShaderInstance.CONTEXT_LOST_MESSAGE) return;
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
  }

  /**
   * Handle parameter change.
   * Determines if recompilation is needed or just uniform update.
   * Supports full ParameterValue: number and vec4 trigger uniform update when no recompile is needed;
   * string, number[], number[][] trigger recompile. See docs/architecture/parameter-change-pipeline.md.
   */
  onParameterChange(nodeId: string, paramName: string, value: ParameterValue): void {
    if (!this.graph) return;

    const node = this.graph.nodes.find(n => n.id === nodeId);
    if (node && isRuntimeOnlyParameter(node.type, paramName)) {
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
   * @param immediate - If true, recompile immediately (e.g. when only connections changed) so parameter connections take effect right away.
   */
  onGraphStructureChange(immediate: boolean = false): void {
    if (immediate) {
      this.cancelPendingRecompile();
      // Defer to next tick so we don't block the connection handler; still much faster than 100ms debounce
      this.compileTimeout = window.setTimeout(() => {
        this.compileTimeout = null;
        this.recompile();
      }, 0);
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
    if (this.compileIdleCallback !== null && typeof window !== 'undefined' && window.cancelIdleCallback) {
      window.cancelIdleCallback(this.compileIdleCallback);
      this.compileIdleCallback = null;
    }
    if (this.compileTimeout) {
      clearTimeout(this.compileTimeout);
      this.compileTimeout = null;
    }
  }
  
  /**
   * Schedule parameter update for next frame (batching).
   * Updates uniforms immediately (cheap operation) but defers rendering.
   */
  private scheduleParameterUpdate(nodeId: string, paramName: string, value: number | [number, number, number, number]): void {
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
    const gl = this.renderer.getGLContext();
    if (gl.isContextLost && gl.isContextLost()) {
      return;
    }

    const newInstance = new ShaderInstance(gl, result);

    if (this.shaderInstance) {
      if (this.graph) {
        transferParametersImpl(this.graph, this.shaderInstance, newInstance);
        transferParametersFromGraphImpl(this.graph, newInstance);
      }
      newInstance.setTimelineTime(this.shaderInstance.getTimelineTime());
      newInstance.setTime(this.shaderInstance.getTime());
      this.shaderInstance.destroy();
    } else if (this.graph) {
      transferParametersFromGraphImpl(this.graph, newInstance);
    }

    this.onBeforeFirstRender?.(newInstance);

    this.shaderInstance = newInstance;
    this.renderer.setShaderInstance(newInstance);

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
    this.onRecompiled?.();
  }

  /**
   * Recompile shader from graph.
   * When a worker is set, posts a compile request and returns; result is applied in worker onmessage.
   * Otherwise uses incremental compilation when possible on the main thread.
   */
  private recompile(): void {
    if (!this.graph) return;

    const gl = this.renderer.getGLContext();
    if (gl.isContextLost && gl.isContextLost()) {
      return;
    }

    const changes = this.detectGraphChanges(this.graph);
    const previousResult = this.compilationMetadata?.result ?? null;
    const tryIncremental =
      !changes.changedConnections &&
      previousResult !== null &&
      changes.affectedNodeIds.size < this.graph.nodes.length * 0.5;

    if (this.worker !== null) {
      this.workerCompileId += 1;
      const payload: WorkerCompilePayload = {
        type: 'compile',
        id: this.workerCompileId,
        graph: this.graph,
        audioSetup: this.audioSetup,
        previousResult,
        affectedNodeIds: Array.from(changes.affectedNodeIds),
        tryIncremental
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
          this.audioSetup
        );
        if (incrementalResult) {
          result = incrementalResult;
        } else {
          result = this.compiler.compile(this.graph, this.audioSetup);
        }
      } else {
        result = this.compiler.compile(this.graph, this.audioSetup);
      }

      if (result.metadata.errors.length > 0) {
        reportCompilationErrors(result.metadata.errors, (err) => this.getErrorHandler().reportError(err));
        return;
      }

      if (gl.isContextLost && gl.isContextLost()) {
        return;
      }

      this.applyCompilationResult(result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (err.message === ShaderInstance.CONTEXT_LOST_MESSAGE) {
        return;
      }
      reportCompilationError(err, (e) => this.getErrorHandler().reportError(e));
    }
  }
  
  /**
   * Detect what changed in the graph compared to previous state.
   * Returns information about added/removed nodes and affected nodes.
   * Uses unified change detection system.
   */
  private detectGraphChanges(graph: NodeGraph): {
    addedNodes: string[];
    removedNodes: string[];
    changedConnections: boolean;
    changedNodeIds: Set<string>;
    affectedNodeIds: Set<string>;
  } {
    // Use unified change detection system
    const changeResult = GraphChangeDetector.detectChanges(
      this.previousGraph,
      graph,
      {
        trackAffectedNodes: true,
        includeConnectionIds: false // We don't need connection IDs for this use case
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
      changedNodeIds,
      affectedNodeIds: changeResult.affectedNodeIds
    };
  }
  
  /**
   * Get current shader instance (for time/resolution updates).
   */
  getShaderInstance(): ShaderInstance | null {
    return this.shaderInstance;
  }
  
  /**
   * Cleanup all resources.
   */
  destroy(): void {
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
  }
}
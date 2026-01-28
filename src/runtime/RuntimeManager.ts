/**
 * Runtime Manager - Public API for UI Integration
 * 
 * Provides a clean interface for UI to interact with shader compilation and rendering.
 * Wraps CompilationManager and Renderer as specified in Runtime Integration Specification.
 */

import { GraphChangeDetector } from '../utils/changeDetection/GraphChangeDetector';
import type { ErrorCallback, IRenderer, IAudioManager, ICompilationManager } from './types';
import type { NodeGraph, NodeInstance, Connection } from '../data-model/types';
import type { ErrorHandler } from '../utils/errorHandling';
import type { Disposable } from '../utils/Disposable';
import { safeDestroy } from '../utils/Disposable';
import { TimeManager } from './runtime/TimeManager';
import { AudioParameterHandler } from './runtime/AudioParameterHandler';

// Global error handler fallback (for backward compatibility)
let globalErrorHandler: ErrorHandler | undefined;
try {
  // Try to import if it exists
  const errorHandling = require('../utils/errorHandling');
  if (errorHandling.globalErrorHandler) {
    globalErrorHandler = errorHandling.globalErrorHandler;
  }
} catch {
  // globalErrorHandler not available
}

export class RuntimeManager implements Disposable {
  private compilationManager: ICompilationManager;
  private renderer: IRenderer;
  private audioManager: IAudioManager;
  private currentGraph: NodeGraph | null = null;
  
  // Extracted components
  private timeManager: TimeManager;
  private audioParameterHandler: AudioParameterHandler;
  
  private errorHandler?: ErrorHandler;
  
  /**
   * Create a RuntimeManager with injected dependencies.
   * @param renderer - Renderer instance
   * @param audioManager - AudioManager instance
   * @param compilationManager - CompilationManager instance
   * @param errorCallback - Optional error callback (deprecated, use errorHandler)
   * @param errorHandler - Optional error handler
   */
  constructor(
    renderer: IRenderer,
    audioManager: IAudioManager,
    compilationManager: ICompilationManager,
    _errorCallback?: ErrorCallback,
    errorHandler?: ErrorHandler
  ) {
    this.errorHandler = errorHandler;
    this.renderer = renderer;
    this.audioManager = audioManager;
    this.compilationManager = compilationManager;
    
    // Create extracted components
    this.timeManager = new TimeManager();
    this.audioParameterHandler = new AudioParameterHandler(audioManager, errorHandler);
    
    // Start periodic cleanup (every 30 seconds)
    this.audioManager.startPeriodicCleanup(() => {
      if (this.currentGraph) {
        this.audioManager.cleanupOrphanedResources(this.currentGraph);
      }
    }, 30000);
  }
  
  /**
   * Check if only node positions changed (not structure, connections, or parameters)
   * Uses unified change detection system.
   */
  private isOnlyPositionChange(oldGraph: NodeGraph | null, newGraph: NodeGraph): boolean {
    return GraphChangeDetector.isOnlyPositionChange(oldGraph, newGraph);
  }

  /**
   * Set the node graph (triggers compilation).
   */
  async setGraph(graph: NodeGraph): Promise<void> {
    // Validate graph
    if (!graph || !graph.nodes) {
      const handler = this.errorHandler || globalErrorHandler;
      if (handler) {
        handler.report(
          'validation',
          'error',
          'Invalid graph provided to setGraph',
          { graphId: graph?.id }
        );
      }
      return;
    }
    
    // With immutable updates, graph is always a new reference when changed.
    // If it's the same reference, it hasn't changed (no-op).
    const oldGraph = this.currentGraph;
    
    // Fast path: same reference means no change
    if (oldGraph === graph) {
      return; // No change, skip processing
    }
    
    // Check if only positions/viewState changed (structure unchanged)
    const onlyPositionsChanged = this.isOnlyPositionChange(oldGraph, graph);
    
    // Always update current graph reference (after checking position changes)
    // This ensures the graph is available even if audio loading fails
    this.currentGraph = graph;
    
    if (!onlyPositionsChanged) {
      // Use change detection to find removed nodes
      const changeResult = GraphChangeDetector.detectChanges(oldGraph, graph, {
        trackAffectedNodes: false,
        includeConnectionIds: false
      });
      
      // Clean up audio nodes that are no longer in the graph
      if (changeResult.removedNodeIds.length > 0) {
        this.audioParameterHandler.cleanupRemovedNodes(changeResult.removedNodeIds);
      }
      
      // Only update compilation manager if structure actually changed
      this.compilationManager.setGraph(graph);
      // When only connections changed (e.g. parameter connection added), compile immediately so the connection takes effect right away
      const connectionsOnly = changeResult.isConnectionsChanged && !changeResult.isStructureChanged;
      this.compilationManager.onGraphStructureChange(connectionsOnly);
      
      // Clean up orphaned resources (safety check)
      this.audioManager.cleanupOrphanedResources(graph);
      
      // Load default audio files first (async) - only if structure changed
      // Note: Errors in audio loading are caught and logged, but don't prevent graph from being set
      try {
        await this.audioParameterHandler.loadDefaultAudioFiles(graph);
      } catch (error) {
        const handler = this.errorHandler || globalErrorHandler;
        if (handler) {
          handler.report(
            'audio',
            'warning',
            'Error loading default audio files (non-fatal)',
            { originalError: error instanceof Error ? error : new Error(String(error)) }
          );
        }
        // Continue - graph is already set, audio loading failure shouldn't break the app
      }
      
      // Then initialize audio analyzers (after audio files are loaded)
      this.audioParameterHandler.initializeAudioAnalyzers(graph);
    }
  }

  
  /**
   * Update a parameter value.
   * Determines if recompilation is needed or just uniform update.
   */
  updateParameter(nodeId: string, paramName: string, value: number | number[][]): void {
    // Handle runtime-only parameters for audio nodes
    if (this.currentGraph) {
      const node = this.currentGraph.nodes.find(n => n.id === nodeId);
      
      // Handle audio-file-input runtime parameters
      if (node && node.type === 'audio-file-input' && paramName === 'autoPlay') {
        // autoPlay is runtime-only, not a shader uniform
        // Update the graph parameter but don't try to set it as a uniform
        if (node) {
          node.parameters[paramName] = value;
        }
        
        // Trigger playback if autoPlay is enabled (handle both int and float)
        const autoPlayValue = typeof value === 'number' ? Math.round(value) : 0;
        if (autoPlayValue === 1) {
          this.audioManager.playAudio(nodeId).catch(_error => {
            // Autoplay blocked is expected - don't report as error
            // This is a browser security feature, not an actual error
          });
        } else {
          // Stop playback if autoPlay is disabled
          this.audioManager.stopAudio(nodeId);
        }
        return;
      }
      
      // Handle audio-analyzer runtime parameters
      if (node && node.type === 'audio-analyzer' && (paramName === 'smoothing' || paramName === 'fftSize' || paramName === 'frequencyBands')) {
        // These are runtime-only, not shader uniforms
        // Update the graph parameter and handle via audio analyzer parameter change handler
        if (node) {
          node.parameters[paramName] = value;
        }
        this.audioParameterHandler.onAudioAnalyzerParameterChange(nodeId, paramName, value, this.currentGraph);
        return;
      }
    }
    
    // For all other parameters, use normal flow
    this.compilationManager.onParameterChange(nodeId, paramName, value);
  }
  
  /**
   * Handle node added (graph structure changed).
   */
  onNodeAdded(_node: NodeInstance): void {
    if (this.currentGraph) {
      // Node should already be in graph (added by UI)
      // Just trigger recompilation
      this.compilationManager.onGraphStructureChange();
    }
  }
  
  /**
   * Handle node removed (graph structure changed).
   */
  onNodeRemoved(nodeId: string): void {
    // Clean up audio resources for deleted node
    this.audioParameterHandler.cleanupRemovedNodes([nodeId]);
    
    if (this.currentGraph) {
      // Trigger recompilation
      this.compilationManager.onGraphStructureChange();
    }
  }
  
  /**
   * Handle connection added (graph structure changed).
   */
  onConnectionAdded(connection: Connection): void {
    if (this.currentGraph) {
      // Connection should already be in graph (added by UI)
      // Just trigger recompilation
      this.compilationManager.onGraphStructureChange();
      
      // If this connects an audio-analyzer to an audio-file-input, initialize analyzer
      const targetNode = this.currentGraph.nodes.find(n => n.id === connection.targetNodeId);
      if (targetNode && targetNode.type === 'audio-analyzer' && connection.targetPort === 'audioFile') {
        this.audioParameterHandler.initializeAudioAnalyzers(this.currentGraph);
      }
    }
  }
  
  /**
   * Handle connection removed (graph structure changed).
   */
  onConnectionRemoved(_connectionId: string): void {
    if (this.currentGraph) {
      // Connection should already be removed from graph (removed by UI)
      // Just trigger recompilation
      this.compilationManager.onGraphStructureChange();
    }
  }
  
  /**
   * Set time uniform.
   */
  setTime(time: number): void {
    const shaderInstance = this.compilationManager.getShaderInstance();
    if (!shaderInstance) return;
    
    // Use TimeManager to handle time updates
    this.timeManager.updateTime(
      time,
      shaderInstance,
      this.renderer,
      (instance) => {
        // Update audio uniforms (they may have changed even if time didn't)
        this.audioParameterHandler.updateAudioUniforms(instance, this.currentGraph);
      }
    );
  }
  
  /**
   * Mark runtime as dirty (something changed that requires render).
   */
  markDirty(reason: string): void {
    this.timeManager.markDirty(this.renderer, reason);
  }
  
  /**
   * Render if dirty.
   */
  renderIfDirty(): void {
    this.timeManager.renderIfDirty(this.renderer);
  }

  /**
   * Handle audio file parameter change
   */
  async onAudioFileParameterChange(nodeId: string, paramName: string, value: any): Promise<void> {
    await this.audioParameterHandler.onAudioFileParameterChange(nodeId, paramName, value, this.currentGraph);
  }

  /**
   * Toggle global audio playback (all audio file inputs)
   */
  toggleGlobalAudioPlayback(): void {
    // Debug: Check graph state
    if (!this.currentGraph) {
      const handler = this.errorHandler || globalErrorHandler;
      if (handler) {
        handler.report('validation', 'warning', 'No current graph set - cannot toggle playback');
      }
      return;
    }
    
    if (!this.currentGraph.nodes || this.currentGraph.nodes.length === 0) {
      const handler = this.errorHandler || globalErrorHandler;
      if (handler) {
        handler.report('validation', 'warning', 'Graph has no nodes - cannot toggle playback');
      }
      return;
    }
    
    // Check if there are any audio file input nodes first
    const audioFileNodes = this.currentGraph.nodes.filter(n => n.type === 'audio-file-input');
    const hasAudioNodes = audioFileNodes.length > 0;
    
    if (!hasAudioNodes) {
      const handler = this.errorHandler || globalErrorHandler;
      if (handler) {
        handler.report(
          'validation',
          'warning',
          `No audio file input nodes in graph - cannot toggle playback`,
          { 
            nodeCount: this.currentGraph.nodes.length,
            nodeTypes: [...new Set(this.currentGraph.nodes.map(n => n.type))].join(', ')
          }
        );
      }
      return;
    }
    
    // Get audio node IDs
    const audioNodeIds = this.currentGraph?.nodes
      .filter(n => n.type === 'audio-file-input')
      .map(n => n.id) || [];
    
    // Check if audio is actually loaded
    const loadedStates = audioNodeIds.map(id => {
      const state = this.audioManager.getAudioNodeState(id);
      return { id, state, hasBuffer: state && state.audioBuffer !== null };
    });
    
    const loadedCount = loadedStates.filter(s => s.hasBuffer).length;
    const globalState = this.audioManager.getGlobalAudioState();
    
    if (!globalState) {
      if (loadedCount === 0) {
        const handler = this.errorHandler || globalErrorHandler;
        if (handler) {
          handler.report(
            'audio',
            'warning',
            `Audio nodes found (${audioNodeIds.length}) but no audio loaded yet. Audio may still be loading, or loading may have failed.`,
            { audioNodeCount: audioNodeIds.length }
          );
        }
      } else {
        // Try to play even if getGlobalAudioState returns null - it might work
        const firstLoadedNode = loadedStates.find(s => s.hasBuffer);
        if (firstLoadedNode) {
          this.audioManager.playAudio(firstLoadedNode.id).catch(error => {
            const handler = this.errorHandler || globalErrorHandler;
            if (handler) {
              handler.report(
                'audio',
                'error',
                `Failed to play audio for node ${firstLoadedNode.id}`,
                {
                  originalError: error instanceof Error ? error : new Error(String(error)),
                  nodeId: firstLoadedNode.id,
                }
              );
            }
          });
        }
      }
      return;
    }
    
    if (globalState.isPlaying) {
      this.audioManager.stopAllAudio();
    } else {
      // Resume from current position
      this.audioManager.playAllAudio(globalState.currentTime).catch(error => {
        const handler = this.errorHandler || globalErrorHandler;
        if (handler) {
          handler.report(
            'audio',
            'error',
            'Failed to play audio',
            { originalError: error instanceof Error ? error : new Error(String(error)) }
          );
        }
      });
    }
  }
  
  /**
   * Seek global audio to a specific time
   */
  seekGlobalAudio(time: number): void {
    this.audioManager.seekAllAudio(time).catch(error => {
      const handler = this.errorHandler || globalErrorHandler;
      if (handler) {
        handler.report(
          'audio',
          'warning',
          'Failed to seek audio',
          { 
            originalError: error instanceof Error ? error : new Error(String(error)),
            time
          }
        );
      }
    });
  }
  
  /**
   * Get global audio state
   */
  getGlobalAudioState(): { isPlaying: boolean; currentTime: number; duration: number } | null {
    return this.audioManager.getGlobalAudioState();
  }

  /**
   * Get audio manager (for external use)
   */
  getAudioManager(): IAudioManager {
    return this.audioManager;
  }
  
  /**
   * Render a single frame.
   */
  render(): void {
    this.renderer.render();
  }
  
  /**
   * Start animation loop.
   */
  startAnimation(): void {
    this.renderer.startAnimation();
  }
  
  /**
   * Stop animation loop.
   */
  stopAnimation(): void {
    this.renderer.stopAnimation();
  }
  
  /**
   * Get renderer (for advanced use).
   */
  getRenderer(): IRenderer {
    return this.renderer;
  }
  
  /**
   * Cleanup all resources.
   * Cleans up in reverse order of creation (dependencies before dependents).
   */
  destroy(): void {
    // Stop periodic cleanup first
    this.audioManager.stopPeriodicCleanup();
    
    // Clean up components in reverse order of creation
    // CompilationManager depends on Renderer, so clean it up first
    safeDestroy(this.compilationManager as unknown as Disposable);
    
    // Then clean up AudioManager
    safeDestroy(this.audioManager as unknown as Disposable);
    
    // Finally clean up Renderer (it manages the canvas and WebGL context)
    safeDestroy(this.renderer as unknown as Disposable);
    
    // Clear references
    this.currentGraph = null;
  }
}

// Re-export types for convenience
export type { ShaderCompiler, ErrorCallback, IRenderer, IAudioManager, ICompilationManager } from './types';

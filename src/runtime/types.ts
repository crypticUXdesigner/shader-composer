/**
 * Runtime Types for Node-Based Shader System
 * 
 * These types match the Runtime Integration Specification.
 */

/**
 * Uniform metadata from compiler output.
 */
export interface UniformMetadata {
  // Uniform identifier in shader
  name: string;  // e.g., "uNodeN1Scale"
  
  // Source information
  nodeId: string;  // e.g., "node-123"
  paramName: string;  // e.g., "scale"
  
  // Type information
  type: 'float' | 'int' | 'vec2' | 'vec3' | 'vec4';
  
  // Default value (from node parameter default)
  defaultValue: number | [number, number] | [number, number, number] | [number, number, number, number];
}

/**
 * Compilation result from the shader compiler.
 */
export interface CompilationResult {
  // GLSL shader code
  shaderCode: string;
  
  // Uniform metadata
  uniforms: UniformMetadata[];
  
  // Compilation metadata
  metadata: {
    warnings: string[];
    errors: string[];
    executionOrder: string[];  // Node IDs in execution order
    finalOutputNodeId: string | null;  // ID of final output node
  };
}

/**
 * Shader compiler interface that the runtime expects.
 * @param audioSetup - Optional panel audio setup for uniforms from bands/files (WP 09).
 */
export interface ShaderCompiler {
  compile(
    graph: import('../data-model/types').NodeGraph,
    audioSetup?: import('../data-model/audioSetupTypes').AudioSetup | null
  ): CompilationResult;

  /**
   * Optional incremental compilation. When implemented, the compiler may return a new result
   * by reusing unchanged parts of the previous compilation. Returns null to fall back to full compile.
   */
  compileIncremental?(
    graph: import('../data-model/types').NodeGraph,
    previousResult: CompilationResult | null,
    affectedNodeIds: Set<string>,
    audioSetup?: import('../data-model/audioSetupTypes').AudioSetup | null
  ): CompilationResult | null;
}

/**
 * Renderer interface for dependency injection.
 * Provides rendering capabilities for shader output.
 */
export interface IRenderer {
  /**
   * Mark renderer as dirty (needs rendering).
   */
  markDirty(reason?: string): void;
  
  /**
   * Render a single frame (only if dirty).
   */
  render(): void;
  
  /**
   * Start animation loop.
   */
  startAnimation(): void;
  
  /**
   * Stop animation loop.
   */
  stopAnimation(): void;
  
  /**
   * Set shader instance for rendering.
   */
  setShaderInstance(instance: import('./ShaderInstance').ShaderInstance): void;
  
  /**
   * Register a callback to run when the WebGL context is restored after loss.
   */
  setOnContextRestored(callback: () => void): void;

  /**
   * Register a callback to run when the WebGL context is lost.
   */
  setOnContextLost(callback: () => void): void;

  /**
   * Get WebGL context (for CompilationManager).
   */
  getGLContext(): WebGL2RenderingContext;
  
  /**
   * Get canvas element.
   */
  getCanvas(): HTMLCanvasElement;
}

/**
 * Single source of truth for timeline: current time, duration, BPM, and whether time comes from audio.
 * Used by BottomBar, timeline panel, and (in WP 03) uTimelineTime uniform.
 */
export interface TimelineState {
  currentTime: number;
  duration: number;
  bpm: number;
  hasAudio: boolean;
  isPlaying: boolean;
}

/**
 * Audio manager interface for dependency injection.
 * Manages audio file loading, playback, and frequency analysis.
 */
export interface IAudioManager {
  /**
   * Set audio setup from panel. Syncs analyzers from bands; used for cleanup and uniform updates.
   */
  setAudioSetup?(audioSetup: import('../data-model/audioSetupTypes').AudioSetup | null): void;

  /**
   * Start periodic cleanup of orphaned resources.
   */
  startPeriodicCleanup(cleanupCallback: () => void, intervalMs?: number): void;
  
  /**
   * Stop periodic cleanup.
   */
  stopPeriodicCleanup(): void;
  
  /**
   * Clean up orphaned audio resources not in the graph.
   * @param graph - Node graph (valid IDs from graph.nodes)
   * @param extraValidIds - Additional valid IDs (e.g. panel file IDs from audioSetup.files)
   */
  cleanupOrphanedResources(
    graph?: import('../data-model/types').NodeGraph | null,
    extraValidIds?: Iterable<string>
  ): void;
  
  /**
   * Remove audio node and clean up resources.
   */
  removeAudioNode(nodeId: string): void;
  
  /**
   * Remove analyzer node and clean up resources.
   */
  removeAnalyzerNode(nodeId: string): void;
  
  /**
   * Get audio node state.
   */
  getAudioNodeState(nodeId: string): import('./AudioManager').AudioNodeState | undefined;
  
  /**
   * Get analyzer node state.
   */
  getAnalyzerNodeState(nodeId: string): import('./AudioManager').AnalyzerNodeState | undefined;
  
  /**
   * Create analyzer node for frequency analysis.
   */
  createAnalyzer(
    nodeId: string,
    audioFileNodeId: string,
    frequencyBands: import('./AudioManager').FrequencyBand[],
    smoothing: number[],
    fftSize?: number
  ): void;
  
  /**
   * Play audio for a node.
   * @param options - loop (default true); onEnded when loop is false (e.g. playlist advance)
   */
  playAudio(nodeId: string, offset?: number, options?: { loop?: boolean; onEnded?: () => void }): Promise<void>;
  
  /**
   * Pause audio playback for a node.
   */
  pauseAudio(nodeId: string): void;
  
  /**
   * Stop audio playback for a node.
   */
  stopAudio(nodeId: string): void;
  
  /**
   * Verify cleanup was successful for a node.
   */
  verifyCleanup(nodeId: string): boolean;
  
  /**
   * Update audio uniforms (called each frame).
   */
  updateUniforms(
    setUniform: (nodeId: string, paramName: string, value: number) => void,
    setUniforms: (updates: Array<{ nodeId: string, paramName: string, value: number }>) => void,
    graph?: {
      nodes: Array<{ id: string; type: string; parameters: Record<string, unknown> }>;
      connections: Array<{ sourceNodeId: string; targetNodeId: string; targetPort?: string }>;
    } | null,
    forcePushAll?: boolean
  ): void;
  
  /**
   * Load audio file for a node.
   * @param options.reportLoadFailure - If false, load failures are not reported to the user (e.g. preset filePath missing). Default true.
   */
  loadAudioFile(nodeId: string, file: File | string, options?: { reportLoadFailure?: boolean }): Promise<void>;
  
  /**
   * Get global audio state. When primaryNodeId provided, returns that node's state only.
   */
  getGlobalAudioState(primaryNodeId?: string): { isPlaying: boolean; currentTime: number; duration: number } | null;
  
  /**
   * Play all audio nodes.
   */
  playAllAudio(offset?: number): Promise<void>;
  
  /**
   * Stop all audio playback.
   */
  stopAllAudio(): void;

  /**
   * Pause all audio playback (preserves currentTime for resume).
   */
  pauseAllAudio(): void;
  
  /**
   * Seek all audio to a specific time.
   */
  seekAllAudio(time: number): Promise<void>;

  /**
   * Get audio context sample rate (for spectrum bin mapping).
   */
  getSampleRate(): number;

  /**
   * Get spectrum data for a panel band (for FrequencyRangeEditor).
   */
  getAnalyzerSpectrumData(bandId: string): { frequencyData: Uint8Array; fftSize: number; sampleRate: number } | null;

  /**
   * Get live incoming (raw band) and outgoing (remapped) values for a panel band or remapper.
   * Used for RemapRangeEditor needles.
   */
  getPanelBandLiveValues?(
    bandId: string,
    remap: { inMin: number; inMax: number; outMin: number; outMax: number }
  ): { incoming: number | null; outgoing: number | null };

  /**
   * Get live value for a virtual node (audio signal).
   * WP 11: Used when param is connected to virtual node.
   */
  getVirtualNodeLiveValue?(virtualNodeId: string): number | null;
}

/**
 * Compilation manager interface for dependency injection.
 * Coordinates compilation triggers and manages shader instance lifecycle.
 */
export interface ICompilationManager {
  /**
   * Set the node graph.
   */
  setGraph(graph: import('../data-model/types').NodeGraph): void;

  /**
   * Set audio setup from panel (for uniform generation from bands; WP 09).
   */
  setAudioSetup?(audioSetup: import('../data-model/audioSetupTypes').AudioSetup | null): void;
  
  /**
   * Handle parameter change.
   * Determines if recompilation is needed or just uniform update.
   */
  onParameterChange(nodeId: string, paramName: string, value: import('../data-model/types').ParameterValue): void;
  
  /**
   * Handle graph structure change (node added/removed, connection added/removed).
   * @param immediate - If true, recompile immediately (e.g. when only connections changed).
   */
  onGraphStructureChange(immediate?: boolean): void;
  
  /**
   * Recompile after WebGL context restore (previous shader instance is invalid).
   */
  recompileAfterContextRestore(): void;
  
  /**
   * Clear shader instance when WebGL context is lost (do not use or destroy the old instance).
   */
  clearShaderInstanceForContextLoss(): void;
  
  /**
   * Get current shader instance (for time/resolution updates).
   */
  getShaderInstance(): import('./ShaderInstance').ShaderInstance | null;

  /**
   * Set callback invoked after a successful recompile (e.g. so runtime marks dirty and syncs time).
   */
  setOnRecompiled(callback: () => void): void;

  /**
   * Set callback invoked with the new shader instance before its first render (e.g. to push audio uniforms).
   */
  setOnBeforeFirstRender(callback: (instance: import('./ShaderInstance').ShaderInstance) => void): void;
}

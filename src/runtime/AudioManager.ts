/**
 * AudioManager - Web Audio API Integration
 * 
 * Orchestrates audio file loading, playback, and frequency analysis.
 * Provides real-time audio data to shader uniforms.
 * 
 * Audio is driven by audioSetup only (files, bands, remappers).
 * 
 * This class uses composition with specialized components:
 * - AudioContextManager: Context lifecycle management
 * - AudioLoader: File/URL loading and decoding
 * - AudioPlaybackController: Playback control
 * - FrequencyAnalyzer: Frequency analysis
 */

import type { NodeGraph } from '../data-model/types';
import type { AudioSetup } from '../data-model/audioSetupTypes';
import { getVirtualNodeLiveValue as getVirtualNodeLiveValueImpl, getPanelBandLiveValues as getPanelBandLiveValuesImpl } from './audio/audioLiveValues';
import { findOrphanedNodes } from './audio/orphanCleanup';
import { syncPanelAnalyzers } from './audio/panelAnalyzerSync';
import type { ErrorHandler } from '../utils/errorHandling';
import type { Disposable } from '../utils/Disposable';
import { AudioContextManager } from './audio/AudioContextManager';
import { AudioLoader } from './audio/AudioLoader';
import { AudioPlaybackController, type AudioNodeState } from './audio/AudioPlaybackController';
import { FrequencyAnalyzer, type FrequencyBand, type AnalyzerNodeState } from './audio/FrequencyAnalyzer';
import { collectAudioUniformUpdates } from './audio/audioUniformUpdates';

// Re-export types for backward compatibility
export type { FrequencyBand, AudioNodeState, AnalyzerNodeState };

export class AudioManager implements Disposable {
  private contextManager: AudioContextManager;
  private loader: AudioLoader;
  private playbackController: AudioPlaybackController;
  private frequencyAnalyzer: FrequencyAnalyzer;
  
  private cleanupInterval: number | null = null; // Periodic cleanup interval ID
  
  /** Current audio setup from panel (for analyzer sync and uniform updates) */
  private audioSetup: AudioSetup | null = null;
  
  // Track previous uniform values to detect changes
  private previousUniformValues: Map<string, number> = new Map();
  private readonly VALUE_CHANGE_THRESHOLD = 0.001; // Only update if change > 0.1%
  
  constructor(errorHandler?: ErrorHandler) {
    
    // Create component instances
    this.contextManager = new AudioContextManager(errorHandler);
    this.loader = new AudioLoader(this.contextManager, errorHandler);
    this.playbackController = new AudioPlaybackController(this.contextManager, errorHandler);
    this.frequencyAnalyzer = new FrequencyAnalyzer(this.contextManager, errorHandler);
  }
  
  /**
   * Initialize AudioContext (must be called from user interaction)
   * Note: Does not automatically resume - call resume() after user interaction
   */
  async initialize(): Promise<void> {
    await this.contextManager.initialize();
  }
  
  /**
   * Resume AudioContext (must be called after user interaction)
   */
  async resume(): Promise<void> {
    await this.contextManager.resume();
  }
  
  /**
   * Set audio setup from panel. Syncs analyzers: creates one per band when source file is loaded,
   * removes analyzers for bands no longer in setup.
   */
  setAudioSetup(audioSetup: AudioSetup | null): void {
    this.audioSetup = audioSetup ?? null;
    syncPanelAnalyzers(audioSetup, this.frequencyAnalyzer, this.playbackController);
  }

  /**
   * Load audio file for a node (from File object or URL string)
   */
  async loadAudioFile(nodeId: string, file: File | string, options?: { reportLoadFailure?: boolean }): Promise<void> {
    // Stop existing playback before loading new file
    this.stopAudio(nodeId);
    
    // Load and decode audio file
    const audioBuffer = await this.loader.loadAudioFile(nodeId, file, options);
    
    // Get audio context and create nodes
    const audioContext = this.contextManager.getContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 4096; // Good resolution for frequency analysis
    analyser.smoothingTimeConstant = 0.8;
    
    const gain = audioContext.createGain();
    gain.gain.value = 1.0;
    
    // Create audio node state
    this.playbackController.createAudioNodeState(nodeId, audioBuffer, analyser, gain);
  }
  
  /**
   * Play audio for a node.
   * Automatically resumes AudioContext if suspended (requires user interaction).
   * @param options - loop (default true); onEnded when loop is false (e.g. playlist advance)
   */
  async playAudio(
    nodeId: string,
    offset: number = 0,
    options?: { loop?: boolean; onEnded?: () => void }
  ): Promise<void> {
    await this.playbackController.playAudio(nodeId, offset, options);
  }
  
  /**
   * Stop audio playback
   */
  stopAudio(nodeId: string): void {
    this.playbackController.stopAudio(nodeId);
    // Clear previous values when audio stops
    this.clearPreviousValues(nodeId);
  }
  
  /**
   * Pause audio playback
   */
  pauseAudio(nodeId: string): void {
    this.playbackController.pauseAudio(nodeId);
    // Clear previous values when audio pauses
    this.clearPreviousValues(nodeId);
  }

  /**
   * Pause all audio nodes (preserves currentTime for resume).
   */
  pauseAllAudio(): void {
    const audioNodeStates = this.playbackController.getAllAudioNodeStates();
    for (const nodeId of audioNodeStates.keys()) {
      this.pauseAudio(nodeId);
    }
  }
  
  /**
   * Create analyzer node
   */
  createAnalyzer(
    nodeId: string,
    audioFileNodeId: string,
    frequencyBands: FrequencyBand[],
    smoothing: number[],
    fftSize: number = 4096
  ): void {
    const audioState = this.playbackController.getAudioNodeState(audioFileNodeId);
    if (!audioState) {
      throw new Error(`Audio file node ${audioFileNodeId} not found or not initialized`);
    }
    
    this.frequencyAnalyzer.createAnalyzer(
      nodeId,
      audioFileNodeId,
      frequencyBands,
      smoothing,
      fftSize,
      audioState
    );
  }
  
  /**
   * Update all audio uniforms (called each frame)
   * Only updates uniforms when values actually change (optimized)
   * @param forcePushAll - When true, push every uniform (e.g. for a new shader instance); ignores change threshold.
   */
  updateUniforms(
    setUniform: (nodeId: string, paramName: string, value: number) => void,
    setUniforms: (updates: Array<{ nodeId: string, paramName: string, value: number }>) => void,
    graph?: {
      nodes: Array<{ id: string; type: string; parameters: Record<string, unknown> }>;
      connections: Array<{ sourceNodeId: string; targetNodeId: string; targetPort?: string }>;
    } | null,
    forcePushAll?: boolean
  ): void {
    const updates = collectAudioUniformUpdates(
      this.playbackController,
      this.frequencyAnalyzer,
      this.audioSetup,
      this.previousUniformValues,
      this.VALUE_CHANGE_THRESHOLD,
      graph ?? null,
      forcePushAll ?? false
    );
    if (updates.length > 0) {
      if (updates.length === 1) {
        setUniform(updates[0].nodeId, updates[0].paramName, updates[0].value);
      } else {
        setUniforms(updates);
      }
    }
  }
  
  /**
   * Get audio node state
   */
  getAudioNodeState(nodeId: string): AudioNodeState | undefined {
    return this.playbackController.getAudioNodeState(nodeId);
  }
  
  /**
   * Get analyzer node state
   */
  getAnalyzerNodeState(nodeId: string): AnalyzerNodeState | undefined {
    return this.frequencyAnalyzer.getAnalyzerNodeState(nodeId);
  }

  /**
   * Get spectrum data for a panel band (for FrequencyRangeEditor).
   * Refreshes frequency data from the analyser and returns it.
   */
  getAnalyzerSpectrumData(bandId: string): { frequencyData: Uint8Array; fftSize: number; sampleRate: number } | null {
    const band = this.audioSetup?.bands.find((b) => b.id === bandId);
    if (!band) return null;
    const audioState = this.playbackController.getAudioNodeState(band.sourceFileId);
    if (!audioState?.analyserNode || !audioState.frequencyData) return null;
    const freqData = audioState.frequencyData as Uint8Array<ArrayBuffer>;
    audioState.analyserNode.getByteFrequencyData(freqData);
    const analyzerState = this.frequencyAnalyzer.getAnalyzerNodeState(bandId);
    // Return a copy so Svelte reactivity detects updates (in-place mutation doesn't trigger re-renders)
    return {
      frequencyData: new Uint8Array(freqData),
      fftSize: analyzerState?.fftSize ?? band.fftSize ?? 2048,
      sampleRate: this.contextManager.getSampleRate()
    };
  }

  /**
   * Get live incoming (raw band) and outgoing (remapped) values for a panel band or remapper.
   * Used for RemapRangeEditor needles.
   */
  getPanelBandLiveValues(
    bandId: string,
    remap: { inMin: number; inMax: number; outMin: number; outMax: number }
  ): { incoming: number | null; outgoing: number | null } {
    return getPanelBandLiveValuesImpl(
      bandId,
      remap,
      (id) => this.frequencyAnalyzer.getAnalyzerNodeState(id)
    );
  }

  /**
   * Get live value for a virtual node (audio signal).
   * WP 11: Used by parameterValueCalculator when param is connected to virtual node.
   */
  getVirtualNodeLiveValue(virtualNodeId: string): number | null {
    return getVirtualNodeLiveValueImpl(
      virtualNodeId,
      this.audioSetup,
      (id) => this.frequencyAnalyzer.getAnalyzerNodeState(id)
    );
  }

  /**
   * Get audio context sample rate (for spectrum bin mapping).
   */
  getSampleRate(): number {
    return this.contextManager.getSampleRate();
  }
  
  /**
   * Play all audio nodes
   */
  async playAllAudio(offset: number = 0): Promise<void> {
    await this.playbackController.playAllAudio(offset);
  }
  
  /**
   * Stop all audio nodes
   */
  stopAllAudio(): void {
    const audioNodeStates = this.playbackController.getAllAudioNodeStates();
    for (const nodeId of audioNodeStates.keys()) {
      this.stopAudio(nodeId);
    }
  }
  
  /**
   * Get global audio state (from first loaded audio file)
   */
  getGlobalAudioState(primaryNodeId?: string): { isPlaying: boolean; currentTime: number; duration: number } | null {
    return this.playbackController.getGlobalAudioState(primaryNodeId);
  }
  
  /**
   * Seek all audio to a specific time
   */
  async seekAllAudio(time: number): Promise<void> {
    await this.playbackController.seekAllAudio(time);
  }
  
  /**
   * Remove audio node and clean up all resources
   */
  removeAudioNode(nodeId: string): void {
    this.playbackController.removeAudioNode(nodeId);
    // Clear previous values when node is removed
    this.clearPreviousValues(nodeId);
  }
  
  /**
   * Remove analyzer node and clean up all resources
   */
  removeAnalyzerNode(nodeId: string): void {
    this.frequencyAnalyzer.removeAnalyzerNode(nodeId);
    // Clear previous values when analyzer node is removed
    this.clearPreviousValues(nodeId);
  }
  
  /**
   * Clear previous uniform values for a node (call when audio stops or node is removed)
   */
  clearPreviousValues(nodeId: string): void {
    for (const key of this.previousUniformValues.keys()) {
      if (key.startsWith(`${nodeId}.`)) {
        this.previousUniformValues.delete(key);
      }
    }
  }
  
  /**
   * Verify all resources are cleaned up for a node
   */
  verifyCleanup(nodeId: string): boolean {
    const audioState = this.playbackController.getAudioNodeState(nodeId);
    const analyzerState = this.frequencyAnalyzer.getAnalyzerNodeState(nodeId);
    
    if (audioState || analyzerState) {
      console.warn(`[AudioManager] Resources still exist for node ${nodeId} after cleanup`);
      return false;
    }
    
    return true;
  }
  
  /**
   * Get resource statistics
   */
  getResourceStats(): {
    audioNodes: number;
    analyzerNodes: number;
    audioBuffers: number;
  } {
    const audioNodeStates = this.playbackController.getAllAudioNodeStates();
    return {
      audioNodes: audioNodeStates.size,
      analyzerNodes: this.frequencyAnalyzer.getAnalyzerNodeCount(),
      audioBuffers: Array.from(audioNodeStates.values())
        .filter(s => s.audioBuffer !== null).length
    };
  }
  
  /**
   * Start periodic cleanup (check for orphaned resources)
   * Note: The cleanup callback should be provided by the caller (RuntimeManager)
   * to have access to the current graph
   */
  startPeriodicCleanup(cleanupCallback: () => void, intervalMs: number = 30000): void {
    if (this.cleanupInterval) {
      return; // Already running
    }
    
    this.cleanupInterval = window.setInterval(() => {
      cleanupCallback();
    }, intervalMs);
  }
  
  /**
   * Stop periodic cleanup
   */
  stopPeriodicCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
  
  /**
   * Clean up orphaned resources (nodes that no longer exist in graph)
   * @param graph - Node graph (valid IDs from graph.nodes)
   * @param extraValidIds - Additional valid IDs (e.g. panel file IDs from audioSetup.files)
   */
  cleanupOrphanedResources(
    graph?: NodeGraph | null,
    extraValidIds?: Iterable<string>
  ): void {
    const validNodeIds = new Set<string>();
    if (graph) {
      for (const n of graph.nodes) validNodeIds.add(n.id);
    }
    if (extraValidIds) {
      for (const id of extraValidIds) validNodeIds.add(id);
    }
    if (validNodeIds.size === 0) return;
    const { orphanedAudioNodes, orphanedAnalyzerNodes } = findOrphanedNodes(
      validNodeIds,
      () => this.playbackController.getAllAudioNodeStates().keys(),
      () => this.frequencyAnalyzer.getAllAnalyzerNodeIds()
    );
    for (const nodeId of orphanedAudioNodes) {
      console.warn(`[AudioManager] Cleaning up orphaned audio node: ${nodeId}`);
      this.removeAudioNode(nodeId);
    }
    for (const nodeId of orphanedAnalyzerNodes) {
      console.warn(`[AudioManager] Cleaning up orphaned analyzer node: ${nodeId}`);
      this.removeAnalyzerNode(nodeId);
    }
    if (orphanedAudioNodes.length > 0 || orphanedAnalyzerNodes.length > 0) {
      console.warn(`[AudioManager] Cleaned up ${orphanedAudioNodes.length} audio nodes and ${orphanedAnalyzerNodes.length} analyzer nodes`);
    }
  }
  
  /**
   * Cleanup all resources
   */
  destroy(): void {
    // Stop periodic cleanup
    this.stopPeriodicCleanup();
    
    // Destroy components in reverse order of creation (dependencies before dependents)
    // FrequencyAnalyzer depends on AudioPlaybackController
    // AudioPlaybackController depends on AudioContextManager
    // AudioLoader depends on AudioContextManager
    this.frequencyAnalyzer.destroy();
    this.playbackController.destroy();
    this.loader.destroy();
    this.contextManager.destroy();
  }
}

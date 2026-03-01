/**
 * FrequencyAnalyzer - Frequency Analysis and Band Extraction
 * 
 * Manages analyzer nodes and extracts frequency band values from audio data.
 * Handles smoothing and frequency band calculations.
 */

import type { ErrorHandler } from '../../utils/errorHandling';
import { BaseDisposable } from '../../utils/Disposable';
import type { AudioContextManager } from './AudioContextManager';
import type { AudioNodeState } from './AudioPlaybackController';

export interface FrequencyBand {
  minHz: number;
  maxHz: number;
}

export interface AnalyzerNodeState {
  nodeId: string;
  analyserNode: AnalyserNode | null;
  frequencyBands: FrequencyBand[];
  /** Per-band smoothing (0–1). Length matches band count. */
  smoothing: number[];
  fftSize: number;
  bandValues: number[];
  smoothedBandValues: number[];
}

/**
 * Manages frequency analysis for audio nodes.
 */
export class FrequencyAnalyzer extends BaseDisposable {
  private contextManager: AudioContextManager;
  private analyzerNodes: Map<string, AnalyzerNodeState> = new Map();
  // errorHandler parameter kept for API consistency but not currently used

  constructor(contextManager: AudioContextManager, _errorHandler?: ErrorHandler) {
    super();
    this.contextManager = contextManager;
  }
  
  /**
   * Create analyzer node for frequency analysis.
   */
  createAnalyzer(
    nodeId: string,
    audioFileNodeId: string,
    frequencyBands: FrequencyBand[],
    smoothing: number[],
    fftSize: number = 4096,
    audioNodeState: AudioNodeState
  ): AnalyzerNodeState {
    this.ensureNotDestroyed();
    
    if (!audioNodeState.analyserNode) {
      throw new Error(`Audio file node ${audioFileNodeId} does not have an analyser node`);
    }
    
    // Ensure per-band smoothing array length matches band count
    const smoothingArray = smoothing.length >= frequencyBands.length
      ? smoothing.slice(0, frequencyBands.length)
      : [...smoothing, ...new Array(frequencyBands.length - smoothing.length).fill(0.8)];
    
    // Use the same analyser node from the audio file (shared FFT)
    const analyserState: AnalyzerNodeState = {
      nodeId,
      analyserNode: audioNodeState.analyserNode,
      frequencyBands,
      smoothing: smoothingArray,
      fftSize,
      bandValues: new Array(frequencyBands.length).fill(0),
      smoothedBandValues: new Array(frequencyBands.length).fill(0)
    };
    
    this.analyzerNodes.set(nodeId, analyserState);
    return analyserState;
  }
  
  /**
   * Get analyzer node state.
   */
  getAnalyzerNodeState(nodeId: string): AnalyzerNodeState | undefined {
    return this.analyzerNodes.get(nodeId);
  }
  
  /**
   * Get all analyzer node IDs (for cleanup operations).
   */
  getAllAnalyzerNodeIds(): string[] {
    return Array.from(this.analyzerNodes.keys());
  }
  
  /**
   * Get number of analyzer nodes.
   */
  getAnalyzerNodeCount(): number {
    return this.analyzerNodes.size;
  }
  
  /**
   * Extract frequency bands from analyser data.
   */
  private extractFrequencyBands(
    frequencyData: Uint8Array,
    frequencyBands: FrequencyBand[],
    sampleRate: number,
    fftSize: number
  ): number[] {
    const bandValues: number[] = [];
    
    for (const band of frequencyBands) {
      // Convert Hz to FFT bin indices
      const minBin = Math.floor((band.minHz / sampleRate) * fftSize);
      const maxBin = Math.ceil((band.maxHz / sampleRate) * fftSize);
      
      // Sum energy in this band
      let sum = 0;
      let count = 0;
      for (let i = minBin; i <= maxBin && i < frequencyData.length; i++) {
        sum += frequencyData[i];
        count++;
      }
      
      // Normalize: 0-255 range → 0-1 range
      const average = count > 0 ? sum / count : 0;
      const normalized = average / 255.0;
      
      bandValues.push(normalized);
    }
    
    return bandValues;
  }
  
  /**
   * Update frequency analysis for all analyzer nodes.
   * Returns updates for uniforms that changed.
   * @param forcePushAll - When true, always add every band to updates (for a new shader instance).
   */
  updateFrequencyAnalysis(
    audioNodeStates: Map<string, AudioNodeState>,
    graph?: { connections: Array<{ sourceNodeId: string; targetNodeId: string; targetPort?: string }> } | null,
    previousUniformValues?: Map<string, number>,
    valueChangeThreshold: number = 0.001,
    forcePushAll: boolean = false
  ): Array<{ nodeId: string, paramName: string, value: number }> {
    this.ensureNotDestroyed();
    
    const updates: Array<{ nodeId: string, paramName: string, value: number }> = [];
    const sampleRate = this.contextManager.getSampleRate();
    
    // First pass: Get frequency data from all audio nodes that have an analyser
    // (Use analyser output regardless of isPlaying so reactivity works when playback
    // state and actual sound are out of sync, e.g. after context resume.)
    const audioFileFrequencyData = new Map<string, Uint8Array>();
    
    for (const [nodeId, state] of audioNodeStates.entries()) {
      if (state.analyserNode && state.frequencyData) {
        state.analyserNode.getByteFrequencyData(state.frequencyData as Uint8Array<ArrayBuffer>);
        audioFileFrequencyData.set(nodeId, state.frequencyData as Uint8Array);
      }
    }
    
    // Second pass: Update analyzer node uniforms (only if audio is playing and values changed)
    for (const [nodeId, analyzerState] of this.analyzerNodes.entries()) {
      if (!analyzerState.analyserNode) continue;
      
      // Find connected audio file node using graph context
      let connectedAudioNodeId: string | null = null;
      if (graph) {
        const connection = graph.connections.find(
          c => c.targetNodeId === nodeId && c.targetPort === 'audioFile'
        );
        if (connection) {
          connectedAudioNodeId = connection.sourceNodeId;
        }
      }
      
      // Fallback: try to find by shared analyserNode if graph not available
      if (!connectedAudioNodeId) {
        for (const [audioNodeId, audioState] of audioNodeStates.entries()) {
          if (audioState.analyserNode === analyzerState.analyserNode) {
            connectedAudioNodeId = audioNodeId;
            break;
          }
        }
      }
      
      // Skip if no connected audio node found
      if (!connectedAudioNodeId) continue;
      
      // Get frequency data (reuse from first pass if available, else read from analyser)
      // We always run band extraction when we have an analyser, so reactivity works even
      // when isPlaying is out of sync with actual playback (e.g. after context resume).
      let frequencyData: Uint8Array | null = audioFileFrequencyData.get(connectedAudioNodeId) || null;
      
      // Fallback: read directly from analyser when not in first-pass map
      if (!frequencyData && analyzerState.analyserNode) {
        const buffer = new ArrayBuffer(analyzerState.analyserNode.frequencyBinCount);
        const tempFrequencyData = new Uint8Array(buffer);
        analyzerState.analyserNode.getByteFrequencyData(tempFrequencyData);
        frequencyData = tempFrequencyData;
      }
      
      if (!frequencyData) continue;
      
      // Extract frequency bands
      analyzerState.bandValues = this.extractFrequencyBands(
        frequencyData,
        analyzerState.frequencyBands,
        sampleRate,
        analyzerState.fftSize
      );
      
      // Apply per-band smoothing and check for changes
      for (let i = 0; i < analyzerState.bandValues.length; i++) {
        const newValue = analyzerState.bandValues[i];
        const oldValue = analyzerState.smoothedBandValues[i] || 0;
        const s = analyzerState.smoothing[i] ?? 0.8;
        const smoothed = s * newValue + (1 - s) * oldValue;
        analyzerState.smoothedBandValues[i] = smoothed;
        
        // Single-band analyzer: output name is 'band'
        const bandParamName = analyzerState.bandValues.length === 1 ? 'band' : `band${i}`;
        const bandKey = `${nodeId}.${bandParamName}`;
        if (previousUniformValues) {
          const prev = previousUniformValues.get(bandKey);
          const isFirst = prev === undefined;
          if (forcePushAll || isFirst || Math.abs(smoothed - prev!) > valueChangeThreshold) {
            updates.push({ nodeId, paramName: bandParamName, value: smoothed });
            previousUniformValues.set(bandKey, smoothed);
          }
        } else {
          updates.push({ nodeId, paramName: bandParamName, value: smoothed });
        }
      }
    }
    
    return updates;
  }
  
  /**
   * Remove analyzer node and clean up all resources
   */
  removeAnalyzerNode(nodeId: string): void {
    this.ensureNotDestroyed();
    
    const state = this.analyzerNodes.get(nodeId);
    if (!state) return;
    
    // Disconnect analyser node (only if it's not shared with an audio file node)
    // Note: Analyzer nodes share the analyserNode with their connected audio file node,
    // so we should NOT disconnect it here - it will be cleaned up when the audio file node is removed
    // However, we still clear the reference to allow proper cleanup tracking
    if (state.analyserNode) {
      // Don't disconnect shared analyser nodes - they're managed by the audio file node
      // Just clear the reference
      state.analyserNode = null;
    }
    
    // Clear frequency data
    state.bandValues = [];
    state.smoothedBandValues = [];
    
    // Remove from map
    this.analyzerNodes.delete(nodeId);
  }
  
  /**
   * Clean up resources.
   */
  protected doDestroy(): void {
    // Clean up analyzer nodes
    for (const nodeId of Array.from(this.analyzerNodes.keys())) {
      this.removeAnalyzerNode(nodeId);
    }
    
    // Clear map
    this.analyzerNodes.clear();
  }
}

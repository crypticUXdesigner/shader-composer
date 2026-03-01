/**
 * Audio Parameter Handler
 * 
 * Handles audio parameter coordination and audio file loading.
 * Extracted from RuntimeManager to improve separation of concerns.
 */

import type { IAudioManager } from '../types';
import type { ShaderInstance } from '../ShaderInstance';
import type { NodeGraph } from '../../data-model/types';
import type { ErrorHandler } from '../../utils/errorHandling';
import { globalErrorHandler } from '../../utils/errorHandling';

/**
 * Audio Parameter Handler
 * 
 * Coordinates audio file loading, analyzer initialization, and parameter updates.
 */
export class AudioParameterHandler {
  private audioManager: IAudioManager;
  private errorHandler?: ErrorHandler;

  constructor(audioManager: IAudioManager, errorHandler?: ErrorHandler) {
    this.audioManager = audioManager;
    this.errorHandler = errorHandler;
  }

  /**
   * Load default audio files (no-op; audio is via audioSetup and bottom bar only).
   */
  async loadDefaultAudioFiles(_graph: NodeGraph): Promise<void> {}

  /**
   * Initialize audio analyzers (no-op; bands come from audioSetup only).
   */
  initializeAudioAnalyzers(_graph: NodeGraph): void {}

  /**
   * Handle audio file parameter change (no-op; audio is via audioSetup and bottom bar only).
   */
  async onAudioFileParameterChange(
    _nodeId: string,
    _paramName: string,
    _value: unknown,
    _graph?: NodeGraph | null
  ): Promise<void> {}

  /**
   * Handle audio analyzer parameter change (no-op; legacy node type removed).
   */
  onAudioAnalyzerParameterChange(
    _nodeId: string,
    _paramName: string,
    _value: unknown,
    _graph: NodeGraph
  ): void {}

  /**
   * Clean up audio resources for removed nodes.
   * 
   * @param removedNodeIds - Array of node IDs that were removed
   */
  cleanupRemovedNodes(removedNodeIds: string[]): void {
    for (const nodeId of removedNodeIds) {
      this.audioManager.removeAudioNode(nodeId);
      this.audioManager.removeAnalyzerNode(nodeId);

      // Verify cleanup
      if (!this.audioManager.verifyCleanup(nodeId)) {
        const handler = this.errorHandler || globalErrorHandler;
        if (handler) {
          handler.report(
            'audio',
            'warning',
            `Audio cleanup incomplete for node ${nodeId}`,
            { nodeId }
          );
        }
      }
    }
  }

  /**
   * Tick audio analyzers (run frequency analysis and fill smoothedBandValues) without pushing uniforms.
   * Use after recreating an analyzer so the node-editor canvas (e.g. audio-driven UI) sees fresh
   * values immediately even when the main animation loop is not running (e.g. preview off-screen).
   */
  tickAudioAnalyzers(graph: NodeGraph | null): void {
    this.audioManager.updateUniforms(
      () => {},
      () => {},
      graph
    );
  }

  /**
   * Update audio uniforms (called each frame).
   * @param shaderInstance - Shader instance to update
   * @param graph - Current node graph (for connection checking)
   * @param options.forcePushAll - When true, push every uniform (e.g. before first render of a new instance)
   */
  updateAudioUniforms(
    shaderInstance: ShaderInstance,
    graph: NodeGraph | null,
    options?: { forcePushAll?: boolean }
  ): void {
    this.audioManager.updateUniforms(
      (nodeId: string, paramName: string, value: number) => {
        shaderInstance.setAudioUniform(nodeId, paramName, value);
      },
      (updates: Array<{ nodeId: string; paramName: string; value: number }>) => {
        // Use batch update method if available (more efficient)
        if (shaderInstance.setParameters) {
          shaderInstance.setParameters(updates);
        } else {
          // Fallback: update individually
          for (const update of updates) {
            shaderInstance.setAudioUniform(
              update.nodeId,
              update.paramName,
              update.value
            );
          }
        }
      },
      graph, // Pass graph context for connection checking
      options?.forcePushAll
    );
  }
}

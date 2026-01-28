/**
 * AudioContextManager - Web Audio Context Lifecycle Management
 * 
 * Manages AudioContext initialization, resumption, and state tracking.
 * Handles browser autoplay policies and context state transitions.
 */

import type { ErrorHandler } from '../../utils/errorHandling';
import { globalErrorHandler } from '../../utils/errorHandling';
import { BaseDisposable } from '../../utils/Disposable';

/**
 * Manages AudioContext lifecycle and state.
 */
export class AudioContextManager extends BaseDisposable {
  private audioContext: AudioContext | null = null;
  private sampleRate: number = 44100; // Default, will be set from AudioContext
  private errorHandler?: ErrorHandler;
  
  constructor(errorHandler?: ErrorHandler) {
    super();
    this.errorHandler = errorHandler;
  }
  
  /**
   * Initialize AudioContext (must be called from user interaction)
   * Note: Does not automatically resume - call resume() after user interaction
   */
  async initialize(): Promise<void> {
    this.ensureNotDestroyed();
    
    if (this.audioContext) {
      return; // Already initialized
    }
    
    // Create AudioContext (must be done in response to user interaction)
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.sampleRate = this.audioContext.sampleRate;
    
    // Don't automatically resume - browsers require user interaction
    // The context will be resumed when playAudio() is called (which should be after user interaction)
  }
  
  /**
   * Resume AudioContext (must be called after user interaction)
   */
  async resume(): Promise<void> {
    this.ensureNotDestroyed();
    
    if (!this.audioContext) {
      await this.initialize();
    }
    
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (error) {
        const handler = this.errorHandler || globalErrorHandler;
        handler.report(
          'audio',
          'warning',
          'Failed to resume AudioContext',
          { originalError: error instanceof Error ? error : new Error(String(error)) }
        );
      }
    }
  }
  
  /**
   * Get the AudioContext instance.
   * Throws if not initialized.
   */
  getContext(): AudioContext {
    this.ensureNotDestroyed();
    
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }
    
    // Check if context was closed and recreate if needed
    if (this.audioContext.state === 'closed') {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.sampleRate = this.audioContext.sampleRate;
    }
    
    return this.audioContext;
  }
  
  /**
   * Get the current sample rate.
   */
  getSampleRate(): number {
    return this.sampleRate;
  }
  
  /**
   * Get the current context state.
   */
  getState(): AudioContextState | null {
    return this.audioContext?.state || null;
  }
  
  /**
   * Check if context is initialized.
   */
  isInitialized(): boolean {
    return this.audioContext !== null && this.audioContext.state !== 'closed';
  }
  
  /**
   * Ensure context is ready for use (initialized and resumed).
   * Throws if context cannot be made ready.
   */
  async ensureReady(): Promise<void> {
    this.ensureNotDestroyed();
    
    if (!this.audioContext) {
      await this.initialize();
    }
    
    if (!this.audioContext) {
      throw new Error('AudioContext not available');
    }
    
    // Resume if suspended (required for autoplay policies)
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        // Verify it actually resumed
        if (this.audioContext.state === 'suspended') {
          throw new Error('AudioContext could not be resumed - user interaction required');
        }
      } catch (error: any) {
        const errorMsg = error?.message || String(error);
        // Only report if it's not the expected autoplay policy error
        if (!errorMsg.includes('user gesture') && !errorMsg.includes('user interaction') && !errorMsg.includes('not allowed to start')) {
          const handler = this.errorHandler || globalErrorHandler;
          handler.report(
            'audio',
            'warning',
            'Failed to resume AudioContext',
            { 
              originalError: error instanceof Error ? error : new Error(errorMsg)
            }
          );
        }
        // Re-throw so caller knows context is not ready
        throw error;
      }
    }
  }
  
  /**
   * Clean up resources.
   */
  protected doDestroy(): void {
    // Close audio context
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (error) {
        // Ignore errors during cleanup
      }
      this.audioContext = null;
    }
  }
}

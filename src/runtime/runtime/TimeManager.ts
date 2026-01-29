/**
 * Time Manager
 * 
 * Manages time tracking and dirty state for conditional rendering.
 * Extracted from RuntimeManager to improve separation of concerns.
 */

import type { IRenderer } from '../types';
import type { ShaderInstance } from '../ShaderInstance';

/**
 * Time Manager
 * 
 * Tracks time for shader uniforms and manages dirty state for rendering.
 */
export class TimeManager {
  private lastTime: number = 0;
  private isDirty: boolean = false;
  private readonly TIME_CHANGE_THRESHOLD = 0.01; // Only update if change > 0.01s

  /**
   * Update time uniform if it changed meaningfully or if dirty.
   * Audio uniforms are always updated every frame when a shader exists, so
   * audio-reactive parameters stay live regardless of time or dirty state.
   *
   * @param time - Current time value
   * @param shaderInstance - Shader instance to update
   * @param renderer - Renderer to mark dirty and render
   * @param updateAudioUniforms - Callback to update audio uniforms
   * @returns true if time was updated and render ran, false otherwise
   */
  updateTime(
    time: number,
    shaderInstance: ShaderInstance | null,
    renderer: IRenderer,
    updateAudioUniforms?: (shaderInstance: ShaderInstance) => void
  ): boolean {
    if (!shaderInstance) return false;

    // Always update audio uniforms every frame when we have a shader, so
    // parameter connections to audio (analyzer, remap, etc.) stay reactive
    // even when time hasn't changed or nothing is dirty.
    if (updateAudioUniforms) {
      updateAudioUniforms(shaderInstance);
    }

    // Only update time uniform and render if time changed meaningfully or dirty
    const timeChanged = Math.abs(time - this.lastTime) > this.TIME_CHANGE_THRESHOLD;
    if (!timeChanged && !this.isDirty) {
      return false; // Skip time/render - time hasn't changed and nothing else is dirty
    }

    this.lastTime = time;
    shaderInstance.setTime(time);

    // Mark as dirty and render
    renderer.markDirty('time');
    renderer.render();

    return true;
  }

  /**
   * Mark runtime as dirty (something changed that requires render).
   * 
   * @param renderer - Renderer to mark dirty
   * @param reason - Reason for marking dirty
   */
  markDirty(renderer: IRenderer, reason: string): void {
    this.isDirty = true;
    renderer.markDirty(reason);
  }

  /**
   * Render if dirty.
   * 
   * @param renderer - Renderer to use
   * @returns true if rendered, false if not dirty
   */
  renderIfDirty(renderer: IRenderer): boolean {
    if (this.isDirty) {
      renderer.render();
      this.isDirty = false;
      return true;
    }
    return false;
  }

  /**
   * Get last time value.
   */
  getLastTime(): number {
    return this.lastTime;
  }

  /**
   * Check if currently dirty.
   */
  isCurrentlyDirty(): boolean {
    return this.isDirty;
  }

  /**
   * Reset dirty state.
   */
  clearDirty(): void {
    this.isDirty = false;
  }

  /**
   * Reset time tracking.
   */
  reset(): void {
    this.lastTime = 0;
    this.isDirty = false;
  }
}

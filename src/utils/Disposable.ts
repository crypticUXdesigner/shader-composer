/**
 * Disposable Interface - Resource Cleanup Pattern
 * 
 * Provides a standard interface for components that need to clean up resources.
 * All components that manage resources (WebGL contexts, audio buffers, timers,
 * observers, event listeners) should implement this interface.
 */

/**
 * Interface for components that need resource cleanup.
 * 
 * Components implementing this interface should:
 * - Clean up all resources in destroy()
 * - Set isDestroyed to true after cleanup
 * - Be safe to call destroy() multiple times (idempotent)
 * - Clean up in reverse order of creation (dependencies before dependents)
 */
export interface Disposable {
  /**
   * Destroy the component and clean up all resources.
   * 
   * This method should:
   * - Clean up WebGL resources (shaders, programs, buffers)
   * - Clean up audio resources (contexts, buffers, nodes)
   * - Clear timers and intervals
   * - Remove event listeners
   * - Disconnect observers (ResizeObserver, IntersectionObserver)
   * - Clear references to allow garbage collection
   * 
   * Should be idempotent - safe to call multiple times.
   */
  destroy(): void;
  
  /**
   * Whether this component has been destroyed.
   * Used to prevent operations on destroyed components.
   */
  readonly isDestroyed?: boolean;
}

/**
 * Base class for disposable components.
 * Provides common cleanup patterns and isDestroyed tracking.
 */
export abstract class BaseDisposable implements Disposable {
  private _isDestroyed: boolean = false;
  
  /**
   * Whether this component has been destroyed.
   */
  get isDestroyed(): boolean {
    return this._isDestroyed;
  }
  
  /**
   * Destroy the component and clean up all resources.
   * Calls doDestroy() for actual cleanup logic.
   */
  destroy(): void {
    if (this._isDestroyed) {
      return; // Already destroyed, skip
    }
    
    this.doDestroy();
    this._isDestroyed = true;
  }
  
  /**
   * Override this method to implement actual cleanup logic.
   * Called once by destroy() before marking as destroyed.
   */
  protected abstract doDestroy(): void;
  
  /**
   * Check if component is destroyed and throw if so.
   * Use this in methods that shouldn't be called after destruction.
   */
  protected ensureNotDestroyed(): void {
    if (this._isDestroyed) {
      throw new Error(`Cannot use ${this.constructor.name} after destroy()`);
    }
  }
}

/**
 * Helper function to safely destroy a disposable component.
 * Handles null/undefined and errors gracefully.
 */
export function safeDestroy(disposable: Disposable | null | undefined): void {
  if (!disposable) {
    return;
  }
  
  try {
    disposable.destroy();
  } catch (error) {
    console.error(`Error destroying ${disposable.constructor?.name || 'component'}:`, error);
  }
}

/**
 * Helper function to destroy multiple disposables in order.
 * Destroys in reverse order (dependencies before dependents).
 */
export function destroyAll(disposables: Array<Disposable | null | undefined>): void {
  // Destroy in reverse order (dependencies before dependents)
  for (let i = disposables.length - 1; i >= 0; i--) {
    safeDestroy(disposables[i]);
  }
}

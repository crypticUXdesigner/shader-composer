/**
 * Throttler Utility
 * 
 * Throttles function calls to limit execution frequency.
 * Useful for parameter updates, rendering, and other high-frequency operations.
 * 
 * Phase 3.4: Performance Optimization
 */

export class Throttler {
  private pending: Map<string, any> = new Map();
  private callbacks: Map<string, (value: any) => void> = new Map();
  private timeout: number | null = null;
  private readonly delay: number;
  
  /**
   * Create a new throttler
   * @param delayMs Delay in milliseconds between throttled executions (default: 16ms for ~60fps)
   */
  constructor(delayMs: number = 16) {
    this.delay = delayMs;
  }
  
  /**
   * Schedule a throttled callback
   * @param key Unique key for this throttled operation
   * @param value Value to pass to callback (latest value wins if multiple calls)
   * @param callback Function to call when throttle period elapses
   */
  schedule(key: string, value: any, callback: (value: any) => void): void {
    // Store the latest value and callback
    this.pending.set(key, value);
    this.callbacks.set(key, callback);
    
    // If no timeout is scheduled, schedule one
    if (this.timeout === null) {
      this.timeout = window.setTimeout(() => {
        this.flush();
        this.timeout = null;
      }, this.delay);
    }
  }
  
  /**
   * Execute all pending callbacks immediately
   * Useful for flushing before cleanup or when immediate execution is needed
   */
  flush(): void {
    for (const [key, value] of this.pending) {
      const callback = this.callbacks.get(key);
      if (callback) {
        callback(value);
      }
    }
    
    // Clear pending operations
    this.pending.clear();
    this.callbacks.clear();
  }
  
  /**
   * Cancel all pending operations
   */
  cancel(): void {
    if (this.timeout !== null) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    this.pending.clear();
    this.callbacks.clear();
  }
  
  /**
   * Check if there are pending operations
   */
  hasPending(): boolean {
    return this.pending.size > 0;
  }
  
  /**
   * Get the number of pending operations
   */
  getPendingCount(): number {
    return this.pending.size;
  }
}

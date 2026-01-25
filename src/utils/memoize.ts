/**
 * Memoization Utility
 * 
 * Phase 3.2: Provides memoization for expensive function calls.
 * Caches function results based on arguments to avoid redundant calculations.
 */

/**
 * Memoize a function with automatic cache key generation
 * 
 * @param fn Function to memoize
 * @param keyFn Optional function to generate cache keys from arguments
 * @returns Memoized function
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  keyFn?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();
  
  return ((...args: Parameters<T>) => {
    const key = keyFn ? keyFn(...args) : JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

/**
 * Memoize a function with manual cache management
 * 
 * @param fn Function to memoize
 * @param keyFn Function to generate cache keys from arguments
 * @returns Memoized function with cache management methods
 */
export function memoizeWithCache<T extends (...args: any[]) => any>(
  fn: T,
  keyFn: (...args: Parameters<T>) => string
): T & { clear: () => void; invalidate: (key: string) => void; has: (key: string) => boolean } {
  const cache = new Map<string, ReturnType<T>>();
  
  const memoized = ((...args: Parameters<T>) => {
    const key = keyFn(...args);
    
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T & { clear: () => void; invalidate: (key: string) => void; has: (key: string) => boolean };
  
  memoized.clear = () => {
    cache.clear();
  };
  
  memoized.invalidate = (key: string) => {
    cache.delete(key);
  };
  
  memoized.has = (key: string) => {
    return cache.has(key);
  };
  
  return memoized;
}

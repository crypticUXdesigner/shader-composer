/**
 * Shared RAF loop for parameter value updates (live value, effective value).
 * Consolidates many per-component RAF loops into one to reduce overhead.
 */

type TickCallback = () => void;

let subscribers: Set<TickCallback> = new Set();
let rafId: number | null = null;

function tick(): void {
  rafId = null;
  for (const cb of subscribers) {
    try {
      cb();
    } catch (err) {
      console.error('[parameterValueTickStore] Subscriber error:', err);
    }
  }
  if (subscribers.size > 0) {
    rafId = requestAnimationFrame(tick);
  }
}

/**
 * Subscribe to the shared tick. Callback runs every frame while subscribed.
 * Returns unsubscribe function.
 */
export function subscribeParameterValueTick(callback: TickCallback): () => void {
  const hadSubscribers = subscribers.size > 0;
  subscribers.add(callback);
  if (!hadSubscribers) {
    rafId = requestAnimationFrame(tick);
  }
  return () => {
    subscribers.delete(callback);
    if (subscribers.size === 0 && rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };
}

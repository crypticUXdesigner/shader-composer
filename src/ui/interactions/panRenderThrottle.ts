/**
 * Throttle for requestRender during pan and momentum.
 * Caps full redraw rate (e.g. ~30 fps) while pan state still updates every RAF frame,
 * reducing main-thread cost during continuous pan without making pan feel laggy.
 */

/** Minimum interval between render requests during pan/momentum (ms). ~30 fps. */
export const MIN_PAN_RENDER_INTERVAL_MS = 33;

/**
 * Returns true if a render should be requested now (first call or interval elapsed).
 * Caller should pass the last time requestRender was called (0 = never).
 * When true, caller should call requestRender() and then update their lastRequestTime to performance.now().
 */
export function shouldRequestPanRender(lastRequestTime: number): boolean {
  if (lastRequestTime === 0) return true;
  return performance.now() - lastRequestTime >= MIN_PAN_RENDER_INTERVAL_MS;
}

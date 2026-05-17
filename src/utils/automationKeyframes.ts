import type { AutomationKeyframe } from '../data-model/types';

/** Keeps sequential keyframes from sharing the same normalized time during drag corrections. */
export const KEYFRAME_TIME_EPS = 1e-3;

/** Clamp to [0, 1]; non-finite values become `fallback`. */
export function clampNormalized01(n: number, fallback = 0): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

/** Preserve time order along the array (sorted keyframe semantics) without resorting indices mid-drag. */
export function enforceMonotonicKeyTimes_inplace(kfs: AutomationKeyframe[]): void {
  const n = kfs.length;
  if (n < 2) return;

  let changed = true;
  let guard = 0;
  while (changed && guard < 32) {
    changed = false;
    guard += 1;
    kfs[0] = { ...kfs[0], time: 0 };
    kfs[n - 1] = { ...kfs[n - 1], time: 1 };

    for (let i = 1; i < n - 1; i += 1) {
      const minT = Math.min(kfs[i - 1].time + KEYFRAME_TIME_EPS, 1);
      if (kfs[i].time < minT) {
        kfs[i] = { ...kfs[i], time: minT };
        changed = true;
      }
    }
    for (let i = n - 2; i >= 1; i -= 1) {
      const maxT = Math.max(kfs[i + 1].time - KEYFRAME_TIME_EPS, 0);
      if (kfs[i].time > maxT) {
        kfs[i] = { ...kfs[i], time: maxT };
        changed = true;
      }
    }
  }
  kfs[0] = { ...kfs[0], time: 0 };
  kfs[n - 1] = { ...kfs[n - 1], time: 1 };
}

/**
 * Ensure automation keyframes are finite, in-range, sorted, endpoint-anchored, and time-monotonic.
 * Safe for persistence and shader codegen (avoids NaN in GLSL literals / invalid program compiles).
 */
export function sanitizeAutomationCurveKeyframes(
  keyframes: readonly AutomationKeyframe[]
): AutomationKeyframe[] {
  if (keyframes.length === 0) return [];

  const copy = keyframes
    .map((kf) => ({
      time: clampNormalized01(kf.time, 0),
      value: clampNormalized01(kf.value, 0),
    }))
    .sort((a, b) => (a.time !== b.time ? a.time - b.time : 0));

  copy[0] = { time: 0, value: copy[0]!.value };
  copy[copy.length - 1] = { time: 1, value: copy[copy.length - 1]!.value };

  enforceMonotonicKeyTimes_inplace(copy);
  return copy;
}

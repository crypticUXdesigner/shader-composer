/**
 * JS-side evaluation of timeline automation at a given time.
 * Used by UI (effective parameter values) and can be mirrored in GLSL (WP 03).
 */

import type {
  NodeGraph,
  NodeInstance,
  AutomationState,
  AutomationRegion,
  AutomationCurve,
  AutomationKeyframe,
} from '../data-model/types';
import type { ParameterSpec } from '../types/nodeSpec';

/** Result of finding a region at time t: region and normalized local time in [0, 1]. */
export interface RegionAtTime {
  region: AutomationRegion;
  normalizedTime: number;
}

/**
 * Evaluate a curve at normalized time s in [0, 1].
 * Keyframes are sorted by time; segment is found; value is computed by interpolation.
 * Returns raw value (may be outside [0,1] if keyframe values are). Caller scales by param min/max.
 */
export function evaluateCurveAtNormalizedTime(curve: AutomationCurve, s: number): number {
  const keyframes = [...(curve.keyframes ?? [])].sort((a, b) => a.time - b.time);
  if (keyframes.length === 0) return 0;
  if (keyframes.length === 1) return keyframes[0].value;

  const n = keyframes.length;
  // Clamp s to [0, 1] for segment lookup
  const t = Math.max(0, Math.min(1, s));

  // Find segment: keyframes[i].time <= t < keyframes[i+1].time
  let i = 0;
  for (; i < n - 1; i++) {
    if (t < keyframes[i + 1].time) break;
  }
  if (i >= n - 1) {
    return keyframes[n - 1].value;
  }

  const k0 = keyframes[i];
  const k1 = keyframes[i + 1];
  const segDuration = k1.time - k0.time;
  const segT = segDuration > 0 ? (t - k0.time) / segDuration : 0;

  switch (curve.interpolation) {
    case 'stepped':
      return k0.value;
    case 'linear':
      return k0.value + segT * (k1.value - k0.value);
    case 'bezier': {
      // Cubic Hermite: use finite-difference tangents so only keyframe time/value needed.
      // Mirrors well in GLSL (WP 03): same keyframe array, segment index, cubic formula.
      const m0 = tangentAtKeyframe(keyframes, i, n);
      const m1 = tangentAtKeyframe(keyframes, i + 1, n);
      return cubicHermite(segT, k0.value, m0 * segDuration, k1.value, m1 * segDuration);
    }
    default:
      return k0.value + segT * (k1.value - k0.value);
  }
}

/** Tangent at keyframe i for cubic Hermite (finite difference). */
function tangentAtKeyframe(keyframes: AutomationKeyframe[], i: number, n: number): number {
  if (n <= 1) return 0;
  if (i <= 0) return (keyframes[1].value - keyframes[0].value) / (keyframes[1].time - keyframes[0].time || 1);
  if (i >= n - 1) return (keyframes[n - 1].value - keyframes[n - 2].value) / (keyframes[n - 1].time - keyframes[n - 2].time || 1);
  const dt = keyframes[i + 1].time - keyframes[i - 1].time;
  const dv = keyframes[i + 1].value - keyframes[i - 1].value;
  return dt !== 0 ? dv / dt : 0;
}

/** Cubic Hermite: p0, m0 at t=0; p1, m1 at t=1. */
function cubicHermite(t: number, p0: number, m0: number, p1: number, m1: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return h00 * p0 + h10 * m0 + h01 * p1 + h11 * m1;
}

/**
 * Find the lane for (nodeId, paramName) and the region containing time t.
 * If region has loop, local time is (t - startTime) % duration; normalizedTime = localTime / duration.
 * Returns null if no automation, no matching lane, or no region contains t.
 */
export function findRegionAtTime(
  automation: AutomationState,
  nodeId: string,
  paramName: string,
  t: number
): RegionAtTime | null {
  const lane = automation.lanes.find(
    (l) => l.nodeId === nodeId && l.paramName === paramName
  );
  if (!lane) return null;

  const regions = [...lane.regions].sort((a, b) => a.startTime - b.startTime);
  for (const region of regions) {
    const start = region.startTime;
    const duration = region.duration;
    const end = start + duration;
    if (duration <= 0) continue;

    let localTime: number;
    if (region.loop) {
      const elapsed = t - start;
      if (elapsed < 0) continue;
      localTime = elapsed % duration;
      if (localTime < 0) localTime += duration;
    } else {
      if (t < start || t >= end) continue;
      localTime = t - start;
    }
    const normalizedTime = localTime / duration;
    return { region, normalizedTime };
  }
  return null;
}

/**
 * Evaluate automation at time t for the given (nodeId, paramName).
 * Returns value in param range (scaled from curve 0–1 by paramSpec.min/max), or null if no region covers t.
 */
export function evaluateAutomationAtTime(
  graph: NodeGraph,
  nodeId: string,
  paramName: string,
  t: number,
  paramSpec?: ParameterSpec
): number | null {
  const automation = graph.automation;
  if (!automation?.lanes?.length) return null;

  const found = findRegionAtTime(automation, nodeId, paramName, t);
  if (!found) return null;

  const raw = evaluateCurveAtNormalizedTime(found.region.curve, found.normalizedTime);
  const min = paramSpec?.min ?? 0;
  const max = paramSpec?.max ?? 1;
  const value = min + raw * (max - min);
  return Math.max(min, Math.min(max, value));
}

/**
 * Helper for the effective-parameter path: get automation value for a node's parameter at time t.
 * Returns number in param range or null.
 */
export function getAutomationValueForParam(
  node: NodeInstance,
  paramName: string,
  graph: NodeGraph,
  t: number,
  paramSpec?: ParameterSpec
): number | null {
  return evaluateAutomationAtTime(graph, node.id, paramName, t, paramSpec);
}

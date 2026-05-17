import type { AutomationKeyframe } from '../../../data-model/types';
import { clampNormalized01, sanitizeAutomationCurveKeyframes } from '../../../utils/automationKeyframes';

export {
  KEYFRAME_TIME_EPS,
  clampNormalized01,
  sanitizeAutomationCurveKeyframes,
} from '../../../utils/automationKeyframes';

/** Only snap when the pointer is near a grid crossing (fraction of one grid step). */
export const SNAP_NEAR_GRID_FRAC = 0.36;

export const SNAP_DIVISIONS = [1, 2, 4, 8, 16] as const;
export type SnapDivision = (typeof SNAP_DIVISIONS)[number];

/** Hard snap reference (nearest grid crossing). Snap is “soft”: only pulls when pointer is close. */
export function snapTimeToBarGrid(t: number, regionBars: number, division: number): number {
  if (regionBars <= 0 || division <= 0) return t;
  const step = 1 / (regionBars * division);
  const n = Math.round(t / step);
  return Math.max(0, Math.min(1, n * step));
}

export function stableTimeSortKeyframes(keyframes: AutomationKeyframe[]): {
  sorted: AutomationKeyframe[];
  oldToNew: Map<number, number>;
} {
  const withIdx = keyframes.map((kf, idx) => ({ kf: { ...kf }, idx }));
  withIdx.sort((a, b) =>
    a.kf.time !== b.kf.time ? a.kf.time - b.kf.time : a.idx - b.idx
  );
  const sorted = withIdx.map((x) => x.kf);
  const oldToNew = new Map<number, number>(
    withIdx.map((row, slot) => [row.idx, slot])
  );
  return { sorted, oldToNew };
}

export function remapSelectionIndices(
  indices: readonly number[],
  oldToNew: Map<number, number>
): number[] {
  const next = new Set<number>();
  for (const i of indices) {
    const mapped = oldToNew.get(i);
    if (mapped !== undefined) next.add(mapped);
  }
  return [...next].sort((a, b) => a - b);
}

export function proposeDragKeyframes(
  base: AutomationKeyframe[],
  selIndices: readonly number[],
  anchorT: number,
  anchorV: number,
  pointerT: number,
  pointerV: number,
  snapTimeFn: (t: number) => number
): AutomationKeyframe[] {
  const safeAnchorT = clampNormalized01(anchorT);
  const safeAnchorV = clampNormalized01(anchorV);
  const safePointerT = clampNormalized01(pointerT);
  const safePointerV = clampNormalized01(pointerV);
  const dt = safePointerT - safeAnchorT;
  const dv = safePointerV - safeAnchorV;
  const n = base.length;
  const selSet = new Set(selIndices);

  const next = base.map((kf, i) => {
    if (!selSet.has(i)) return { ...kf };

    const nv = clampNormalized01(kf.value + dv, clampNormalized01(kf.value));
    let nt: number;

    if (i === 0) {
      return { time: 0, value: nv };
    }
    if (i === n - 1) {
      return { time: 1, value: nv };
    }

    nt = clampNormalized01(snapTimeFn(kf.time + dt), clampNormalized01(kf.time));
    return { time: nt, value: nv };
  });

  return sanitizeAutomationCurveKeyframes(next);
}

export type CurveEditorDragAxisLock = 'free' | 'time' | 'value';

/** Shift = horizontal (time) only; Alt = vertical (value) only. Shift wins when both are held. */
export function resolveCurveEditorDragAxisLock(
  shiftKey: boolean,
  altKey: boolean
): CurveEditorDragAxisLock {
  if (shiftKey) return 'time';
  if (altKey) return 'value';
  return 'free';
}

export function constrainCurveEditorDragPointer(
  pointerT: number,
  pointerV: number,
  anchorT: number,
  anchorV: number,
  lock: CurveEditorDragAxisLock
): { t: number; v: number } {
  switch (lock) {
    case 'time':
      return { t: pointerT, v: anchorV };
    case 'value':
      return { t: anchorT, v: pointerV };
    default:
      return { t: pointerT, v: pointerV };
  }
}

export type CurveEditorDragSession = {
  startKeyframes: AutomationKeyframe[];
  selectedIndicesSorted: readonly number[];
  /** Keyframe under the pointer at drag start (time guide follows this mark). */
  primaryDragIndex: number;
  anchorT: number;
  anchorV: number;
};

/**
 * Time-only snapping: quantize only near a grid crossing (less “magnetic” than full quantize).
 */
export function maybeSnapCurveKeyframeTime(
  t: number,
  opts: { snapEnabled: boolean; regionBars: number; snapDivision: number }
): number {
  const tn = Math.max(0, Math.min(1, t));
  if (!opts.snapEnabled) return tn;
  if (opts.regionBars <= 0 || opts.snapDivision <= 0) return tn;
  const step = 1 / (opts.regionBars * opts.snapDivision);
  const snapped = snapTimeToBarGrid(tn, opts.regionBars, opts.snapDivision);
  return Math.abs(tn - snapped) <= step * SNAP_NEAR_GRID_FRAC ? snapped : tn;
}

/** Flip normalized values: low becomes high and high becomes low (times unchanged). */
export function invertCurveKeyframeValues(
  keyframes: readonly AutomationKeyframe[]
): AutomationKeyframe[] {
  return sanitizeAutomationCurveKeyframes(
    keyframes.map((kf) => ({
      ...kf,
      value: clampNormalized01(1 - kf.value, 0),
    }))
  );
}

/** After inserting a keyframe near (t,v), locate its index for selection. */
export function indexOfInsertedKeyframe(
  sorted: AutomationKeyframe[],
  t: number,
  v: number
): number {
  const TIME_TOL = 2e-4;
  const VAL_TOL = 2e-4;
  for (let i = 0; i < sorted.length; i++) {
    const k = sorted[i]!;
    if (Math.abs(k.time - t) < TIME_TOL && Math.abs(k.value - v) < VAL_TOL) return i;
  }
  let best = 0;
  let bestDt = Infinity;
  for (let i = 0; i < sorted.length; i++) {
    const dt = Math.abs(sorted[i]!.time - t);
    if (dt < bestDt) {
      bestDt = dt;
      best = i;
    }
  }
  return best;
}

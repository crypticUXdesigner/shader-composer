import { describe, expect, it } from 'vitest';
import {
  constrainCurveEditorDragPointer,
  invertCurveKeyframeValues,
  maybeSnapCurveKeyframeTime,
  proposeDragKeyframes,
  remapSelectionIndices,
  resolveCurveEditorDragAxisLock,
  snapTimeToBarGrid,
  stableTimeSortKeyframes,
} from './curveEditorKeyframes';

describe('curveEditorKeyframes', () => {
  it('snapTimeToBarGrid quantizes to grid', () => {
    expect(snapTimeToBarGrid(0.51, 4, 1)).toBeCloseTo(0.5);
  });

  it('maybeSnapCurveKeyframeTime returns raw when snap disabled', () => {
    expect(
      maybeSnapCurveKeyframeTime(0.31, {
        snapEnabled: false,
        regionBars: 4,
        snapDivision: 1,
      })
    ).toBeCloseTo(0.31);
  });

  it('stableTimeSortKeyframes produces remap for selection', () => {
    const { sorted, oldToNew } = stableTimeSortKeyframes([
      { time: 0.6, value: 1 },
      { time: 0.2, value: 0 },
    ]);
    expect(sorted[0]!.time).toBeLessThan(sorted[1]!.time);
    expect(remapSelectionIndices([1, 0], oldToNew).sort()).toEqual([0, 1]);
  });

  it('resolveCurveEditorDragAxisLock maps shift and alt', () => {
    expect(resolveCurveEditorDragAxisLock(false, false)).toBe('free');
    expect(resolveCurveEditorDragAxisLock(true, false)).toBe('time');
    expect(resolveCurveEditorDragAxisLock(false, true)).toBe('value');
    expect(resolveCurveEditorDragAxisLock(true, true)).toBe('time');
  });

  it('constrainCurveEditorDragPointer freezes the locked axis', () => {
    expect(
      constrainCurveEditorDragPointer(0.8, 0.2, 0.5, 0.5, 'time')
    ).toEqual({ t: 0.8, v: 0.5 });
    expect(
      constrainCurveEditorDragPointer(0.8, 0.2, 0.5, 0.5, 'value')
    ).toEqual({ t: 0.5, v: 0.2 });
  });

  it('proposeDragKeyframes with value lock moves only value on interior keyframes', () => {
    const base = [
      { time: 0, value: 0 },
      { time: 0.5, value: 0.5 },
      { time: 1, value: 1 },
    ];
    const locked = constrainCurveEditorDragPointer(0.7, 0.9, 0.5, 0.5, 'value');
    const next = proposeDragKeyframes(base, [1], 0.5, 0.5, locked.t, locked.v, (t) => t);
    expect(next[1]!.time).toBeCloseTo(0.5);
    expect(next[1]!.value).toBeCloseTo(0.9);
  });

  it('proposeDragKeyframes sanitizes non-finite pointer deltas', () => {
    const base = [
      { time: 0, value: 0.2 },
      { time: 0.5, value: 0.5 },
      { time: 1, value: 0.8 },
    ];
    const next = proposeDragKeyframes(base, [1], 0.5, 0.5, Number.NaN, Number.POSITIVE_INFINITY, (t) => t);
    expect(Number.isFinite(next[1]!.value)).toBe(true);
    expect(next[1]!.value).toBeGreaterThanOrEqual(0);
    expect(next[1]!.value).toBeLessThanOrEqual(1);
  });

  it('invertCurveKeyframeValues mirrors values about 0.5', () => {
    const inverted = invertCurveKeyframeValues([
      { time: 0, value: 0 },
      { time: 0.5, value: 0.25 },
      { time: 1, value: 1 },
    ]);
    expect(inverted[0]!.value).toBeCloseTo(1);
    expect(inverted[1]!.value).toBeCloseTo(0.75);
    expect(inverted[2]!.value).toBeCloseTo(0);
    expect(inverted[0]!.time).toBe(0);
    expect(inverted[2]!.time).toBe(1);
  });

  it('proposeDragKeyframes with time lock moves only time on interior keyframes', () => {
    const base = [
      { time: 0, value: 0 },
      { time: 0.5, value: 0.5 },
      { time: 1, value: 1 },
    ];
    const locked = constrainCurveEditorDragPointer(0.7, 0.9, 0.5, 0.5, 'time');
    const next = proposeDragKeyframes(base, [1], 0.5, 0.5, locked.t, locked.v, (t) => t);
    expect(next[1]!.time).toBeCloseTo(0.7);
    expect(next[1]!.value).toBeCloseTo(0.5);
  });
});

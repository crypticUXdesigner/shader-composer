import { describe, expect, it } from 'vitest';
import {
  clampNormalized01,
  sanitizeAutomationCurveKeyframes,
} from './automationKeyframes';

describe('automationKeyframes', () => {
  it('clampNormalized01 clamps and replaces non-finite values', () => {
    expect(clampNormalized01(1.5)).toBe(1);
    expect(clampNormalized01(-0.2)).toBe(0);
    expect(clampNormalized01(Number.NaN, 0.25)).toBe(0.25);
    expect(clampNormalized01(Number.POSITIVE_INFINITY, 0.5)).toBe(0.5);
  });

  it('sanitizeAutomationCurveKeyframes fixes NaN values and preserves monotonic times', () => {
    const out = sanitizeAutomationCurveKeyframes([
      { time: 0, value: Number.NaN },
      { time: 0.5, value: 2 },
      { time: 1, value: -1 },
    ]);
    expect(out[0]!.time).toBe(0);
    expect(out[0]!.value).toBe(0);
    expect(out[1]!.value).toBe(1);
    expect(out[2]!.time).toBe(1);
    expect(out[2]!.value).toBe(0);
    expect(out[1]!.time).toBeGreaterThan(out[0]!.time);
    expect(out[2]!.time).toBeGreaterThan(out[1]!.time);
  });
});

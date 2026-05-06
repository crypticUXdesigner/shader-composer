/**
 * Tests for automation evaluator.
 * Run: npm test (or npx vitest run src/utils/automationEvaluator.test.ts)
 */

import { describe, it } from 'vitest';
import {
  evaluateCurveAtNormalizedTime,
  findRegionAtTime,
  evaluateAutomationAtTime,
  evaluateLaneAutomationAtTime,
  getAutomationValueForParam,
  sortEvaluableRegions,
  floatMod,
  scaleCurveToParamRange,
} from './automationEvaluator';
import type { NodeGraph, NodeInstance, AutomationRegion, AutomationLane } from '../data-model/types';
import type { AutomationCurve } from '../data-model/types';
import type { ParameterSpec } from '../types/nodeSpec';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}
function assertEqual(actual: number, expected: number, message?: string): void {
  const eps = 1e-6;
  if (Math.abs(actual - expected) > eps) {
    throw new Error(
      `${message || 'Values not equal'}\n  Expected: ${expected}\n  Actual: ${actual}`
    );
  }
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Second implementation of §4.5 lane logic for dense parity checks — update when changing
 * {@link evaluateLaneAutomationAtTime} so both stay aligned.
 */
function evaluateLaneAutomationMirror(
  regions: AutomationRegion[],
  t: number,
  paramSpec?: ParameterSpec
): number | null {
  if (regions.length === 0) return null;

  if (t < regions[0].startTime) {
    return scaleCurveToParamRange(regions[0], 0, paramSpec);
  }

  const n = regions.length;

  for (let i = 0; i < n; i++) {
    const region = regions[i];
    const nextStart = i + 1 < n ? regions[i + 1].startTime : Infinity;

    if (region.loop) {
      if (t >= region.startTime && t < nextStart) {
        const local = floatMod(t - region.startTime, region.duration);
        const s = local / region.duration;
        return scaleCurveToParamRange(region, s, paramSpec);
      }
    } else {
      const end = region.startTime + region.duration;
      const insideEnd = Math.min(end, nextStart);
      if (t >= region.startTime && t < insideEnd) {
        const s = (t - region.startTime) / region.duration;
        return scaleCurveToParamRange(region, clamp01(s), paramSpec);
      }
      if (t >= end && t < nextStart) {
        return scaleCurveToParamRange(region, 1, paramSpec);
      }
    }
  }

  const last = regions[n - 1];
  if (last.loop) {
    const local = floatMod(t - last.startTime, last.duration);
    const s = local / last.duration;
    return scaleCurveToParamRange(last, s, paramSpec);
  }
  return scaleCurveToParamRange(last, 1, paramSpec);
}

// --- Curve evaluation ---
export function testCurveLinear(): void {
  const curve: AutomationCurve = {
    keyframes: [{ time: 0, value: 0 }, { time: 1, value: 1 }],
    interpolation: 'linear',
  };
  assertEqual(evaluateCurveAtNormalizedTime(curve, 0), 0, 't=0');
  assertEqual(evaluateCurveAtNormalizedTime(curve, 0.5), 0.5, 't=0.5');
  assertEqual(evaluateCurveAtNormalizedTime(curve, 1), 1, 't=1');
}

export function testCurveStepped(): void {
  const curve: AutomationCurve = {
    keyframes: [{ time: 0, value: 0 }, { time: 0.5, value: 1 }, { time: 1, value: 0.5 }],
    interpolation: 'stepped',
  };
  assertEqual(evaluateCurveAtNormalizedTime(curve, 0.25), 0, 'stepped first segment');
  assertEqual(evaluateCurveAtNormalizedTime(curve, 0.5), 1, 'stepped at keyframe');
  assertEqual(evaluateCurveAtNormalizedTime(curve, 0.75), 1, 'stepped second segment');
}

export function testCurveEmptyAndSingle(): void {
  const empty: AutomationCurve = { keyframes: [], interpolation: 'linear' };
  assertEqual(evaluateCurveAtNormalizedTime(empty, 0.5), 0, 'empty keyframes');
  const single: AutomationCurve = {
    keyframes: [{ time: 0.5, value: 0.7 }],
    interpolation: 'linear',
  };
  assertEqual(evaluateCurveAtNormalizedTime(single, 0), 0.7, 'single keyframe');
}

// --- Region at time (no loop) ---
export function testFindRegionAtTimeNoLoop(): void {
  const graph: NodeGraph = {
    id: 'g1',
    name: 'Test',
    version: '2.0',
    nodes: [{ id: 'n1', type: 'noise', position: { x: 0, y: 0 }, parameters: {} }],
    connections: [],
    automation: {
      bpm: 120,
      durationSeconds: 30,
      lanes: [
        {
          id: 'lane1',
          nodeId: 'n1',
          paramName: 'noiseScale',
          regions: [
            {
              id: 'r1',
              startTime: 0,
              duration: 10,
              loop: false,
              curve: {
                keyframes: [{ time: 0, value: 0 }, { time: 1, value: 1 }],
                interpolation: 'linear',
              },
            },
          ],
        },
      ],
    },
  };
  const automation = graph.automation!;
  const at5 = findRegionAtTime(automation, 'n1', 'noiseScale', 5);
  assert(at5 !== null, 'should find region at t=5');
  if (at5) {
    assertEqual(at5.normalizedTime, 0.5, 'normalized time at t=5 for 0–10s region');
  }
  const at15 = findRegionAtTime(automation, 'n1', 'noiseScale', 15);
  assert(at15 === null, 't=15 not inside region interior (tail uses hold, no active segment)');
}

// --- evaluateAutomationAtTime: 0–10s linear 0→1, at t=5 → 0.5 (or scaled) ---
export function testEvaluateAutomationAtTime(): void {
  const graph: NodeGraph = {
    id: 'g1',
    name: 'Test',
    version: '2.0',
    nodes: [{ id: 'n1', type: 'noise', position: { x: 0, y: 0 }, parameters: {} }],
    connections: [],
    automation: {
      bpm: 120,
      durationSeconds: 30,
      lanes: [
        {
          id: 'lane1',
          nodeId: 'n1',
          paramName: 'noiseScale',
          regions: [
            {
              id: 'r1',
              startTime: 0,
              duration: 10,
              loop: false,
              curve: {
                keyframes: [{ time: 0, value: 0 }, { time: 1, value: 1 }],
                interpolation: 'linear',
              },
            },
          ],
        },
      ],
    },
  };
  const v5 = evaluateAutomationAtTime(graph, 'n1', 'noiseScale', 5);
  assert(v5 !== null, 'value at t=5 should be non-null');
  if (v5 !== null) assertEqual(v5, 0.5, 'linear 0→1 at t=5 → 0.5 (default param range 0–1)');

  const v15 = evaluateAutomationAtTime(graph, 'n1', 'noiseScale', 15);
  assert(v15 !== null && Math.abs(v15 - 1) < 1e-6, 't=15 after region → tail hold s=1 → 1.0');

  const leadNeg = evaluateAutomationAtTime(graph, 'n1', 'noiseScale', -2);
  assert(
    leadNeg !== null && Math.abs(leadNeg - 0) < 1e-6,
    'negative t lead-in → value(r0, 0)'
  );

  const scaled = evaluateAutomationAtTime(graph, 'n1', 'noiseScale', 5, { type: 'float', default: 1, min: 10, max: 20 });
  assert(scaled !== null, 'scaled value non-null');
  if (scaled !== null) assertEqual(scaled, 15, '0.5 in [10,20] → 15');
}

// --- getAutomationValueForParam ---
export function testGetAutomationValueForParam(): void {
  const node: NodeInstance = {
    id: 'n1',
    type: 'noise',
    position: { x: 0, y: 0 },
    parameters: {},
  };
  const graph: NodeGraph = {
    id: 'g1',
    name: 'Test',
    version: '2.0',
    nodes: [node],
    connections: [],
    automation: {
      bpm: 120,
      durationSeconds: 30,
      lanes: [
        {
          id: 'lane1',
          nodeId: 'n1',
          paramName: 'noiseScale',
          regions: [
            {
              id: 'r1',
              startTime: 0,
              duration: 10,
              loop: false,
              curve: {
                keyframes: [{ time: 0, value: 0 }, { time: 1, value: 1 }],
                interpolation: 'linear',
              },
            },
          ],
        },
      ],
    },
  };
  const v = getAutomationValueForParam(node, 'noiseScale', graph, 5);
  assert(v !== null && Math.abs(v - 0.5) < 1e-6, 'getAutomationValueForParam at t=5 → 0.5');
}

/** Gap hold: value between regions uses previous region endpoint (s=1). */
export function testGapHoldBetweenRegions(): void {
  const graph: NodeGraph = {
    id: 'g-gap',
    name: 'Test',
    version: '2.0',
    nodes: [{ id: 'n1', type: 'noise', position: { x: 0, y: 0 }, parameters: {} }],
    connections: [],
    automation: {
      bpm: 120,
      durationSeconds: 60,
      lanes: [
        {
          id: 'lane1',
          nodeId: 'n1',
          paramName: 'noiseScale',
          regions: [
            {
              id: 'a',
              startTime: 0,
              duration: 10,
              loop: false,
              curve: {
                keyframes: [
                  { time: 0, value: 0 },
                  { time: 1, value: 1 },
                ],
                interpolation: 'linear',
              },
            },
            {
              id: 'b',
              startTime: 20,
              duration: 10,
              loop: false,
              curve: {
                keyframes: [
                  { time: 0, value: 0 },
                  { time: 1, value: 0 },
                ],
                interpolation: 'linear',
              },
            },
          ],
        },
      ],
    },
  };
  const midGap = evaluateAutomationAtTime(graph, 'n1', 'noiseScale', 15);
  assert(midGap !== null && Math.abs(midGap - 1) < 1e-6, 'gap t=15 holds first region end → 1');
}

function graphNoiseLane(regions: AutomationRegion[]): NodeGraph {
  return {
    id: 'g-parity',
    name: 'Test',
    version: '2.0',
    nodes: [{ id: 'n1', type: 'noise', position: { x: 0, y: 0 }, parameters: {} }],
    connections: [],
    automation: {
      bpm: 120,
      durationSeconds: 120,
      lanes: [
        {
          id: 'lane1',
          nodeId: 'n1',
          paramName: 'noiseScale',
          regions,
        },
      ],
    },
  };
}

describe('automationEvaluator', () => {
  it('curve linear', testCurveLinear);
  it('curve stepped', testCurveStepped);
  it('curve empty and single', testCurveEmptyAndSingle);
  it('findRegionAtTime no loop', testFindRegionAtTimeNoLoop);
  it('evaluateAutomationAtTime', testEvaluateAutomationAtTime);
  it('getAutomationValueForParam', testGetAutomationValueForParam);
  it('gap hold between regions', testGapHoldBetweenRegions);
});

describe('lane extrapolation parity & malformed overlap', () => {
  it('dense parity: mirror matches production across sampled t', () => {
    const scenarios: AutomationRegion[][] = [
      [
        {
          id: 'r1',
          startTime: 0,
          duration: 10,
          loop: false,
          curve: {
            keyframes: [
              { time: 0, value: 0 },
              { time: 1, value: 1 },
            ],
            interpolation: 'linear',
          },
        },
      ],
      [
        {
          id: 'a',
          startTime: 0,
          duration: 10,
          loop: false,
          curve: {
            keyframes: [{ time: 0, value: 0 }, { time: 1, value: 1 }],
            interpolation: 'linear',
          },
        },
        {
          id: 'b',
          startTime: 20,
          duration: 10,
          loop: false,
          curve: {
            keyframes: [{ time: 0, value: 0.2 }, { time: 1, value: 0.8 }],
            interpolation: 'bezier',
          },
        },
      ],
      [
        {
          id: 'loop',
          startTime: 2,
          duration: 4,
          loop: true,
          curve: {
            keyframes: [{ time: 0, value: 0 }, { time: 1, value: 1 }],
            interpolation: 'linear',
          },
        },
        {
          id: 'after',
          startTime: 14,
          duration: 2,
          loop: false,
          curve: {
            keyframes: [{ time: 0, value: 0.5 }, { time: 1, value: 0.5 }],
            interpolation: 'linear',
          },
        },
      ],
    ];
    const param: ParameterSpec = { type: 'float', default: 1, min: 10, max: 20 };

    for (const regions of scenarios) {
      for (let ti = -800; ti <= 12000; ti++) {
        const t = ti / 100;
        const a = evaluateLaneAutomationAtTime(regions, t);
        const b = evaluateLaneAutomationMirror(regions, t);
        assertEqual(a ?? NaN, b ?? NaN, `regions=${regions.map((r) => r.id).join(',')} t=${t}`);
        const as = evaluateLaneAutomationAtTime(regions, t, param);
        const bs = evaluateLaneAutomationMirror(regions, t, param);
        assertEqual(as ?? NaN, bs ?? NaN, `scaled t=${t}`);
      }
    }
  });

  it('§4.4 overlap: later start wins interior (malformed graph)', () => {
    const regions: AutomationRegion[] = [
      {
        id: 'a',
        startTime: 0,
        duration: 10,
        loop: false,
        curve: {
          keyframes: [{ time: 0, value: 0 }, { time: 1, value: 1 }],
          interpolation: 'linear',
        },
      },
      {
        id: 'b',
        startTime: 5,
        duration: 10,
        loop: false,
        curve: {
          keyframes: [{ time: 0, value: 0 }, { time: 1, value: 1 }],
          interpolation: 'linear',
        },
      },
    ];
    const sorted = sortEvaluableRegions({ regions } as AutomationLane);
    const g = graphNoiseLane(regions);
    const v3 = evaluateAutomationAtTime(g, 'n1', 'noiseScale', 3);
    assert(v3 !== null && Math.abs(v3 - 0.3) < 1e-5, 't=3 in first region');
    const v7 = evaluateAutomationAtTime(g, 'n1', 'noiseScale', 7);
    assert(v7 !== null && Math.abs(v7 - 0.2) < 1e-5, 't=7 in second region (s=0.2)');
    assertEqual(evaluateLaneAutomationAtTime(sorted, 7)!, evaluateLaneAutomationMirror(sorted, 7)!);
  });

  it('§4.4 same start: greater region id wins', () => {
    const regions: AutomationRegion[] = [
      {
        id: 'a',
        startTime: 0,
        duration: 5,
        loop: false,
        curve: {
          keyframes: [{ time: 0, value: 0 }, { time: 1, value: 0 }],
          interpolation: 'linear',
        },
      },
      {
        id: 'b',
        startTime: 0,
        duration: 5,
        loop: false,
        curve: {
          keyframes: [{ time: 0, value: 0 }, { time: 1, value: 1 }],
          interpolation: 'linear',
        },
      },
    ];
    const g = graphNoiseLane(regions);
    const v2 = evaluateAutomationAtTime(g, 'n1', 'noiseScale', 2);
    assert(v2 !== null && Math.abs(v2 - 0.4) < 1e-5, 'only second region has interior');
  });

  it('loop seam: integer duration cycles land on s≈0', () => {
    const regions: AutomationRegion[] = [
      {
        id: 'L',
        startTime: 0,
        duration: 1,
        loop: true,
        curve: {
          keyframes: [{ time: 0, value: 0.25 }, { time: 1, value: 0.75 }],
          interpolation: 'linear',
        },
      },
    ];
    const g = graphNoiseLane(regions);
    for (let k = 0; k <= 12; k++) {
      const t = k * 1.0;
      const vk = evaluateAutomationAtTime(g, 'n1', 'noiseScale', t);
      const v0 = evaluateAutomationAtTime(g, 'n1', 'noiseScale', 0);
      assert(vk !== null && v0 !== null && Math.abs(vk - v0) < 1e-6, `seam k=${k}`);
    }
  });

  it('loop seam: non-binary duration uses epsilon at k*cycles', () => {
    const duration = 1 / 3;
    const startTime = 1;
    const regions: AutomationRegion[] = [
      {
        id: 'L',
        startTime,
        duration,
        loop: true,
        curve: {
          keyframes: [{ time: 0, value: 0 }, { time: 1, value: 1 }],
          interpolation: 'linear',
        },
      },
    ];
    const sorted = sortEvaluableRegions({ regions } as AutomationLane);
    for (let k = 1; k <= 20; k++) {
      const t = startTime + k * duration;
      const local = floatMod(t - startTime, duration);
      assert(
        Math.abs(local) < 1e-9 || Math.abs(local - duration) < 1e-9,
        `floatMod seam local=${local}`
      );
      const s = local / duration;
      assert(Math.min(s, 1 - s) < 1e-7, `s near 0 or 1 at seam, got ${s}`);
      const v = evaluateLaneAutomationAtTime(sorted, t);
      const m = evaluateLaneAutomationMirror(sorted, t);
      assertEqual(v ?? NaN, m ?? NaN, `parity at seam k=${k} t=${t}`);
    }
  });
});

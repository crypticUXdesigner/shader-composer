/**
 * Tests for automation evaluator (WP 02B).
 * Run: npm test (or npx vitest run src/utils/automationEvaluator.test.ts)
 */

import { describe, it } from 'vitest';
import {
  evaluateCurveAtNormalizedTime,
  findRegionAtTime,
  evaluateAutomationAtTime,
  getAutomationValueForParam,
} from './automationEvaluator';
import type { NodeGraph, NodeInstance } from '../data-model/types';
import type { AutomationCurve } from '../data-model/types';

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
  assert(at15 === null, 't=15 outside region should return null');
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
  assert(v15 === null, 't=15 outside region → null');

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

describe('automationEvaluator', () => {
  it('curve linear', testCurveLinear);
  it('curve stepped', testCurveStepped);
  it('curve empty and single', testCurveEmptyAndSingle);
  it('findRegionAtTime no loop', testFindRegionAtTimeNoLoop);
  it('evaluateAutomationAtTime', testEvaluateAutomationAtTime);
  it('getAutomationValueForParam', testGetAutomationValueForParam);
});

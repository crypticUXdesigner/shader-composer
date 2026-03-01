/**
 * Tests for automation signal helpers.
 * Run: npm test (or npx vitest run src/utils/automationSignals.test.ts)
 */

import { describe, it, expect } from 'vitest';
import type { NodeGraph, NodeInstance } from '../data-model/types';
import type { AutomationCurve } from '../data-model/types';
import type { ParameterSpec } from '../types/nodeSpec';
import {
  evaluateAutomationSignalBindingForParam,
} from './automationSignals';
import {
  evaluateCurveAtNormalizedTime,
  evaluateAutomationAtTime,
} from './automationEvaluator';

function makeCurve(): AutomationCurve {
  return {
    keyframes: [
      { time: 0, value: 0 },
      { time: 1, value: 1 },
    ],
    interpolation: 'linear',
  };
}

function makeParamSpec(overrides: Partial<ParameterSpec> = {}): ParameterSpec {
  return {
    type: 'float',
    default: 0,
    min: 0,
    max: 1,
    ...overrides,
  };
}

describe('automationSignals', () => {
  it('creates automation signal binding and matches evaluator value', () => {
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
                curve: makeCurve(),
              },
            ],
          },
        ],
      },
    };

    const paramSpec = makeParamSpec({ min: 0, max: 1 });
    const t = 5;

    const evaluated = evaluateAutomationSignalBindingForParam(
      node,
      'noiseScale',
      graph,
      t,
      paramSpec,
    );

    expect(evaluated.binding.source.kind).toBe('automation');
    if (evaluated.binding.source.kind === 'automation') {
      expect(evaluated.binding.source.automationId).toBe('n1:noiseScale');
    }

    const direct = evaluateAutomationAtTime(graph, 'n1', 'noiseScale', t, paramSpec);
    expect(evaluated.value).toBeCloseTo(direct ?? 0);
  });

  it('returns null value when automation is inactive', () => {
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
                duration: 2,
                loop: false,
                curve: makeCurve(),
              },
            ],
          },
        ],
      },
    };

    const paramSpec = makeParamSpec({ min: 0, max: 1 });
    const tOutside = 10;

    const evaluated = evaluateAutomationSignalBindingForParam(
      node,
      'noiseScale',
      graph,
      tOutside,
      paramSpec,
    );

    expect(evaluated.value).toBeNull();
  });
});


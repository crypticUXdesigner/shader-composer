/**
 * Tests for computeEffectiveParameterValue using the signal model.
 * Run: npm test (or npx vitest run src/utils/parameterValueCalculator.test.ts)
 */

import { describe, it, expect } from 'vitest';
import type { NodeGraph, NodeInstance } from '../data-model/types';
import type { NodeSpec, ParameterSpec } from '../types/nodeSpec';
import type { IAudioManager } from '../runtime/types';
import { computeEffectiveParameterValue } from './parameterValueCalculator';
import { getVirtualNodeId } from './virtualNodes';

function makeParamSpec(overrides: Partial<ParameterSpec> = {}): ParameterSpec {
  return {
    type: 'float',
    default: 0,
    min: 0,
    max: 1,
    ...overrides,
  };
}

function makeNodeSpec(id: string, params: Record<string, ParameterSpec>): NodeSpec {
  return {
    id,
    displayName: id,
    category: 'Test',
    inputs: [],
    outputs: [],
    parameters: params,
    mainCode: '',
  };
}

describe('computeEffectiveParameterValue with signal model', () => {
  it('uses static config when no automation or connection', () => {
    const node: NodeInstance = {
      id: 'n1',
      type: 'noise',
      position: { x: 0, y: 0 },
      parameters: { gain: 0.25 },
    };
    const graph: NodeGraph = {
      id: 'g1',
      name: 'Test',
      version: '2.0',
      nodes: [node],
      connections: [],
    };
    const paramSpec = makeParamSpec({ default: 0.5, min: 0, max: 1 });
    const nodeSpecs = new Map<string, NodeSpec>([
      ['noise', makeNodeSpec('noise', { gain: paramSpec })],
    ]);

    const value = computeEffectiveParameterValue(
      node,
      'gain',
      paramSpec,
      graph,
      nodeSpecs,
    );

    expect(value).toBeCloseTo(0.25);
  });

  it('prefers automation value over static config when provided', () => {
    const node: NodeInstance = {
      id: 'n1',
      type: 'noise',
      position: { x: 0, y: 0 },
      parameters: { gain: 0.25 },
    };
    const graph: NodeGraph = {
      id: 'g1',
      name: 'Test',
      version: '2.0',
      nodes: [node],
      connections: [],
    };
    const paramSpec = makeParamSpec({ default: 0.5, min: 0, max: 1 });
    const nodeSpecs = new Map<string, NodeSpec>([
      ['noise', makeNodeSpec('noise', { gain: paramSpec })],
    ]);

    const value = computeEffectiveParameterValue(
      node,
      'gain',
      paramSpec,
      graph,
      nodeSpecs,
      undefined,
      0.75,
    );

    expect(value).toBeCloseTo(0.75);
  });

  it('combines automation and graph input using input mode', () => {
    const source: NodeInstance = {
      id: 'src',
      type: 'constant-float',
      position: { x: 0, y: 0 },
      parameters: { value: 2 },
    };
    const target: NodeInstance = {
      id: 'dst',
      type: 'noise',
      position: { x: 0, y: 0 },
      parameters: { gain: 1 },
      parameterInputModes: { gain: 'add' },
    };
    const graph: NodeGraph = {
      id: 'g1',
      name: 'Test',
      version: '2.0',
      nodes: [source, target],
      connections: [
        {
          id: 'c1',
          sourceNodeId: 'src',
          sourcePort: 'out',
          targetNodeId: 'dst',
          targetParameter: 'gain',
        },
      ],
    };
    const gainSpec = makeParamSpec({ default: 1, min: 0, max: 4, inputMode: 'add' });
    const constSpec = makeParamSpec({ default: 0, min: 0, max: 10 });

    const nodeSpecs = new Map<string, NodeSpec>([
      ['constant-float', makeNodeSpec('constant-float', { value: constSpec })],
      ['noise', makeNodeSpec('noise', { gain: gainSpec })],
    ]);

    const value = computeEffectiveParameterValue(
      target,
      'gain',
      gainSpec,
      graph,
      nodeSpecs,
      undefined,
      0.25,
    );

    // automationValue (0.25) is config; input is 2; add mode → 0.25 + 2
    expect(value).toBeCloseTo(2.25);
  });

  it('resolves audio-connected parameter via virtual node input', () => {
    const target: NodeInstance = {
      id: 'dst',
      type: 'noise',
      position: { x: 0, y: 0 },
      parameters: { gain: 1 },
    };

    const virtualNodeId = getVirtualNodeId('band-test-raw');

    const graph: NodeGraph = {
      id: 'g1',
      name: 'Test',
      version: '2.0',
      nodes: [target],
      connections: [
        {
          id: 'c1',
          sourceNodeId: virtualNodeId,
          sourcePort: 'out',
          targetNodeId: 'dst',
          targetParameter: 'gain',
        },
      ],
    };

    const gainSpec = makeParamSpec({ default: 1, min: 0, max: 2, inputMode: 'multiply' });
    const nodeSpecs = new Map<string, NodeSpec>([
      ['noise', makeNodeSpec('noise', { gain: gainSpec })],
    ]);

    const audioManager: IAudioManager = {
      getVirtualNodeLiveValue(id: string): number | null {
        return id === virtualNodeId ? 0.4 : null;
      },
    } as unknown as IAudioManager;

    const value = computeEffectiveParameterValue(
      target,
      'gain',
      gainSpec,
      graph,
      nodeSpecs,
      audioManager,
    );

    // config = 1, input = 0.4, multiply → 0.4
    expect(value).toBeCloseTo(0.4);
  });
});


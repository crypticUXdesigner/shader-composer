import { describe, expect, it } from 'vitest';
import type { AutomationCurveInterpolation, AutomationState, Connection, NodeGraph, NodeInstance } from './types';
import { migrateRadialRepeatSdfParameters } from './radialRepeatSdfMigration';

const node = (partial: Omit<NodeInstance, 'position'> & Partial<Pick<NodeInstance, 'position'>>): NodeInstance => ({
  position: { x: 0, y: 0 },
  parameters: {},
  ...partial,
});

const emptyGraph = (nodes: NodeInstance[], extras?: Partial<NodeGraph>): NodeGraph => ({
  id: 'g',
  name: 'g',
  version: '2.0',
  nodes,
  connections: [],
  ...extras,
});

describe('migrateRadialRepeatSdfParameters', () => {
  it('maps period/halfPeriod to shellSpacing/ringPhase', () => {
    const graph = emptyGraph([
      node({
        id: 'n1',
        type: 'radial-repeat-sdf',
        parameters: { period: 3.5, halfPeriod: 1.75 },
      }),
    ]);
    const m = migrateRadialRepeatSdfParameters(graph);
    expect(m.nodes[0].parameters.shellSpacing).toBe(3.5);
    expect(m.nodes[0].parameters.ringPhase).toBe(0.5);
    expect(m.nodes[0].parameters.period).toBeUndefined();
    expect(m.nodes[0].parameters.halfPeriod).toBeUndefined();
  });

  it('defaults missing halfPeriod to legacy 0.5', () => {
    const graph = emptyGraph([
      node({
        id: 'n1',
        type: 'radial-repeat-sdf',
        parameters: { period: 2.0 },
      }),
    ]);
    const m = migrateRadialRepeatSdfParameters(graph);
    expect(m.nodes[0].parameters.shellSpacing).toBe(2.0);
    expect(m.nodes[0].parameters.ringPhase).toBe(0.25);
  });

  it('is idempotent', () => {
    const graph = emptyGraph([
      node({
        id: 'n1',
        type: 'radial-repeat-sdf',
        parameters: { shellSpacing: 1.0, ringPhase: 0.5 },
      }),
    ]);
    const twice = migrateRadialRepeatSdfParameters(migrateRadialRepeatSdfParameters(graph));
    expect(twice.nodes[0].parameters).toEqual(graph.nodes[0].parameters);
  });

  it('remaps param connections and clamps phase for automation lanes', () => {
    const makeCurve = (
      interpolation: AutomationCurveInterpolation,
      keyframes: { time: number; value: number }[]
    ) => ({ interpolation, keyframes });

    const automation: AutomationState = {
      bpm: 120,
      durationSeconds: 4,
      lanes: [
        {
          id: 'lane-period',
          nodeId: 'n1',
          paramName: 'period',
          regions: [
            {
              id: 'r1',
              startTime: 0,
              duration: 4,
              loop: false,
              curve: makeCurve('linear', [
                { time: 0, value: 3.5 },
                { time: 1, value: 2 },
              ]),
            },
          ],
        },
        {
          id: 'lane-half',
          nodeId: 'n1',
          paramName: 'halfPeriod',
          regions: [
            {
              id: 'r2',
              startTime: 0,
              duration: 4,
              loop: false,
              curve: makeCurve('linear', [
                { time: 0, value: 1.75 },
                { time: 1, value: 0 },
              ]),
            },
          ],
        },
      ],
    };

    const c1: Connection = {
      id: 'wc1',
      sourceNodeId: 'src',
      sourcePort: 'out',
      targetNodeId: 'n1',
      targetParameter: 'period',
    };
    const c2: Connection = {
      id: 'wc2',
      sourceNodeId: 'src2',
      sourcePort: 'out',
      targetNodeId: 'n1',
      targetParameter: 'halfPeriod',
    };

    const graph = emptyGraph(
      [
        node({
          id: 'n1',
          type: 'radial-repeat-sdf',
          parameters: { period: 3.5, halfPeriod: 1.75 },
          parameterInputModes: { period: 'override', halfPeriod: 'add' },
        }),
      ],
      { connections: [c1, c2], automation }
    );

    const m = migrateRadialRepeatSdfParameters(graph);
    expect(m.connections.some((x) => x.targetParameter === 'shellSpacing')).toBe(true);
    expect(m.connections.some((x) => x.targetParameter === 'ringPhase')).toBe(true);
    expect(m.connections.some((x) => x.targetParameter === 'period')).toBe(false);

    const halfLane = m.automation!.lanes.find((l) => l.id === 'lane-half');
    expect(halfLane?.paramName).toBe('ringPhase');
    expect(halfLane?.regions[0].curve.keyframes[0].value).toBeCloseTo(0.5);

    const periodLane = m.automation!.lanes.find((l) => l.id === 'lane-period');
    expect(periodLane?.paramName).toBe('shellSpacing');
    expect(periodLane?.regions[0].curve.keyframes[0].value).toBe(3.5);

    expect(m.nodes[0].parameterInputModes?.shellSpacing).toBe('override');
    expect(m.nodes[0].parameterInputModes?.ringPhase).toBe('add');
  });
});

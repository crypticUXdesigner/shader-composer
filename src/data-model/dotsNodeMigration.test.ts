import { describe, expect, it } from 'vitest';
import type { NodeGraph } from './types';
import { migrateDotsNodeParameterNames } from './dotsNodeMigration';

describe('migrateDotsNodeParameterNames', () => {
  it('migrates falloff→feather, period-spacing→gap, and cell-feather→UV', () => {
    const graph: NodeGraph = {
      id: 'g',
      name: 't',
      version: '2.0',
      nodes: [
        {
          id: 'd1',
          type: 'dots',
          position: { x: 0, y: 0 },
          parameters: { dotsSpacing: 0.1, dotsSize: 0.03, dotsFalloff: 0.05, dotsIntensity: 1 },
        },
      ],
      connections: [],
      metadata: {},
      viewState: { zoom: 1, panX: 0, panY: 0, selectedNodeIds: [] },
    };

    const out = migrateDotsNodeParameterNames(graph);
    const d = out.nodes.find((n) => n.id === 'd1')!;
    expect(d.parameters.dotsSize).toBe(0.03);
    expect(d.parameters.dotsIntensity).toBe(1);
    expect(d.parameters.dotsGap as number).toBeCloseTo(0.04, 10);
    expect(d.parameters.dotsFeather as number).toBeCloseTo(0.005, 10);
    expect(d.parameters).not.toHaveProperty('dotsFalloff');
    expect(d.parameters).not.toHaveProperty('dotsSpacing');
  });

  it('rewires param connections and automation lanes for falloff and dotsSpacing', () => {
    const graph: NodeGraph = {
      id: 'g',
      name: 't',
      version: '2.0',
      nodes: [
        { id: 'src', type: 'constant-float', position: { x: 0, y: 0 }, parameters: { value: 0.2 } },
        {
          id: 'd1',
          type: 'dots',
          position: { x: 0, y: 0 },
          parameters: { dotsFalloff: 0.05, dotsSpacing: 0.2 },
        },
      ],
      connections: [
        {
          id: 'c1',
          sourceNodeId: 'src',
          sourcePort: 'out',
          targetNodeId: 'd1',
          targetParameter: 'dotsFalloff',
        },
        {
          id: 'c2',
          sourceNodeId: 'src',
          sourcePort: 'out',
          targetNodeId: 'd1',
          targetParameter: 'dotsSpacing',
        },
      ],
      automation: {
        bpm: 120,
        durationSeconds: 4,
        lanes: [
          { id: 'l1', nodeId: 'd1', paramName: 'dotsFalloff', regions: [] },
          { id: 'l2', nodeId: 'd1', paramName: 'dotsSpacing', regions: [] },
        ],
      },
      metadata: {},
      viewState: { zoom: 1, panX: 0, panY: 0, selectedNodeIds: [] },
    };

    const out = migrateDotsNodeParameterNames(graph);
    expect(out.connections.map((c) => c.targetParameter)).toEqual(['dotsFeather', 'dotsGap']);
    expect(out.automation?.lanes.map((l) => l.paramName)).toEqual(['dotsFeather', 'dotsGap']);
  });

  it('leaves nodes that already use dotsGap unchanged', () => {
    const graph: NodeGraph = {
      id: 'g',
      name: 't',
      version: '2.0',
      nodes: [
        {
          id: 'd1',
          type: 'dots',
          position: { x: 0, y: 0 },
          parameters: { dotsGap: 0.05, dotsSize: 0.02, dotsFeather: 0.004, dotsIntensity: 1 },
        },
      ],
      connections: [],
      metadata: {},
      viewState: { zoom: 1, panX: 0, panY: 0, selectedNodeIds: [] },
    };

    const out = migrateDotsNodeParameterNames(graph);
    const d = out.nodes.find((n) => n.id === 'd1')!;
    expect(d.parameters).toEqual(graph.nodes[0]!.parameters);
  });
});

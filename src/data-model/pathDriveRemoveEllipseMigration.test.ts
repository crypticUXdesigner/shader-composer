import { describe, expect, it } from 'vitest';
import type { NodeGraph } from './types';
import {
  migratePathDrivePresetValue,
  migratePathDriveRemoveEllipse,
} from './pathDriveRemoveEllipseMigration';

describe('migratePathDrivePresetValue', () => {
  it('maps legacy presets to current indices', () => {
    expect(migratePathDrivePresetValue(0)).toBe(0);
    expect(migratePathDrivePresetValue(1)).toBe(0);
    expect(migratePathDrivePresetValue(2)).toBe(1);
    expect(migratePathDrivePresetValue(3)).toBe(2);
    expect(migratePathDrivePresetValue(4)).toBe(3);
    expect(migratePathDrivePresetValue(5)).toBe(4);
    expect(migratePathDrivePresetValue(9)).toBe(4);
  });
});

describe('migratePathDriveRemoveEllipse', () => {
  it('remaps pathPreset on nodes and automation keyframes', () => {
    const graph: NodeGraph = {
      nodes: [
        {
          id: 'pd1',
          type: 'path-drive',
          position: { x: 0, y: 0 },
          parameters: { pathPreset: 5, aspect: 1.5 },
        },
        {
          id: 'n2',
          type: 'final-output',
          position: { x: 0, y: 0 },
          parameters: {},
        },
      ],
      connections: [],
      automation: {
        bpm: 120,
        durationSeconds: 10,
        lanes: [
          {
            id: 'lane-pd',
            nodeId: 'pd1',
            paramName: 'pathPreset',
            regions: [
              {
                id: 'r1',
                startTime: 0,
                duration: 10,
                curve: {
                  keyframes: [
                    { time: 0, value: 2 },
                    { time: 5, value: 1 },
                  ],
                },
              },
            ],
          },
        ],
      },
    };

    const out = migratePathDriveRemoveEllipse(graph);
    expect(out.nodes[0].parameters.pathPreset).toBe(4);
    expect(out.nodes[0].parameters.aspect).toBe(1.5);
    expect(out.automation?.lanes[0].regions[0].curve.keyframes[0].value).toBe(1);
    expect(out.automation?.lanes[0].regions[0].curve.keyframes[1].value).toBe(0);
  });
});

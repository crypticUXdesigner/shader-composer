import { describe, expect, it } from 'vitest';
import type { ParameterInputMode } from '../types/nodeSpec';
import type { AutomationLane, AutomationRegion, NodeGraph } from './types';
import { migrateStreakNodeAngleToDegrees } from './streakNodeMigration';

const baseGraph = (): Pick<NodeGraph, 'id' | 'name' | 'version'> => ({
  id: 'g',
  name: 'g',
  version: '2.0'
});

describe('migrateStreakNodeAngleToDegrees', () => {
  it('maps legacy radians to streakAngleDeg and drops streakAngle', () => {
    const graph = migrateStreakNodeAngleToDegrees({
      ...baseGraph(),
      nodes: [
        {
          id: 'n1',
          type: 'streak',
          position: { x: 0, y: 0 },
          parameters: { streakAngle: Math.PI / 2, streakStretch: 2, streakWidth: 0.15, streakIntensity: 1 }
        }
      ],
      connections: []
    });

    expect(graph.nodes[0].parameters?.streakAngleDeg).toBeCloseTo(90, 5);
    expect(graph.nodes[0].parameters?.streakAngle).toBeUndefined();
  });

  it('remaps param connections and automation lanes', () => {
    const lane: AutomationLane = {
      id: 'lane1',
      nodeId: 'n1',
      paramName: 'streakAngle',
      regions: []
    };
    const migrated = migrateStreakNodeAngleToDegrees({
      ...baseGraph(),
      nodes: [
        {
          id: 'n1',
          type: 'streak',
          position: { x: 0, y: 0 },
          parameters: { streakAngle: 0 },
          parameterInputModes: { streakAngle: 'override' as ParameterInputMode }
        }
      ],
      connections: [
        {
          id: 'c1',
          sourceNodeId: 'other',
          sourcePort: 'out',
          targetNodeId: 'n1',
          targetParameter: 'streakAngle'
        }
      ],
      automation: { bpm: 120, durationSeconds: 4, lanes: [lane] }
    });

    expect(migrated.connections[0].targetParameter).toBe('streakAngleDeg');
    expect(migrated.automation?.lanes[0].paramName).toBe('streakAngleDeg');
    expect(migrated.nodes[0].parameterInputModes?.streakAngleDeg).toBe('override');
    expect(migrated.nodes[0].parameterInputModes?.streakAngle).toBeUndefined();
  });

  it('scales streakAngle automation keyframes from radians to degrees', () => {
    const region: AutomationRegion = {
      id: 'r1',
      startTime: 0,
      duration: 4,
      loop: false,
      curve: {
        interpolation: 'linear',
        keyframes: [
          { time: 0, value: Math.PI / 4 },
          { time: 1, value: Math.PI / 2 }
        ]
      }
    };
    const migrated = migrateStreakNodeAngleToDegrees({
      ...baseGraph(),
      nodes: [{ id: 'n1', type: 'streak', position: { x: 0, y: 0 }, parameters: {} }],
      connections: [],
      automation: {
        bpm: 120,
        durationSeconds: 16,
        lanes: [
          { id: 'lane1', nodeId: 'n1', paramName: 'streakAngle', regions: [region] }
        ]
      }
    });

    const lane = migrated.automation?.lanes[0];
    expect(lane?.paramName).toBe('streakAngleDeg');
    expect(lane?.regions[0].curve.keyframes[0].value).toBeCloseTo(45, 5);
    expect(lane?.regions[0].curve.keyframes[1].value).toBeCloseTo(90, 5);
  });

  it('does not remap non-streak nodes', () => {
    const g = migrateStreakNodeAngleToDegrees({
      ...baseGraph(),
      nodes: [{ id: 'n1', type: 'noise', position: { x: 0, y: 0 }, parameters: {} }],
      connections: []
    });
    expect(g.nodes[0].type).toBe('noise');
  });
});

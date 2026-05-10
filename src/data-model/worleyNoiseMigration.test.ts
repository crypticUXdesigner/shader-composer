import { describe, it, expect } from 'vitest';
import {
  LEGACY_WORLEY_DRIFT_AMOUNT,
  LEGACY_WORLEY_DRIFT_DIRECTION_DEG,
  migrateWorleyNoiseToVoronoi
} from './worleyNoiseMigration';
import type { NodeGraph } from './types';

describe('migrateWorleyNoiseToVoronoi', () => {
  it('converts worley-noise to voronoi-noise with drift matching legacy UV scroll', () => {
    const graph: NodeGraph = {
      id: 'g',
      name: 't',
      version: '2.0',
      nodes: [
        {
          id: 'w1',
          type: 'worley-noise',
          position: { x: 0, y: 0 },
          parameters: {
            worleyScale: 3,
            worleyJitter: 0.9,
            worleyDistanceMetric: 1,
            worleyOutputMode: 2,
            worleyTimeSpeed: 0.4,
            worleyTimeOffset: -1,
            worleyIntensity: 0.7
          }
        }
      ],
      connections: []
    };
    const g = migrateWorleyNoiseToVoronoi(graph);
    const n = g.nodes[0];
    expect(n.type).toBe('voronoi-noise');
    expect(n.parameters.voronoiScale).toBe(3);
    expect(n.parameters.voronoiJitter).toBe(0.9);
    expect(n.parameters.voronoiDistanceMetric).toBe(1);
    expect(n.parameters.voronoiOutputMode).toBe(2);
    expect(n.parameters.voronoiTimeSpeed).toBe(0.4);
    expect(n.parameters.voronoiTimeOffset).toBe(-1);
    expect(n.parameters.voronoiIntensity).toBe(0.7);
    expect(n.parameters.voronoiAnimationMode).toBe(0);
    expect(n.parameters.voronoiRotationSpeed).toBe(30);
    expect(n.parameters.voronoiDriftDirection).toBe(LEGACY_WORLEY_DRIFT_DIRECTION_DEG);
    expect(n.parameters.voronoiDriftAmount).toBe(LEGACY_WORLEY_DRIFT_AMOUNT);
  });

  it('remaps parameter automation lanes', () => {
    const graph: NodeGraph = {
      id: 'g',
      name: 't',
      version: '2.0',
      nodes: [{ id: 'w1', type: 'worley-noise', position: { x: 0, y: 0 }, parameters: {} }],
      connections: [],
      automation: {
        bpm: 120,
        durationSeconds: 60,
        lanes: [
          {
            id: 'lane1',
            nodeId: 'w1',
            paramName: 'worleyScale',
            regions: [
              {
                id: 'r1',
                startTime: 0,
                duration: 10,
                loop: false,
                curve: { interpolation: 'linear', keyframes: [{ time: 0, value: 2 }] }
              }
            ]
          }
        ]
      }
    };
    const g = migrateWorleyNoiseToVoronoi(graph);
    expect(g.automation?.lanes[0]?.paramName).toBe('voronoiScale');
  });

  it('returns the same reference when no worley nodes', () => {
    const graph: NodeGraph = {
      id: 'g',
      name: 't',
      version: '2.0',
      nodes: [{ id: 'u', type: 'uv-coordinates', position: { x: 0, y: 0 }, parameters: {} }],
      connections: []
    };
    expect(migrateWorleyNoiseToVoronoi(graph)).toBe(graph);
  });
});

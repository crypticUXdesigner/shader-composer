import { describe, it, expect } from 'vitest';
import type { NodeGraph } from './types';
import {
  migrateLegacyStripeParameters,
  migrateUnifiedStripesPattern,
  migrateWavePatternsTypeRename
} from './stripesPatternUnificationMigration';

describe('migrateUnifiedStripesPattern', () => {
  it('renames wave-patterns to stripes and drops sunbeams nodes', () => {
    const graph: NodeGraph = {
      id: 'g',
      name: 't',
      version: '2.0',
      nodes: [
        { id: 'u', type: 'uv-coordinates', position: { x: 0, y: 0 }, parameters: {} },
        {
          id: 'w',
          type: 'wave-patterns',
          position: { x: 0, y: 0 },
          parameters: {
            waveScale: 1,
            waveFrequency: 6,
            waveAmplitude: 1,
            waveType: 0,
            waveDirection: 30,
            wavePhaseSpeed: 1,
            wavePhaseOffset: 0,
            waveTimeSpeed: 1,
            waveIntensity: 0.5,
            waveTimeOffset: 0,
          },
          parameterInputModes: {},
        },
        {
          id: 's',
          type: 'sunbeams',
          position: { x: 1, y: 0 },
          parameters: {},
          parameterInputModes: {},
        },
      ],
      connections: [{ id: 'c1', sourceNodeId: 'u', sourcePort: 'out', targetNodeId: 'w', targetPort: 'in' }],
    };
    const g = migrateUnifiedStripesPattern(graph);
    expect(g.nodes.map((n) => n.type)).toEqual(['uv-coordinates', 'stripes']);
    expect(g.nodes.find((n) => n.id === 'w')?.type).toBe('stripes');
    expect(g.connections).toHaveLength(1);
  });

  it('maps legacy fract stripe parameters onto wave stripe parameters', () => {
    const graph: NodeGraph = {
      id: 'g',
      name: 't',
      version: '2.0',
      nodes: [
        {
          id: 'st',
          type: 'stripes',
          position: { x: 0, y: 0 },
          parameters: {
            stripesAngle: 37,
            stripesFrequency: 11,
            stripesSharpness: 1,
            stripesIntensity: 0.95,
            stripesPhase: 0.4,
            stripesTimeSpeed: 0.05,
          },
          parameterInputModes: {},
        },
      ],
      connections: [],
    };
    const g = migrateUnifiedStripesPattern(graph);
    const p = g.nodes[0]?.parameters as Record<string, number>;
    expect(p.waveFrequency).toBeCloseTo(11);
    expect(p.waveDirection).toBeCloseTo(37);
    expect(p.waveType).toBe(2);
    expect(p.stripesAngle).toBeUndefined();
  });
});

describe('migrateLegacyStripeParameters', () => {
  it('soft sharpness maps to sine-like wave type', () => {
    const p = migrateLegacyStripeParameters({ stripesSharpness: 0.2, stripesFrequency: 4 });
    expect(p.waveType).toBe(0);
  });
});

describe('migrateWavePatternsTypeRename', () => {
  it('is a no-op when no wave-patterns nodes exist', () => {
    const graph: NodeGraph = {
      id: 'g',
      name: 't',
      version: '2.0',
      nodes: [{ id: 'x', type: 'uv-coordinates', position: { x: 0, y: 0 }, parameters: {}, parameterInputModes: {} }],
      connections: [],
    };
    expect(migrateWavePatternsTypeRename(graph)).toBe(graph);
  });
});

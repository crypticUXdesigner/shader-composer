import { describe, it, expect } from 'vitest';
import { migrateParticleSystemFoldScale } from './particleSystemGrainMigration';
import type { NodeGraph } from './types';

describe('migrateParticleSystemFoldScale', () => {
  it('folds particleScale into particleCellSize and strips scale wiring', () => {
    const graph: NodeGraph = {
      id: 'g',
      name: 'g',
      version: '2.0',
      nodes: [
        { id: 'a', type: 'constant-float', position: { x: 0, y: 0 }, parameters: { value: 2 } },
        {
          id: 'p',
          type: 'particle-system',
          position: { x: 0, y: 0 },
          parameters: { particleCellSize: 0.5, particleScale: 2.0 },
          parameterInputModes: { particleScale: 'override' }
        }
      ],
      connections: [
        {
          id: 'c1',
          sourceNodeId: 'a',
          sourcePort: 'out',
          targetNodeId: 'p',
          targetParameter: 'particleScale'
        }
      ]
    };

    const out = migrateParticleSystemFoldScale(graph);
    const n = out.nodes.find((x) => x.id === 'p')!;
    expect(n.parameters.particleCellSize).toBeCloseTo(0.25);
    expect('particleScale' in n.parameters).toBe(false);
    expect(n.parameterInputModes).toBeUndefined();
    expect(out.connections).toHaveLength(0);
  });

  it('is a noop when particleScale is absent', () => {
    const graph: NodeGraph = {
      id: 'g',
      name: 'g',
      version: '2.0',
      nodes: [
        {
          id: 'p',
          type: 'particle-system',
          position: { x: 0, y: 0 },
          parameters: { particleCellSize: 0.25 }
        }
      ],
      connections: []
    };
    const out = migrateParticleSystemFoldScale(graph);
    expect(out).toEqual(graph);
  });
});

import { describe, expect, it } from 'vitest';
import { migrateIridescentTunnelCenter } from './iridescentTunnelCenterMigration';

describe('migrateIridescentTunnelCenter', () => {
  it('remaps legacy default (0.5, 0.5) to (0, 0)', () => {
    const g = migrateIridescentTunnelCenter({
      id: 'g',
      name: '',
      version: '2.0',
      nodes: [
        {
          id: 't',
          type: 'iridescent-tunnel',
          position: { x: 0, y: 0 },
          parameters: { centerX: 0.5, centerY: 0.5, repetitionScale: 0.3 },
        },
      ],
      connections: [],
    });
    const n = g.nodes.find((x) => x.id === 't');
    expect(n?.parameters.centerX).toBe(0);
    expect(n?.parameters.centerY).toBe(0);
    expect(n?.parameters.repetitionScale).toBe(0.3);
  });

  it('does not remap tuned centers away from legacy default', () => {
    const g = migrateIridescentTunnelCenter({
      id: 'g',
      name: '',
      version: '2.0',
      nodes: [
        {
          id: 't',
          type: 'iridescent-tunnel',
          position: { x: 0, y: 0 },
          parameters: { centerX: 0.2, centerY: 0.72 },
        },
      ],
      connections: [],
    });
    expect(g.nodes[0]?.parameters.centerX).toBe(0.2);
    expect(g.nodes[0]?.parameters.centerY).toBe(0.72);
  });
});

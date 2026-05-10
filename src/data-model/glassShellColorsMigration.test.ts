/**
 * Tests for Glass Shell RGB → OKLCH color migration.
 */
import { describe, it, expect } from 'vitest';
import { migrateGlassShellColors } from './glassShellColorsMigration';
import { linearRgbToOklch } from '../utils/colorConversion';
import type { NodeGraph } from './types';

function conn(
  id: string,
  sourceNodeId: string,
  targetNodeId: string,
  targetParameter: string
): {
  id: string;
  sourceNodeId: string;
  sourcePort: string;
  targetNodeId: string;
  targetParameter: string;
} {
  return { id, sourceNodeId, sourcePort: 'out', targetNodeId, targetParameter };
}

describe('migrateGlassShellColors', () => {
  it('rewrites glass-shell RGB params to OKLCH and updates RGB channel connections', () => {
    const graph: NodeGraph = {
      id: 'g1',
      name: 'Test',
      version: '2.0',
      nodes: [
        {
          id: 'gsh',
          type: 'glass-shell',
          position: { x: 0, y: 0 },
          parameters: {
            outerSteps: 24,
            innerSteps: 20,
            innerColorR: 0.9,
            innerColorG: 0.85,
            innerColorB: 0.8,
            bgR: 0.05,
            bgG: 0.05,
            bgB: 0.08,
          },
        },
        {
          id: 'n1',
          type: 'multiply',
          position: { x: 100, y: 0 },
          parameters: {},
        },
      ],
      connections: [
        conn('c1', 'n1', 'gsh', 'innerColorG'),
        conn('c2', 'n1', 'gsh', 'bgR'),
      ],
      metadata: {},
      viewState: { zoom: 1, panX: 0, panY: 0, selectedNodeIds: [] },
    };

    const out = migrateGlassShellColors(graph);
    const node = out.nodes.find((n) => n.id === 'gsh')!;

    for (const legacyKey of ['innerColorR', 'innerColorG', 'innerColorB', 'bgR', 'bgG', 'bgB']) {
      expect(node.parameters).not.toHaveProperty(legacyKey);
    }

    const expectedInner = linearRgbToOklch(0.9, 0.85, 0.8);
    expect(node.parameters.innerL as number).toBeCloseTo(expectedInner.l, 5);
    expect(node.parameters.innerC as number).toBeCloseTo(expectedInner.c, 5);
    expect(node.parameters.innerH as number).toBeCloseTo(expectedInner.h, 5);

    const expectedBg = linearRgbToOklch(0.05, 0.05, 0.08);
    expect(node.parameters.bgL as number).toBeCloseTo(expectedBg.l, 5);
    expect(node.parameters.bgC as number).toBeCloseTo(expectedBg.c, 5);
    expect(node.parameters.bgH as number).toBeCloseTo(expectedBg.h, 5);

    expect(out.connections.find((c) => c.id === 'c1')!.targetParameter).toBe('innerC');
    expect(out.connections.find((c) => c.id === 'c2')!.targetParameter).toBe('bgL');
  });

  it('returns the same graph reference when no legacy RGB params or connections exist', () => {
    const graph: NodeGraph = {
      id: 'g1',
      name: 'Test',
      version: '2.0',
      nodes: [
        {
          id: 'gsh',
          type: 'glass-shell',
          position: { x: 0, y: 0 },
          parameters: { outerSteps: 24, innerL: 0.5, innerC: 0.1, innerH: 200, bgL: 0.2 },
        },
      ],
      connections: [],
      metadata: {},
      viewState: { zoom: 1, panX: 0, panY: 0, selectedNodeIds: [] },
    };

    expect(migrateGlassShellColors(graph)).toBe(graph);
  });
});

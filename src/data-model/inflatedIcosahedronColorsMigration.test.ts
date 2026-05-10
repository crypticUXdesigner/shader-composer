/**
 * Tests for Inflated Icosahedron background RGB -> OKLCH color migration.
 */
import { describe, it, expect } from 'vitest';
import { migrateInflatedIcosahedronColors } from './inflatedIcosahedronColorsMigration';
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

describe('migrateInflatedIcosahedronColors', () => {
  it('rewrites inflated-icosahedron background RGB params to OKLCH and updates RGB channel connections', () => {
    const graph: NodeGraph = {
      id: 'g1',
      name: 'Test',
      version: '2.0',
      nodes: [
        {
          id: 'i1',
          type: 'inflated-icosahedron',
          position: { x: 0, y: 0 },
          parameters: {
            timeScale: 1.0,
            bgInnerR: 0.8,
            bgInnerG: 0.8,
            bgInnerB: 0.9,
            bgOuterR: 0.35,
            bgOuterG: 0.5,
            bgOuterB: 0.65,
            bgFalloff: 1.5,
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
        conn('c1', 'n1', 'i1', 'bgInnerR'),
        conn('c2', 'n1', 'i1', 'bgOuterG'),
      ],
      metadata: {},
      viewState: { zoom: 1, panX: 0, panY: 0, selectedNodeIds: [] },
    };

    const out = migrateInflatedIcosahedronColors(graph);
    const node = out.nodes.find((n) => n.id === 'i1')!;

    for (const legacyKey of [
      'bgInnerR',
      'bgInnerG',
      'bgInnerB',
      'bgOuterR',
      'bgOuterG',
      'bgOuterB',
    ]) {
      expect(node.parameters).not.toHaveProperty(legacyKey);
    }

    const expectedInner = linearRgbToOklch(0.8, 0.8, 0.9);
    expect(node.parameters.bgInnerL as number).toBeCloseTo(expectedInner.l, 5);
    expect(node.parameters.bgInnerC as number).toBeCloseTo(expectedInner.c, 5);
    expect(node.parameters.bgInnerH as number).toBeCloseTo(expectedInner.h, 5);

    const expectedOuter = linearRgbToOklch(0.35, 0.5, 0.65);
    expect(node.parameters.bgOuterL as number).toBeCloseTo(expectedOuter.l, 5);
    expect(node.parameters.bgOuterC as number).toBeCloseTo(expectedOuter.c, 5);
    expect(node.parameters.bgOuterH as number).toBeCloseTo(expectedOuter.h, 5);

    expect(node.parameters.timeScale).toBe(1.0);
    expect(node.parameters.bgFalloff).toBe(1.5);

    const c1 = out.connections.find((c) => c.id === 'c1')!;
    const c2 = out.connections.find((c) => c.id === 'c2')!;
    expect(c1.targetParameter).toBe('bgInnerL');
    expect(c2.targetParameter).toBe('bgOuterC');
  });

  it('returns the same graph reference when no legacy RGB params or connections exist', () => {
    const graph: NodeGraph = {
      id: 'g1',
      name: 'Test',
      version: '2.0',
      nodes: [
        {
          id: 'i1',
          type: 'inflated-icosahedron',
          position: { x: 0, y: 0 },
          parameters: {
            bgInnerL: 0.93,
            bgInnerC: 0.017,
            bgInnerH: 286,
            bgOuterL: 0.78,
            bgOuterC: 0.045,
            bgOuterH: 244,
            bgFalloff: 1.5,
          },
        },
      ],
      connections: [],
      metadata: {},
      viewState: { zoom: 1, panX: 0, panY: 0, selectedNodeIds: [] },
    };

    const out = migrateInflatedIcosahedronColors(graph);
    expect(out).toBe(graph);
  });

  it('returns the same graph reference when no inflated-icosahedron nodes exist', () => {
    const graph: NodeGraph = {
      id: 'g1',
      name: 'Test',
      version: '2.0',
      nodes: [
        { id: 'n1', type: 'multiply', position: { x: 0, y: 0 }, parameters: {} },
      ],
      connections: [],
      metadata: {},
      viewState: { zoom: 1, panX: 0, panY: 0, selectedNodeIds: [] },
    };

    const out = migrateInflatedIcosahedronColors(graph);
    expect(out).toBe(graph);
  });

  it('migrates parameterInputModes from RGB channel keys to the matching OKLCH keys', () => {
    const graph: NodeGraph = {
      id: 'g1',
      name: 'Test',
      version: '2.0',
      nodes: [
        {
          id: 'i1',
          type: 'inflated-icosahedron',
          position: { x: 0, y: 0 },
          parameters: {
            bgInnerR: 0.8,
            bgInnerG: 0.8,
            bgInnerB: 0.9,
          },
          parameterInputModes: {
            bgInnerR: 'override',
            bgOuterG: 'override',
          },
        },
      ],
      connections: [],
      metadata: {},
      viewState: { zoom: 1, panX: 0, panY: 0, selectedNodeIds: [] },
    };

    const out = migrateInflatedIcosahedronColors(graph);
    const node = out.nodes.find((n) => n.id === 'i1')!;

    expect(node.parameterInputModes).toBeDefined();
    expect(node.parameterInputModes!.bgInnerL).toBe('override');
    expect(node.parameterInputModes!.bgOuterC).toBe('override');
    expect(node.parameterInputModes).not.toHaveProperty('bgInnerR');
    expect(node.parameterInputModes).not.toHaveProperty('bgOuterG');
  });
});

/**
 * Tests for Bloom Sphere RGB -> OKLCH migration.
 */
import { describe, it, expect } from 'vitest';
import { migrateBloomSphereColors } from './bloomSphereColorsMigration';
import { linearRgbToOklch } from '../utils/colorConversion';
import type { NodeGraph } from './types';

function conn(
  id: string,
  sourceNodeId: string,
  targetNodeId: string,
  targetParameter: string
): { id: string; sourceNodeId: string; sourcePort: string; targetNodeId: string; targetParameter: string } {
  return { id, sourceNodeId, sourcePort: 'out', targetNodeId, targetParameter };
}

describe('migrateBloomSphereColors', () => {
  it('rewrites bloom-sphere RGB params to OKLCH and updates RGB channel connections', () => {
    const graph: NodeGraph = {
      id: 'g1',
      name: 'Test',
      version: '2.0',
      nodes: [
        {
          id: 'b1',
          type: 'bloom-sphere',
          position: { x: 0, y: 0 },
          parameters: {
            outerR: 0.28,
            outerG: 0.42,
            outerB: 0.4,
            innerR: 0.88,
            innerG: 0.54,
            innerB: 0.58,
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
        conn('c1', 'n1', 'b1', 'outerR'),
        conn('c2', 'n1', 'b1', 'innerG'),
      ],
      metadata: {},
      viewState: { zoom: 1, panX: 0, panY: 0, selectedNodeIds: [] },
    };

    const out = migrateBloomSphereColors(graph);

    const outNode = out.nodes.find((n) => n.id === 'b1')!;
    expect(outNode.parameters).not.toHaveProperty('outerR');
    expect(outNode.parameters).not.toHaveProperty('outerG');
    expect(outNode.parameters).not.toHaveProperty('outerB');
    expect(outNode.parameters).not.toHaveProperty('innerR');
    expect(outNode.parameters).not.toHaveProperty('innerG');
    expect(outNode.parameters).not.toHaveProperty('innerB');

    const expectedOuter = linearRgbToOklch(0.28, 0.42, 0.4);
    expect(outNode.parameters.outerL as number).toBeCloseTo(expectedOuter.l, 5);
    expect(outNode.parameters.outerC as number).toBeCloseTo(expectedOuter.c, 5);
    expect(outNode.parameters.outerH as number).toBeCloseTo(expectedOuter.h, 5);

    const expectedInner = linearRgbToOklch(0.88, 0.54, 0.58);
    expect(outNode.parameters.innerL as number).toBeCloseTo(expectedInner.l, 5);
    expect(outNode.parameters.innerC as number).toBeCloseTo(expectedInner.c, 5);
    expect(outNode.parameters.innerH as number).toBeCloseTo(expectedInner.h, 5);

    const c1 = out.connections.find((c) => c.id === 'c1')!;
    const c2 = out.connections.find((c) => c.id === 'c2')!;
    expect(c1.targetParameter).toBe('outerL');
    expect(c2.targetParameter).toBe('innerC');
  });

  it('rewrites bloom-sphere legacy mode RGB params (classicOuterGlow/InnerGlow) to OKLCH', () => {
    const graph: NodeGraph = {
      id: 'g1',
      name: 'Test',
      version: '2.0',
      nodes: [
        {
          id: 'b1',
          type: 'bloom-sphere',
          position: { x: 0, y: 0 },
          parameters: {
            classicOuterGlowR: 0.2,
            classicOuterGlowG: 0.4,
            classicOuterGlowB: 0.9,
            classicInnerGlowR: 0.9,
            classicInnerGlowG: 0.2,
            classicInnerGlowB: 0.2,
          },
        },
      ],
      connections: [],
      metadata: {},
      viewState: { zoom: 1, panX: 0, panY: 0, selectedNodeIds: [] },
    };

    const out = migrateBloomSphereColors(graph);
    const outNode = out.nodes.find((n) => n.id === 'b1')!;

    expect(outNode.parameters).not.toHaveProperty('classicOuterGlowR');
    expect(outNode.parameters).not.toHaveProperty('classicOuterGlowG');
    expect(outNode.parameters).not.toHaveProperty('classicOuterGlowB');
    expect(outNode.parameters).not.toHaveProperty('classicInnerGlowR');
    expect(outNode.parameters).not.toHaveProperty('classicInnerGlowG');
    expect(outNode.parameters).not.toHaveProperty('classicInnerGlowB');

    const expectedOuter = linearRgbToOklch(0.2, 0.4, 0.9);
    expect(outNode.parameters.outerL as number).toBeCloseTo(expectedOuter.l, 5);
    expect(outNode.parameters.outerC as number).toBeCloseTo(expectedOuter.c, 5);
    expect(outNode.parameters.outerH as number).toBeCloseTo(expectedOuter.h, 5);

    const expectedInner = linearRgbToOklch(0.9, 0.2, 0.2);
    expect(outNode.parameters.innerL as number).toBeCloseTo(expectedInner.l, 5);
    expect(outNode.parameters.innerC as number).toBeCloseTo(expectedInner.c, 5);
    expect(outNode.parameters.innerH as number).toBeCloseTo(expectedInner.h, 5);
  });

  it('returns unchanged graph when no legacy bloom-sphere color params exist', () => {
    const graph: NodeGraph = {
      id: 'g1',
      name: 'Test',
      version: '2.0',
      nodes: [
        {
          id: 'b1',
          type: 'bloom-sphere',
          position: { x: 0, y: 0 },
          parameters: {
            outerL: 0.7,
            outerC: 0.1,
            outerH: 10,
            innerL: 0.6,
            innerC: 0.2,
            innerH: 20,
          },
        },
      ],
      connections: [],
      metadata: {},
      viewState: { zoom: 1, panX: 0, panY: 0, selectedNodeIds: [] },
    };

    const out = migrateBloomSphereColors(graph);
    expect(out).toBe(graph);
  });
});


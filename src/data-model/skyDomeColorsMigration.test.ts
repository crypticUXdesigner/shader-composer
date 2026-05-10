/**
 * Tests for Sky Dome RGB -> OKLCH color migration.
 */
import { describe, it, expect } from 'vitest';
import { migrateSkyDomeColors } from './skyDomeColorsMigration';
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

describe('migrateSkyDomeColors', () => {
  it('rewrites sky-dome RGB params to OKLCH and updates RGB channel connections', () => {
    const graph: NodeGraph = {
      id: 'g1',
      name: 'Test',
      version: '2.0',
      nodes: [
        {
          id: 's1',
          type: 'sky-dome',
          position: { x: 0, y: 0 },
          parameters: {
            zenithR: 0.15,
            zenithG: 0.25,
            zenithB: 0.55,
            horizonR: 0.7,
            horizonG: 0.75,
            horizonB: 0.9,
            horizonSharpness: 0.5,
            sunDirX: 0.0,
            sunDirY: 0.9,
            sunDirZ: -0.44,
            sunRadius: 0.02,
            sunIntensity: 1.5,
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
        conn('c1', 'n1', 's1', 'zenithR'),
        conn('c2', 'n1', 's1', 'horizonG'),
      ],
      metadata: {},
      viewState: { zoom: 1, panX: 0, panY: 0, selectedNodeIds: [] },
    };

    const out = migrateSkyDomeColors(graph);
    const skyNode = out.nodes.find((n) => n.id === 's1')!;

    for (const legacyKey of ['zenithR', 'zenithG', 'zenithB', 'horizonR', 'horizonG', 'horizonB']) {
      expect(skyNode.parameters).not.toHaveProperty(legacyKey);
    }

    const expectedZenith = linearRgbToOklch(0.15, 0.25, 0.55);
    expect(skyNode.parameters.zenithL as number).toBeCloseTo(expectedZenith.l, 5);
    expect(skyNode.parameters.zenithC as number).toBeCloseTo(expectedZenith.c, 5);
    expect(skyNode.parameters.zenithH as number).toBeCloseTo(expectedZenith.h, 5);

    const expectedHorizon = linearRgbToOklch(0.7, 0.75, 0.9);
    expect(skyNode.parameters.horizonL as number).toBeCloseTo(expectedHorizon.l, 5);
    expect(skyNode.parameters.horizonC as number).toBeCloseTo(expectedHorizon.c, 5);
    expect(skyNode.parameters.horizonH as number).toBeCloseTo(expectedHorizon.h, 5);

    expect(skyNode.parameters.horizonSharpness).toBe(0.5);
    expect(skyNode.parameters.sunIntensity).toBe(1.5);

    const c1 = out.connections.find((c) => c.id === 'c1')!;
    const c2 = out.connections.find((c) => c.id === 'c2')!;
    expect(c1.targetParameter).toBe('zenithL');
    expect(c2.targetParameter).toBe('horizonC');
  });

  it('returns the same graph reference when no legacy RGB params or connections exist', () => {
    const graph: NodeGraph = {
      id: 'g1',
      name: 'Test',
      version: '2.0',
      nodes: [
        {
          id: 's1',
          type: 'sky-dome',
          position: { x: 0, y: 0 },
          parameters: {
            zenithL: 0.6,
            zenithC: 0.1,
            zenithH: 263,
            horizonL: 0.9,
            horizonC: 0.03,
            horizonH: 270,
            horizonSharpness: 0.5,
          },
        },
      ],
      connections: [],
      metadata: {},
      viewState: { zoom: 1, panX: 0, panY: 0, selectedNodeIds: [] },
    };

    const out = migrateSkyDomeColors(graph);
    expect(out).toBe(graph);
  });

  it('returns the same graph reference when no sky-dome nodes exist', () => {
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

    const out = migrateSkyDomeColors(graph);
    expect(out).toBe(graph);
  });

  it('migrates parameterInputModes from RGB channel keys to the matching OKLCH keys', () => {
    const graph: NodeGraph = {
      id: 'g1',
      name: 'Test',
      version: '2.0',
      nodes: [
        {
          id: 's1',
          type: 'sky-dome',
          position: { x: 0, y: 0 },
          parameters: {
            zenithR: 0.15,
            zenithG: 0.25,
            zenithB: 0.55,
          },
          parameterInputModes: {
            zenithR: 'override',
            horizonG: 'override',
          },
        },
      ],
      connections: [],
      metadata: {},
      viewState: { zoom: 1, panX: 0, panY: 0, selectedNodeIds: [] },
    };

    const out = migrateSkyDomeColors(graph);
    const skyNode = out.nodes.find((n) => n.id === 's1')!;

    expect(skyNode.parameterInputModes).toBeDefined();
    expect(skyNode.parameterInputModes!.zenithL).toBe('override');
    expect(skyNode.parameterInputModes!.horizonC).toBe('override');
    expect(skyNode.parameterInputModes).not.toHaveProperty('zenithR');
    expect(skyNode.parameterInputModes).not.toHaveProperty('horizonG');
  });
});

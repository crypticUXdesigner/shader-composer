import { describe, expect, it } from 'vitest';
import { migrateWarpTerrain } from './warpTerrainMigration';
import type { Connection, NodeGraph, NodeInstance } from './types';

function minimalGraph(nodes: NodeInstance[], connections: Connection[] = [], automation?: NodeGraph['automation']): NodeGraph {
  return {
    id: 'g',
    name: 't',
    version: '2.0',
    nodes,
    connections,
    ...(automation ? { automation } : {})
  };
}

describe('migrateWarpTerrain', () => {
  it('removes stale mode/elevation/vignette parameters and fills active shading defaults', () => {
    const graph = minimalGraph([
      {
        id: 'w',
        type: 'warp-terrain',
        position: { x: 0, y: 0 },
        parameters: {
          warpTerrainScale: 0.8,
          warpTimeSpeed: 1.0,
          warpVignetteStrength: 0.2,
          warpTerrainOutputMode: 0,
          warpTerrainElevationContrast: 1.8
        }
      }
    ]);
    const g = migrateWarpTerrain(graph);
    expect(g.nodes[0].parameters.warpVignetteStrength).toBeUndefined();
    expect(g.nodes[0].parameters.warpTerrainOutputMode).toBeUndefined();
    expect(g.nodes[0].parameters.warpTerrainElevationContrast).toBeUndefined();
    expect(g.nodes[0].parameters.warpTerrainRidge).toBe(1.0);
    expect(g.nodes[0].parameters.warpTerrainBump).toBe(1.0);
  });

  it('drops connections and automation lanes targeting removed warp-terrain parameters', () => {
    const graph = minimalGraph(
      [
        {
          id: 'w',
          type: 'warp-terrain',
          position: { x: 0, y: 0 },
          parameters: { warpTerrainScale: 1, warpTimeSpeed: 1 },
          parameterInputModes: {
            warpVignetteStrength: 'override',
            warpTerrainOutputMode: 'override',
            warpTerrainElevationContrast: 'override',
            warpTerrainRidge: 'override'
          }
        },
        {
          id: 'c',
          type: 'constant-float',
          position: { x: 0, y: 0 },
          parameters: { value: 0.5 },
          parameterInputModes: {}
        }
      ],
      [
        {
          id: 'x',
          sourceNodeId: 'c',
          sourcePort: 'out',
          targetNodeId: 'w',
          targetParameter: 'warpVignetteStrength'
        },
        {
          id: 'y',
          sourceNodeId: 'c',
          sourcePort: 'out',
          targetNodeId: 'w',
          targetParameter: 'warpTerrainOutputMode'
        },
        {
          id: 'z',
          sourceNodeId: 'c',
          sourcePort: 'out',
          targetNodeId: 'w',
          targetParameter: 'warpTerrainRidge'
        }
      ],
      {
        lanes: [
          {
            id: 'l',
            nodeId: 'w',
            paramName: 'warpVignetteStrength',
            regions: []
          },
          {
            id: 'm',
            nodeId: 'w',
            paramName: 'warpTerrainElevationContrast',
            regions: []
          },
          {
            id: 'n',
            nodeId: 'w',
            paramName: 'warpTerrainBump',
            regions: []
          }
        ],
        bpm: 120,
        durationSeconds: 60
      }
    );

    const g = migrateWarpTerrain(graph);
    expect(g.connections).toEqual([
      {
        id: 'z',
        sourceNodeId: 'c',
        sourcePort: 'out',
        targetNodeId: 'w',
        targetParameter: 'warpTerrainRidge'
      }
    ]);
    expect(g.automation?.lanes.some((lane) => lane.paramName === 'warpVignetteStrength')).toBe(false);
    expect(g.automation?.lanes.some((lane) => lane.paramName === 'warpTerrainElevationContrast')).toBe(false);
    expect(g.automation?.lanes.some((lane) => lane.paramName === 'warpTerrainBump')).toBe(true);
    expect(g.nodes[0].parameterInputModes).toEqual({ warpTerrainRidge: 'override' });
  });

  it('removes legacy output mode values', () => {
    const graph = minimalGraph([
      {
        id: 'w',
        type: 'warp-terrain',
        position: { x: 0, y: 0 },
        parameters: { warpTerrainOutputMode: 2 }
      }
    ]);

    const g = migrateWarpTerrain(graph);
    expect(g.nodes[0].parameters.warpTerrainOutputMode).toBeUndefined();
  });

  it('is a no-op when no warp-terrain nodes exist', () => {
    const graph = minimalGraph([
      { id: 'n', type: 'noise', position: { x: 0, y: 0 }, parameters: { noiseScale: 1 } }
    ]);
    expect(migrateWarpTerrain(graph)).toBe(graph);
  });
});

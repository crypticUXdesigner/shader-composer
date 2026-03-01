/**
 * Tests for band remap → remappers migration.
 */
import { describe, it, expect } from 'vitest';
import { migrateBandRemapToRemappers } from './audioBandRemapMigration';
import type { NodeGraph } from './types';
import type { AudioSetup } from './audioSetupTypes';

function conn(
  id: string,
  sourceNodeId: string,
  targetNodeId: string,
  targetParameter: string
): { id: string; sourceNodeId: string; sourcePort: string; targetNodeId: string; targetParameter: string } {
  return { id, sourceNodeId, sourcePort: 'out', targetNodeId, targetParameter };
}

describe('migrateBandRemapToRemappers', () => {
  it('adds one remapper per band and rewrites band-remap connections', () => {
    const bandId = 'node-1770318840638-0u4geobd0';
    const graph: NodeGraph = {
      id: 'g1',
      name: 'Test',
      version: '2.0',
      nodes: [{ id: 'n1', type: 'multiply', position: { x: 0, y: 0 }, parameters: {} }],
      connections: [
        conn(
          'c1',
          'audio-signal:band-' + bandId + '-remap',
          'n1',
          'a'
        ),
      ],
      metadata: {},
      viewState: { zoom: 1, panX: 0, panY: 0, selectedNodeIds: [] },
    };
    const audioSetup: AudioSetup = {
      files: [{ id: 'f1', name: 'File', autoPlay: false }],
      bands: [
        {
          id: bandId,
          name: 'Highs',
          sourceFileId: 'f1',
          frequencyBands: [[2568, 20000]],
          smoothing: 0.03,
          fftSize: 4096,
          remapInMin: 0,
          remapInMax: 0.52,
          remapOutMin: 0.51,
          remapOutMax: 1,
        },
      ],
      remappers: [],
    };

    const { graph: outGraph, audioSetup: outSetup } = migrateBandRemapToRemappers(graph, audioSetup);

    expect(outSetup.remappers).toHaveLength(1);
    expect(outSetup.remappers[0]).toMatchObject({
      id: `band-${bandId}`,
      name: 'Default',
      bandId,
      inMin: 0,
      inMax: 0.52,
      outMin: 0.51,
      outMax: 1,
    });
    expect(outGraph.connections[0].sourceNodeId).toBe(
      `audio-signal:remap-band-${bandId}`
    );
  });

  it('is idempotent when remappers already exist', () => {
    const bandId = 'b1';
    const remapperId = `band-${bandId}`;
    const graph: NodeGraph = {
      id: 'g1',
      name: 'Test',
      version: '2.0',
      nodes: [],
      connections: [
        conn('c1', `audio-signal:remap-${remapperId}`, 'n1', 'a'),
      ],
      metadata: {},
      viewState: { zoom: 1, panX: 0, panY: 0, selectedNodeIds: [] },
    };
    const audioSetup: AudioSetup = {
      files: [],
      bands: [
        {
          id: bandId,
          name: 'Bass',
          sourceFileId: '',
          frequencyBands: [[20, 200]],
          smoothing: 0.5,
          fftSize: 2048,
        },
      ],
      remappers: [
        {
          id: remapperId,
          name: 'Default',
          bandId,
          inMin: 0,
          inMax: 1,
          outMin: 0,
          outMax: 1,
        },
      ],
    };

    const { graph: outGraph, audioSetup: outSetup } = migrateBandRemapToRemappers(graph, audioSetup);

    expect(outSetup.remappers).toHaveLength(1);
    expect(outGraph.connections[0].sourceNodeId).toBe(`audio-signal:remap-${remapperId}`);
  });

  it('returns unchanged when no bands', () => {
    const graph: NodeGraph = {
      id: 'g1',
      name: 'Test',
      version: '2.0',
      nodes: [],
      connections: [],
      metadata: {},
      viewState: { zoom: 1, panX: 0, panY: 0, selectedNodeIds: [] },
    };
    const audioSetup: AudioSetup = { files: [], bands: [], remappers: [] };
    const result = migrateBandRemapToRemappers(graph, audioSetup);
    expect(result.graph).toBe(graph);
    expect(result.audioSetup).toBe(audioSetup);
  });
});

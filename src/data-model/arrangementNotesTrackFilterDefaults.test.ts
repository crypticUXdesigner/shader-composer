import { describe, it, expect } from 'vitest';
import { buildArrangementSnapshot } from '../audiotool/arrangement/buildArrangementSnapshot';
import type { RawArrangementEntities } from '../audiotool/arrangement/rawEntities';
import spikeFixture from '../audiotool/arrangement/__fixtures__/spike-arrangement-raw.json';
import type { NodeGraph, NodeInstance } from './types';
import {
  applyArrangementNotesDefaultTrackFilterToGraph,
  arrangementNotesNeedsDefaultTrackFilter,
} from './arrangementNotesTrackFilterDefaults';

const snapshot = buildArrangementSnapshot(spikeFixture as RawArrangementEntities);

function notesNode(params: Record<string, unknown> = {}): NodeInstance {
  return {
    id: 'n1',
    type: 'arrangement-notes',
    position: { x: 0, y: 0 },
    parameters: params,
  };
}

function graphWith(node: NodeInstance): NodeGraph {
  return { nodes: [node], connections: [] };
}

describe('arrangementNotesTrackFilterDefaults', () => {
  it('arrangementNotesNeedsDefaultTrackFilter is true for mode 0 and empty subset', () => {
    expect(arrangementNotesNeedsDefaultTrackFilter(notesNode({ trackFilterMode: 0 }))).toBe(true);
    expect(
      arrangementNotesNeedsDefaultTrackFilter(
        notesNode({ trackFilterMode: 1, trackFilterList: '' })
      )
    ).toBe(true);
    expect(
      arrangementNotesNeedsDefaultTrackFilter(
        notesNode({ trackFilterMode: 1, trackFilterList: 'track-note-1' })
      )
    ).toBe(false);
  });

  it('applyArrangementNotesDefaultTrackFilterToGraph sets one track from snapshot', () => {
    const out = applyArrangementNotesDefaultTrackFilterToGraph(
      graphWith(notesNode({ trackFilterMode: 0 })),
      snapshot
    );
    expect(out.nodes[0]?.parameters.trackFilterMode).toBe(1);
    expect(out.nodes[0]?.parameters.trackFilterList).toBe('track-note-1');
  });

  it('does not override an explicit single-track filter', () => {
    const graph = graphWith(
      notesNode({ trackFilterMode: 1, trackFilterList: 'other-track' })
    );
    expect(applyArrangementNotesDefaultTrackFilterToGraph(graph, snapshot)).toBe(graph);
  });
});

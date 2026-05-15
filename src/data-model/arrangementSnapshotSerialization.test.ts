import { describe, it, expect } from 'vitest';
import { buildArrangementSnapshot } from '../audiotool/arrangement/buildArrangementSnapshot';
import type { RawArrangementEntities } from '../audiotool/arrangement/rawEntities';
import spikeFixture from '../audiotool/arrangement/__fixtures__/spike-arrangement-raw.json';
import { createEmptyGraph } from './utils';
import {
  clearArrangementSnapshot,
  clearArrangementSnapshotIfPrimaryMismatch,
  setArrangementSnapshot,
  setPrimarySource,
} from './audioSetupUpdates';
import type { AudioSetup } from './audioSetupTypes';
import { deserializeGraph, serializeGraph } from './serialization';
import type { NodeSpecification } from './validation';

const mockNodeSpecs: NodeSpecification[] = [];
const snapshot = buildArrangementSnapshot(spikeFixture as RawArrangementEntities);

function minimalAudioSetup(overrides: Partial<AudioSetup> = {}): AudioSetup {
  return {
    files: [],
    bands: [],
    remappers: [],
    ...overrides,
  };
}

describe('arrangement snapshot on AudioSetup', () => {
  it('round-trips through serializeGraph / deserializeGraph', () => {
    const graph = createEmptyGraph('Arrangement test');
    const audioSetup = minimalAudioSetup({
      primarySource: { type: 'playlist', trackId: snapshot.source.trackName },
      arrangementSnapshot: snapshot,
      arrangementImportedAt: '2026-05-15T12:00:00.000Z',
    });
    const json = serializeGraph(graph, false, audioSetup);
    const result = deserializeGraph(json, mockNodeSpecs);
    expect(result.errors).toEqual([]);
    expect(result.audioSetup?.arrangementSnapshot).toEqual(snapshot);
    expect(result.audioSetup?.arrangementImportedAt).toBe('2026-05-15T12:00:00.000Z');
  });

  it('strips invalid arrangementSnapshot on deserialize', () => {
    const graph = createEmptyGraph('Bad snapshot');
    const json = JSON.stringify({
      format: 'shadernoice-node-graph',
      formatVersion: '2.0',
      graph,
      audioSetup: {
        files: [],
        bands: [],
        remappers: [],
        arrangementSnapshot: { tracks: 'not-an-array' },
        arrangementImportedAt: '2026-05-15T12:00:00.000Z',
      },
    });
    const result = deserializeGraph(json, mockNodeSpecs);
    expect(result.audioSetup?.arrangementSnapshot).toBeUndefined();
    expect(result.audioSetup?.arrangementImportedAt).toBeUndefined();
  });

  it('setArrangementSnapshot replaces prior snapshot', () => {
    const first = minimalAudioSetup({
      primarySource: { type: 'playlist', trackId: 'tracks/a' },
    });
    const withFirst = setArrangementSnapshot(first, snapshot);
    const secondSnapshot = { ...snapshot, source: { ...snapshot.source, commitIndex: 99 } };
    const withSecond = setArrangementSnapshot(withFirst, secondSnapshot, '2026-05-16T00:00:00.000Z');
    expect(withSecond.arrangementSnapshot?.source.commitIndex).toBe(99);
    expect(withSecond.arrangementImportedAt).toBe('2026-05-16T00:00:00.000Z');
  });

  it('clearArrangementSnapshotIfPrimaryMismatch clears on upload or other track', () => {
    const withSnap = setArrangementSnapshot(
      minimalAudioSetup({
        primarySource: { type: 'playlist', trackId: snapshot.source.trackName },
      }),
      snapshot
    );
    const uploadPrimary = setPrimarySource(withSnap, {
      type: 'upload',
      file: { id: 'f1', name: 'Local', autoPlay: false },
    });
    expect(clearArrangementSnapshotIfPrimaryMismatch(uploadPrimary).arrangementSnapshot).toBeUndefined();

    const otherTrack = setPrimarySource(withSnap, {
      type: 'playlist',
      trackId: 'tracks/other',
    });
    expect(clearArrangementSnapshotIfPrimaryMismatch(otherTrack).arrangementSnapshot).toBeUndefined();

    const matching = clearArrangementSnapshotIfPrimaryMismatch(withSnap);
    expect(matching.arrangementSnapshot).toEqual(snapshot);
  });

  it('clearArrangementSnapshot removes snapshot fields', () => {
    const cleared = clearArrangementSnapshot(setArrangementSnapshot(minimalAudioSetup(), snapshot));
    expect(cleared.arrangementSnapshot).toBeUndefined();
    expect(cleared.arrangementImportedAt).toBeUndefined();
  });
});

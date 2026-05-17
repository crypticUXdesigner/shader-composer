import { describe, it, expect } from 'vitest';
import { buildArrangementSnapshot } from '../audiotool/arrangement/buildArrangementSnapshot';
import type { RawArrangementEntities } from '../audiotool/arrangement/rawEntities';
import spikeFixture from '../audiotool/arrangement/__fixtures__/spike-arrangement-raw.json';
import type { AudioSetup } from './audioSetupTypes';
import {
  clearArrangementSnapshot,
  clearArrangementSnapshotIfPrimaryMismatch,
  setArrangementSnapshot,
  setPrimarySource,
  retargetBandsToPrimary,
  duplicateRemapperName,
  createDuplicateRemapperEntry,
} from './audioSetupUpdates';
import type { AudioRemapperEntry } from './audioSetupTypes';

const snapshot = buildArrangementSnapshot(spikeFixture as RawArrangementEntities);

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    console.error('Assertion failed', { actual, expected });
    throw new Error(message || `Expected ${String(expected)}, got ${String(actual)}`);
  }
}

describe('retargetBandsToPrimary', () => {
  it('is noop when ids are missing or identical', () => {
    const setup: AudioSetup = {
      files: [],
      bands: [],
      remappers: [],
    };

    assertEqual(
      retargetBandsToPrimary(setup, undefined, 'new'),
      setup,
      'Should be noop when prevPrimaryId is undefined',
    );

    assertEqual(
      retargetBandsToPrimary(setup, 'prev', undefined),
      setup,
      'Should be noop when newPrimaryId is undefined',
    );

    assertEqual(
      retargetBandsToPrimary(setup, 'same', 'same'),
      setup,
      'Should be noop when ids are identical',
    );
  });

  it('updates bands whose sourceFileId matches the previous primary id', () => {
    const setup: AudioSetup = {
      files: [],
      bands: [
        {
          id: 'band-a',
          name: 'A',
          sourceFileId: 'prev-primary',
          frequencyBands: [[100, 200]],
          smoothingHalfLifeSeconds: 1 / 120,
          fftSize: 2048,
        },
        {
          id: 'band-b',
          name: 'B',
          sourceFileId: 'other-source',
          frequencyBands: [[200, 400]],
          smoothingHalfLifeSeconds: 1 / 120,
          fftSize: 2048,
        },
      ],
      remappers: [],
    };

    const result = retargetBandsToPrimary(setup, 'prev-primary', 'new-primary');

    assert(result !== setup, 'Resulting setup should be a new object');
    assertEqual(result.bands.length, 2, 'Band count should be unchanged');

    assertEqual(
      result.bands[0].sourceFileId,
      'new-primary',
      'Band with matching sourceFileId should be retargeted',
    );
    assertEqual(
      result.bands[1].sourceFileId,
      'other-source',
      'Band with different sourceFileId should be unchanged',
    );
  });

  it('updates bands whose sourceFileId is any playlist track id to follow the new primary', () => {
    const setup: AudioSetup = {
      files: [],
      bands: [
        {
          id: 'band-a',
          name: 'A',
          sourceFileId: 'tracks/old-a',
          frequencyBands: [[100, 200]],
          smoothingHalfLifeSeconds: 1 / 120,
          fftSize: 2048,
        },
        {
          id: 'band-b',
          name: 'B',
          sourceFileId: 'tracks/old-b',
          frequencyBands: [[200, 400]],
          smoothingHalfLifeSeconds: 1 / 120,
          fftSize: 2048,
        },
        {
          id: 'band-c',
          name: 'C',
          sourceFileId: 'file-upload',
          frequencyBands: [[400, 800]],
          smoothingHalfLifeSeconds: 1 / 120,
          fftSize: 2048,
        },
      ],
      remappers: [],
      playlistState: {
        order: ['tracks/old-a', 'tracks/old-b', 'tracks/other'],
        currentIndex: 0,
        loopCurrentTrack: false,
      },
      primarySource: { type: 'playlist', trackId: 'tracks/old-a' },
    };

    const result = retargetBandsToPrimary(setup, 'tracks/old-a', 'tracks/new-primary');

    assert(result !== setup, 'Resulting setup should be a new object');
    assertEqual(result.bands.length, 3, 'Band count should be unchanged');

    assertEqual(
      result.bands[0].sourceFileId,
      'tracks/new-primary',
      'Band-a (in playlist order) should follow new primary',
    );
    assertEqual(
      result.bands[1].sourceFileId,
      'tracks/new-primary',
      'Band-b (in playlist order) should also follow new primary',
    );
    assertEqual(
      result.bands[2].sourceFileId,
      'file-upload',
      'Band-c (not in playlist order) should be unchanged',
    );
  });
});

describe('arrangement snapshot audio setup updates', () => {
  it('clearArrangementSnapshotIfPrimaryMismatch keeps snapshot for matching playlist track', () => {
    const setup = setArrangementSnapshot(
      {
        files: [],
        bands: [],
        remappers: [],
        primarySource: { type: 'playlist', trackId: snapshot.source.trackName },
      },
      snapshot
    );
    expect(clearArrangementSnapshotIfPrimaryMismatch(setup).arrangementSnapshot).toEqual(snapshot);
  });

  it('clearArrangementSnapshotIfPrimaryMismatch clears on upload or other track', () => {
    const withSnap = setArrangementSnapshot(
      {
        files: [],
        bands: [],
        remappers: [],
        primarySource: { type: 'playlist', trackId: snapshot.source.trackName },
      },
      snapshot
    );
    const upload = setPrimarySource(withSnap, {
      type: 'upload',
      file: { id: 'f1', name: 'x', autoPlay: false },
    });
    expect(clearArrangementSnapshotIfPrimaryMismatch(upload).arrangementSnapshot).toBeUndefined();

    const other = setPrimarySource(withSnap, { type: 'playlist', trackId: 'tracks/other' });
    expect(clearArrangementSnapshotIfPrimaryMismatch(other).arrangementSnapshot).toBeUndefined();
  });

  it('clearArrangementSnapshot removes persisted fields', () => {
    const cleared = clearArrangementSnapshot(
      setArrangementSnapshot({ files: [], bands: [], remappers: [] }, snapshot)
    );
    expect(cleared.arrangementSnapshot).toBeUndefined();
    expect(cleared.arrangementImportedAt).toBeUndefined();
  });
});

describe('duplicateRemapperName', () => {
  it('appends 2 when duplicating an unnumbered name', () => {
    expect(duplicateRemapperName('Level', ['Level'])).toBe('Level 2');
  });

  it('uses the next free suffix when numbered names exist', () => {
    expect(duplicateRemapperName('Level', ['Level', 'Level 2'])).toBe('Level 3');
    expect(duplicateRemapperName('Level 2', ['Level', 'Level 2'])).toBe('Level 3');
  });

  it('falls back to Remapper when the source name is empty', () => {
    expect(duplicateRemapperName('', [])).toBe('Remapper 1');
  });
});

describe('createDuplicateRemapperEntry', () => {
  it('copies remap settings and assigns a new id and name', () => {
    const source: AudioRemapperEntry = {
      id: 'remap-a',
      name: 'Drive',
      bandId: 'band-1',
      inMin: 0.1,
      inMax: 0.9,
      outMin: -1,
      outMax: 2,
    };
    const duplicate = createDuplicateRemapperEntry(source, 'remap-b', ['Drive']);
    expect(duplicate.id).toBe('remap-b');
    expect(duplicate.name).toBe('Drive 2');
    expect(duplicate.bandId).toBe('band-1');
    expect(duplicate.inMin).toBe(0.1);
    expect(duplicate.inMax).toBe(0.9);
    expect(duplicate.outMin).toBe(-1);
    expect(duplicate.outMax).toBe(2);
  });
});

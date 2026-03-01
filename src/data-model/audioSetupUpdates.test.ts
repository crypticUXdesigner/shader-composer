import { describe, it } from 'vitest';
import type { AudioSetup } from './audioSetupTypes';
import { retargetBandsToPrimary } from './audioSetupUpdates';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    // eslint-disable-next-line no-console
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
          smoothing: 0.5,
          fftSize: 2048,
        },
        {
          id: 'band-b',
          name: 'B',
          sourceFileId: 'other-source',
          frequencyBands: [[200, 400]],
          smoothing: 0.7,
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
          smoothing: 0.5,
          fftSize: 2048,
        },
        {
          id: 'band-b',
          name: 'B',
          sourceFileId: 'tracks/old-b',
          frequencyBands: [[200, 400]],
          smoothing: 0.7,
          fftSize: 2048,
        },
        {
          id: 'band-c',
          name: 'C',
          sourceFileId: 'file-upload',
          frequencyBands: [[400, 800]],
          smoothing: 0.7,
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


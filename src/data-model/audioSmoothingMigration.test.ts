import { describe, it } from 'vitest';
import { deserializeGraph } from './serialization';
import { ensureBandAttackReleaseHalfLives } from './audioSmoothingMigration';
import type { AudioSetup } from './audioSetupTypes';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(
      `Assertion failed: ${message || 'Values not equal'}\n  Expected: ${expected}\n  Actual: ${actual}`
    );
  }
}

describe('audio smoothing migration', () => {
  it('deserializeGraph ensures attack/release half-life exists for bands', () => {
    const json = `{
      "format": "shadernoice-node-graph",
      "formatVersion": "2.0",
      "graph": { "id": "g1", "name": "Test", "version": "2.0", "nodes": [], "connections": [] },
      "audioSetup": {
        "files": [{ "id": "f1", "name": "File", "autoPlay": false }],
        "bands": [
          { "id": "b1", "name": "Band", "sourceFileId": "f1", "frequencyBands": [[20, 20000]], "fftSize": 2048 }
        ],
        "remappers": []
      }
    }`;

    const result = deserializeGraph(json, []);
    assert(result.errors.length === 0, 'deserializeGraph should not error');
    assert(result.audioSetup != null, 'audioSetup should exist');
    const band = result.audioSetup!.bands[0]!;
    assert(band.attackHalfLifeSeconds != null, 'attackHalfLifeSeconds should be added');
    assert(band.releaseHalfLifeSeconds != null, 'releaseHalfLifeSeconds should be added');
    assert(Number.isFinite(band.attackHalfLifeSeconds!), 'attackHalfLifeSeconds should be finite');
    assert(Number.isFinite(band.releaseHalfLifeSeconds!), 'releaseHalfLifeSeconds should be finite');
  });

  it('ensureBandAttackReleaseHalfLives sets a stable default', () => {
    const base: AudioSetup = {
      files: [{ id: 'f1', name: 'File', autoPlay: false }],
      bands: [
        { id: 'b0', name: 'B0', sourceFileId: 'f1', frequencyBands: [[20, 20000]], fftSize: 2048 },
        { id: 'b1', name: 'B1', sourceFileId: 'f1', frequencyBands: [[20, 20000]], fftSize: 2048 },
      ],
      remappers: [],
    };

    const migrated = ensureBandAttackReleaseHalfLives(base);
    assertEqual(migrated.bands.length, 2, 'band count should be unchanged');

    const atk0 = migrated.bands[0]!.attackHalfLifeSeconds!;
    const rel0 = migrated.bands[0]!.releaseHalfLifeSeconds!;
    const atk1 = migrated.bands[1]!.attackHalfLifeSeconds!;
    const rel1 = migrated.bands[1]!.releaseHalfLifeSeconds!;

    assertEqual(atk0, 1 / 120, 'default attack half-life should be 1/120s');
    assertEqual(rel0, 1 / 120, 'default release half-life should be 1/120s');
    assertEqual(atk1, 1 / 120, 'default attack half-life should be 1/120s');
    assertEqual(rel1, 1 / 120, 'default release half-life should be 1/120s');
  });

  it('ensureBandAttackReleaseHalfLives is idempotent', () => {
    const setup: AudioSetup = {
      files: [{ id: 'f1', name: 'File', autoPlay: false }],
      bands: [
        { id: 'b', name: 'B', sourceFileId: 'f1', frequencyBands: [[20, 20000]], attackHalfLifeSeconds: 0.123, releaseHalfLifeSeconds: 0.456, fftSize: 2048 },
      ],
      remappers: [],
    };
    const migrated = ensureBandAttackReleaseHalfLives(setup);
    assertEqual(migrated, setup, 'should be noop when attack/release already set');
  });

  it('ensureBandAttackReleaseHalfLives maps legacy smoothingHalfLifeSeconds', () => {
    const setup: AudioSetup = {
      files: [{ id: 'f1', name: 'File', autoPlay: false }],
      bands: [
        { id: 'b', name: 'B', sourceFileId: 'f1', frequencyBands: [[20, 20000]], smoothingHalfLifeSeconds: 0.25, fftSize: 2048 },
      ],
      remappers: [],
    };
    const migrated = ensureBandAttackReleaseHalfLives(setup);
    assertEqual(migrated.bands[0]!.attackHalfLifeSeconds!, 0.25, 'attack should match legacy smoothing');
    assertEqual(migrated.bands[0]!.releaseHalfLifeSeconds!, 0.25, 'release should match legacy smoothing');
  });
});


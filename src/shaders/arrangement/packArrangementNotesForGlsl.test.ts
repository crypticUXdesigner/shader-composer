import { describe, it, expect } from 'vitest';
import { buildArrangementSnapshot } from '../../audiotool/arrangement/buildArrangementSnapshot';
import type { RawArrangementEntities } from '../../audiotool/arrangement/rawEntities';
import type { ArrangementSnapshot } from '../../audiotool/arrangement/types';
import spikeFixture from '../../audiotool/arrangement/__fixtures__/spike-arrangement-raw.json';
import type { NodeInstance } from '../../data-model/types';
import { NOTE_COLOR_MODE } from '../../audiotool/arrangement/arrangementNoteColors';
import { ARRANGEMENT_NOTES_INTERACTIVE_PACK_LIMIT } from '../../audiotool/arrangement/types';
import {
  buildArrangementNotesGlslBake,
  buildArrangementNotesWgslNodeHelper,
  filterNotesForNode,
  packArrangementNotesForGlsl,
  type ArrangementNotesPackOptions,
} from './packArrangementNotesForGlsl';

const raw = spikeFixture as RawArrangementEntities;
const snapshot = buildArrangementSnapshot(raw);

const defaultPackOpts: ArrangementNotesPackOptions = {
  trackFilterMode: 0,
  trackFilterList: '',
  trackLayout: 0,
  noteColorMode: NOTE_COLOR_MODE.PROJECT,
  trackNoteColors: '',
};

const node: NodeInstance = {
  id: 'n-notes',
  type: 'arrangement-notes',
  position: { x: 0, y: 0 },
  parameters: {},
};

const dualTrackSnapshot: ArrangementSnapshot = {
  tracks: [
    { id: 'ta', kind: 'note', orderAmongTracks: 0, enabled: true },
    { id: 'tb', kind: 'note', orderAmongTracks: 1, enabled: true },
  ],
  regions: [],
  notes: [
    {
      id: 'n1',
      collectionId: 'c',
      trackId: 'ta',
      startSeconds: 0,
      durationSeconds: 1,
      pitch: 60,
      velocity: 0.9,
    },
    {
      id: 'n2',
      collectionId: 'c',
      trackId: 'tb',
      startSeconds: 0,
      durationSeconds: 1,
      pitch: 60,
      velocity: 0.9,
    },
  ],
  bpm: 120,
  durationSeconds: 60,
  timeSignature: { numerator: 4, denominator: 4 },
  source: {
    trackName: 'tracks/t',
    projectName: 'projects/p',
    commitIndex: 0,
  },
};

describe('packArrangementNotesForGlsl', () => {
  it('packs notes from snapshot with pitch range', () => {
    const packed = packArrangementNotesForGlsl(snapshot, defaultPackOpts);
    expect(packed.notes).toHaveLength(3);
    expect(packed.pitchYNorms).toHaveLength(3);
    expect(packed.pitchMin).toBe(60);
    expect(packed.pitchMax).toBe(67);
    expect(packed.notes[0]?.startSeconds).toBeLessThan(packed.notes[1]?.startSeconds ?? 0);
  });

  it('filters by track id list', () => {
    const packed = packArrangementNotesForGlsl(snapshot, {
      ...defaultPackOpts,
      trackFilterMode: 1,
      trackFilterList: 'track-note-2',
    });
    expect(packed.notes).toHaveLength(0);
  });

  it('Overlap mode uses global pitch norm (same pitch → same Y slot)', () => {
    const packed = packArrangementNotesForGlsl(dualTrackSnapshot, { ...defaultPackOpts, trackLayout: 0 });
    expect(packed.pitchYNorms).toEqual([0, 0]);
  });

  it('Lanes mode splits same MIDI pitch across stacked track bands', () => {
    const packed = packArrangementNotesForGlsl(dualTrackSnapshot, { ...defaultPackOpts, trackLayout: 1 });
    expect(packed.notes).toHaveLength(2);
    expect(packed.pitchYNorms[0]).toBeCloseTo(0, 5);
    expect(packed.pitchYNorms[1]).toBeCloseTo(0.5, 5);
  });

  it('emits GLSL bake constants', () => {
    const packed = filterNotesForNode(snapshot, node);
    const bake = buildArrangementNotesGlslBake('n-notes', packed);
    expect(bake).toContain('ARR_NOTE_COUNT_n_notes = 3');
    expect(bake).toContain('ARR_NOTES_n_notes');
    expect(bake).toContain('ARR_NOTE_Y_NORM_n_notes');
    expect(bake).toContain('ARR_NOTES_COLOR_MODE_n_notes');
    expect(bake).toContain('ARR_NOTE_PROJECT_n_notes');
    expect(packed.noteProjectColorData).toHaveLength(3);
  });

  it('mono light does not bake per-note color tables', () => {
    const packed = packArrangementNotesForGlsl(snapshot, {
      ...defaultPackOpts,
      noteColorMode: NOTE_COLOR_MODE.MONO_LIGHT,
    });
    expect(packed.noteProjectColorData).toHaveLength(0);
    expect(packed.trackTableRgb).toHaveLength(0);
    const bake = buildArrangementNotesGlslBake('n-notes', packed);
    expect(bake).toContain('ARR_NOTES_COLOR_MODE_n_notes 0');
    expect(bake).not.toContain('ARR_NOTE_PROJECT_');
  });

  it('bake stays compact at cap and loop uses actual note count (not 2048)', () => {
    const manyNotes = Array.from({ length: 500 }, (_, i) => ({
      id: `n-${i}`,
      collectionId: 'c',
      trackId: 'ta',
      startSeconds: i * 0.01,
      durationSeconds: 0.05,
      pitch: 60 + (i % 12),
      velocity: 0.8,
    }));
    const bigSnapshot: ArrangementSnapshot = {
      ...dualTrackSnapshot,
      notes: manyNotes,
    };
    const packed = packArrangementNotesForGlsl(bigSnapshot, defaultPackOpts);
    expect(packed.notes).toHaveLength(500);
    const bake = buildArrangementNotesGlslBake('n-notes', packed);
    const wgsl = buildArrangementNotesWgslNodeHelper('n-notes', packed);
    expect(bake).toContain('ARR_NOTE_COUNT_n_notes = 500');
    expect(bake).not.toContain('ARR_NOTE_RGB_');
    expect(bake.length).toBeLessThan(120_000);
    expect(wgsl).toContain('for (var i: i32 = noteLoopStart; i < noteLoopEnd; i++)');
    expect(wgsl).not.toMatch(/for \(var i: i32 = 0; i < ARR_NOTE_COUNT/);
    expect(wgsl).not.toContain('MAX_ARRANGEMENT_NOTES_PACKED');
  });

  it('WGSL eval uses runtime note loop bounds uniforms', () => {
    const packed = packArrangementNotesForGlsl(dualTrackSnapshot, defaultPackOpts);
    const wgsl = buildArrangementNotesWgslNodeHelper('n-notes', packed);
    expect(wgsl).toContain('noteLoopStart: i32');
    expect(wgsl).toContain('for (var i: i32 = noteLoopStart; i < noteLoopEnd; i++)');
    expect(wgsl).not.toContain('ARR_BUCKET_START');
  });

  it('subsamples sorted bakes above the interactive pack limit', () => {
    const manyNotes = Array.from({ length: 1500 }, (_, i) => ({
      id: `n-${i}`,
      collectionId: 'c',
      trackId: 'ta',
      startSeconds: i * 0.01,
      durationSeconds: 0.05,
      pitch: 60 + (i % 12),
      velocity: 0.8,
    }));
    const bigSnapshot: ArrangementSnapshot = {
      ...dualTrackSnapshot,
      notes: manyNotes,
    };
    const packed = packArrangementNotesForGlsl(bigSnapshot, defaultPackOpts);
    expect(packed.notes).toHaveLength(ARRANGEMENT_NOTES_INTERACTIVE_PACK_LIMIT);
    expect(packed.pitchYNorms).toHaveLength(ARRANGEMENT_NOTES_INTERACTIVE_PACK_LIMIT);
    const bake = buildArrangementNotesGlslBake('n-notes', packed);
    expect(bake).toContain(`ARR_NOTE_COUNT_n_notes = ${ARRANGEMENT_NOTES_INTERACTIVE_PACK_LIMIT}`);
  });

  it('custom mode bakes compact track table and per-note indices', () => {
    const packed = packArrangementNotesForGlsl(dualTrackSnapshot, {
      ...defaultPackOpts,
      noteColorMode: NOTE_COLOR_MODE.CUSTOM,
      trackNoteColors: 'ta:1.0:0.0:0;tb:0.55:0.18:120',
    });
    expect(packed.trackTableRgb).toHaveLength(2);
    expect(packed.noteTrackIndices).toHaveLength(2);
    const bake = buildArrangementNotesGlslBake('n-notes', packed);
    expect(bake).toContain('ARR_TRACK_RGB_');
    expect(bake).toContain('ARR_NOTE_TRACK_IDX_');
    expect(bake).not.toContain('ARR_NOTE_RGB_');
  });
});

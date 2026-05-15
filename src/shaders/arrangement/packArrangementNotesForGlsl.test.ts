import { describe, it, expect } from 'vitest';
import { buildArrangementSnapshot } from '../../audiotool/arrangement/buildArrangementSnapshot';
import type { RawArrangementEntities } from '../../audiotool/arrangement/rawEntities';
import spikeFixture from '../../audiotool/arrangement/__fixtures__/spike-arrangement-raw.json';
import type { NodeInstance } from '../../data-model/types';
import {
  buildArrangementNotesGlslBake,
  filterNotesForNode,
  packArrangementNotesForGlsl,
} from './packArrangementNotesForGlsl';

const raw = spikeFixture as RawArrangementEntities;
const snapshot = buildArrangementSnapshot(raw);

const node: NodeInstance = {
  id: 'n-notes',
  type: 'arrangement-notes',
  position: { x: 0, y: 0 },
  parameters: {},
};

describe('packArrangementNotesForGlsl', () => {
  it('packs notes from snapshot with pitch range', () => {
    const packed = packArrangementNotesForGlsl(snapshot, {
      trackFilterMode: 0,
      trackFilterList: '',
    });
    expect(packed.notes).toHaveLength(3);
    expect(packed.pitchMin).toBe(60);
    expect(packed.pitchMax).toBe(67);
    expect(packed.notes[0]?.startSeconds).toBeLessThan(packed.notes[1]?.startSeconds ?? 0);
  });

  it('filters by track id list', () => {
    const packed = packArrangementNotesForGlsl(snapshot, {
      trackFilterMode: 1,
      trackFilterList: 'track-note-2',
    });
    expect(packed.notes).toHaveLength(0);
  });

  it('emits GLSL bake constants', () => {
    const packed = filterNotesForNode(snapshot, node);
    const bake = buildArrangementNotesGlslBake('n-notes', packed);
    expect(bake).toContain('ARR_NOTE_COUNT_n_notes = 3');
    expect(bake).toContain('ARR_NOTES_n_notes');
    expect(bake).toContain('ARR_NOTE_PITCH_MIN_n_notes');
  });
});

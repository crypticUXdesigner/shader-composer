import { describe, it, expect } from 'vitest';
import { ticksToSeconds } from '@audiotool/nexus/utils';
import {
  arrangementTicksToSeconds,
  buildArrangementSnapshot,
  expandNoteInstancesForRegion,
} from './buildArrangementSnapshot';
import type { RawArrangementEntities, RawNote, RawNoteRegion } from './rawEntities';
import spikeFixture from './__fixtures__/spike-arrangement-raw.json';

const BPM = 120;

function minimalRaw(overrides: {
  noteRegions?: RawNoteRegion[];
  notes?: RawNote[];
  noteTracks?: RawArrangementEntities['noteTracks'];
}): RawArrangementEntities {
  return {
    config: {
      tempoBpm: BPM,
      signatureNumerator: 4,
      signatureDenominator: 4,
      durationTicks: 1_000_000,
    },
    noteTracks: overrides.noteTracks ?? [
      {
        id: 'track-1',
        orderAmongTracks: 0,
        isEnabled: true,
        playerEntityId: 'dev-1',
      },
    ],
    audioTracks: [],
    patternTracks: [],
    noteRegions: overrides.noteRegions ?? [],
    audioRegions: [],
    patternRegions: [],
    notes: overrides.notes ?? [],
    entityLabels: {},
    source: {
      trackName: 'tracks/test',
      projectName: 'projects/test',
      commitIndex: 0,
    },
  };
}

const raw = spikeFixture as RawArrangementEntities;

describe('arrangementTicksToSeconds', () => {
  it('matches @audiotool/nexus/utils ticksToSeconds', () => {
    expect(arrangementTicksToSeconds(3840, 120)).toBe(ticksToSeconds(3840, 120));
    expect(arrangementTicksToSeconds(15360, 128)).toBe(ticksToSeconds(15360, 128));
  });
});

describe('buildArrangementSnapshot', () => {
  const snapshot = buildArrangementSnapshot(raw);

  it('maps config BPM, duration, and time signature', () => {
    expect(snapshot.bpm).toBe(128);
    expect(snapshot.timeSignature).toEqual({ numerator: 4, denominator: 4 });
    expect(snapshot.durationSeconds).toBe(ticksToSeconds(raw.config.durationTicks, 128));
    expect(snapshot.source).toEqual({
      trackName: 'tracks/spike-fixture',
      projectName: 'projects/spike-fixture-uuid',
      commitIndex: 42,
    });
  });

  it('sorts tracks by orderAmongTracks', () => {
    expect(snapshot.tracks.map((t) => t.id)).toEqual([
      'track-note-1',
      'track-audio-1',
      'track-note-2',
      'track-pattern-1',
    ]);
    expect(snapshot.tracks[0]?.label).toBe('Lead');
    expect(snapshot.tracks[0]?.colorIndex).toBe(4);
  });

  it('uses outer span for region timing in seconds', () => {
    const intro = snapshot.regions.find((r) => r.id === 'region-note-1');
    expect(intro).toMatchObject({
      kind: 'note',
      trackId: 'track-note-1',
      startSeconds: ticksToSeconds(0, 128),
      durationSeconds: ticksToSeconds(15360, 128),
      label: 'Intro',
      colorIndex: 4,
    });
    const vox = snapshot.regions.find((r) => r.id === 'region-audio-1');
    expect(vox?.startSeconds).toBe(ticksToSeconds(7680, 128));
    expect(vox?.durationSeconds).toBe(ticksToSeconds(46080, 128));
  });

  it('omits disabled regions', () => {
    expect(snapshot.regions.some((r) => r.id === 'region-note-disabled')).toBe(false);
    expect(snapshot.regions).toHaveLength(4);
  });

  it('includes pattern index on pattern regions', () => {
    const pattern = snapshot.regions.find((r) => r.id === 'region-pattern-1');
    expect(pattern?.patternIndex).toBe(2);
  });

  it('resolves notes via noteCollection id (not noteRegion id)', () => {
    const introRegion = raw.noteRegions.find((r) => r.id === 'region-note-1');
    expect(introRegion?.collectionEntityId).toBe('collection-note-1');
    expect(introRegion?.id).not.toBe(introRegion?.collectionEntityId);
    expect(raw.notes.every((n) => n.collectionEntityId === 'collection-note-1')).toBe(true);
  });

  it('maps notes from enabled note regions with absolute timeline seconds', () => {
    expect(snapshot.notes).toHaveLength(3);
    const first = snapshot.notes?.[0];
    expect(first).toMatchObject({
      id: 'note-1@region-note-1',
      collectionId: 'collection-note-1',
      trackId: 'track-note-1',
      pitch: 60,
      velocity: 0.85,
      startSeconds: ticksToSeconds(0, 128),
      durationSeconds: ticksToSeconds(1920, 128),
    });
    expect(snapshot.notes?.some((n) => n.id.startsWith('note-2@'))).toBe(true);
    expect(snapshot.notes?.some((n) => n.collectionId === 'collection-note-disabled')).toBe(
      false
    );
  });

  it('exposes empty automation stubs for task 05', () => {
    expect(snapshot.automationTracks).toEqual([]);
  });
});

describe('buildArrangementSnapshot loop-aware notes', () => {
  const loopRegion: RawNoteRegion = {
    id: 'region-looped',
    collectionEntityId: 'coll-1',
    trackEntityId: 'track-1',
    region: {
      positionTicks: 10_000,
      durationTicks: 16_000,
      loopOffsetTicks: 0,
      loopDurationTicks: 4_000,
      collectionOffsetTicks: 0,
      isEnabled: true,
    },
  };

  const singleNote: RawNote = {
    id: 'n-c4',
    collectionEntityId: 'coll-1',
    positionTicks: 500,
    durationTicks: 800,
    pitch: 60,
    velocity: 1,
  };

  it('keeps non-looped placement when loopDuration equals region duration', () => {
    const raw = minimalRaw({
      noteRegions: [
        {
          ...loopRegion,
          region: {
            ...loopRegion.region,
            positionTicks: 0,
            durationTicks: 8_000,
            loopDurationTicks: 8_000,
          },
        },
      ],
      notes: [singleNote],
    });
    const notes = buildArrangementSnapshot(raw).notes ?? [];
    expect(notes).toHaveLength(1);
    expect(notes[0]?.startSeconds).toBe(ticksToSeconds(500, BPM));
    expect(notes[0]?.id).toBe('n-c4@region-looped');
  });

  it('repeats notes across loop iterations (4× when duration is 4× loop length)', () => {
    const raw = minimalRaw({
      noteRegions: [loopRegion],
      notes: [singleNote],
    });
    const notes = buildArrangementSnapshot(raw).notes ?? [];
    expect(notes).toHaveLength(4);
    const expectedStarts = [10_500, 14_500, 18_500, 22_500].map((t) =>
      ticksToSeconds(t, BPM)
    );
    expect(notes.map((n) => n.startSeconds)).toEqual(expectedStarts);
    expect(notes[0]?.id).toBe('n-c4@region-looped');
    expect(notes[1]?.id).toBe('n-c4@region-looped@loop1');
    expect(notes.every((n) => n.pitch === 60)).toBe(true);
  });

  it('omits notes from disabled regions', () => {
    const raw = minimalRaw({
      noteRegions: [{ ...loopRegion, region: { ...loopRegion.region, isEnabled: false } }],
      notes: [singleNote],
    });
    expect(buildArrangementSnapshot(raw).notes).toHaveLength(0);
  });

  it('omits notes on disabled note tracks', () => {
    const raw = minimalRaw({
      noteRegions: [loopRegion],
      notes: [singleNote],
      noteTracks: [
        {
          id: 'track-1',
          orderAmongTracks: 0,
          isEnabled: false,
          playerEntityId: 'dev-1',
        },
      ],
    });
    expect(buildArrangementSnapshot(raw).notes).toHaveLength(0);
  });

  it('aligns collection start with loopOffset and collectionOffset (Region diagram)', () => {
    const region: RawNoteRegion = {
      id: 'region-offset',
      collectionEntityId: 'coll-2',
      trackEntityId: 'track-1',
      region: {
        positionTicks: 0,
        durationTicks: 10_000,
        loopOffsetTicks: 2_000,
        loopDurationTicks: 5_000,
        collectionOffsetTicks: -1_000,
        isEnabled: true,
      },
    };
    const note: RawNote = {
      id: 'n-at-zero',
      collectionEntityId: 'coll-2',
      positionTicks: 0,
      durationTicks: 400,
      pitch: 72,
      velocity: 0.5,
    };
    const instances = expandNoteInstancesForRegion(region, note, BPM);
    const collectionStartTicks = 0 + 2_000 - (-1_000);
    expect(instances[0]?.startSeconds).toBe(ticksToSeconds(collectionStartTicks, BPM));
    expect(instances[1]?.startSeconds).toBe(
      ticksToSeconds(collectionStartTicks + 5_000, BPM)
    );
  });

  it('emits one placement per region that shares the same NoteCollection', () => {
    const sharedCollection = 'coll-shared';
    const note: RawNote = {
      id: 'n-shared',
      collectionEntityId: sharedCollection,
      positionTicks: 0,
      durationTicks: 480,
      pitch: 48,
      velocity: 1,
    };
    const raw = minimalRaw({
      noteRegions: [
        {
          id: 'region-a',
          collectionEntityId: sharedCollection,
          trackEntityId: 'track-1',
          region: {
            positionTicks: 0,
            durationTicks: 7_680,
            isEnabled: true,
          },
        },
        {
          id: 'region-b',
          collectionEntityId: sharedCollection,
          trackEntityId: 'track-1',
          region: {
            positionTicks: 7_680,
            durationTicks: 7_680,
            isEnabled: true,
          },
        },
      ],
      notes: [note],
    });
    const notes = buildArrangementSnapshot(raw).notes ?? [];
    expect(notes).toHaveLength(2);
    expect(notes.map((n) => n.startSeconds).sort((a, b) => a - b)).toEqual([
      ticksToSeconds(0, BPM),
      ticksToSeconds(7_680, BPM),
    ]);
    expect(notes.map((n) => n.id).sort()).toEqual(['n-shared@region-a', 'n-shared@region-b']);
  });

  it('emits no instances when the note never overlaps the region span', () => {
    const region: RawNoteRegion = {
      ...loopRegion,
      region: {
        ...loopRegion.region,
        positionTicks: 0,
        durationTicks: 1_000,
        loopDurationTicks: 4_000,
      },
    };
    const lateNote: RawNote = {
      ...singleNote,
      id: 'n-late',
      positionTicks: 50_000,
    };
    expect(expandNoteInstancesForRegion(region, lateNote, BPM)).toHaveLength(0);
  });

  it('clips note duration to region outer end', () => {
    const region: RawNoteRegion = {
      id: 'region-tail',
      collectionEntityId: 'coll-1',
      trackEntityId: 'track-1',
      region: {
        positionTicks: 0,
        durationTicks: 1_000,
        loopOffsetTicks: 0,
        loopDurationTicks: 10_000,
        collectionOffsetTicks: 0,
        isEnabled: true,
      },
    };
    const longNote: RawNote = {
      ...singleNote,
      positionTicks: 200,
      durationTicks: 5_000,
    };
    const [inst] = expandNoteInstancesForRegion(region, longNote, BPM);
    expect(inst?.durationSeconds).toBe(ticksToSeconds(800, BPM));
  });
});

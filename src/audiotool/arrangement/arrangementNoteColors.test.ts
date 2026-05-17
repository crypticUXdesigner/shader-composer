import { describe, it, expect } from 'vitest';
import { buildArrangementSnapshot } from './buildArrangementSnapshot';
import spikeFixture from './__fixtures__/spike-arrangement-raw.json';
import type { RawArrangementEntities } from './rawEntities';
import {
  NOTE_COLOR_MODE,
  MONO_DARK_LINEAR_RGB,
  MONO_LIGHT_LINEAR_RGB,
  parseTrackNoteColors,
  paletteLinearRgbFromPitch,
  projectColorDataForNote,
  resolveCustomTrackTableLinearRgb,
  serializeProjectTrackNoteColorsForTracks,
  serializeTrackNoteColors,
} from './arrangementNoteColors';

const raw = spikeFixture as RawArrangementEntities;
const snapshot = buildArrangementSnapshot(raw);

describe('arrangementNoteColors', () => {
  it('parses and serializes track note colors', () => {
    const rawColors = 'track-a:0.5:0.1:120;track-b:0.6:0.08:200';
    const parsed = parseTrackNoteColors(rawColors);
    expect(parsed.get('track-a')).toEqual({ l: 0.5, c: 0.1, h: 120 });
    const roundTrip = parseTrackNoteColors(serializeTrackNoteColors(parsed));
    expect(roundTrip.get('track-a')).toEqual({ l: 0.5, c: 0.1, h: 120 });
    expect(roundTrip.get('track-b')?.l).toBeCloseTo(0.6, 5);
  });

  it('projectColorDataForNote uses track colorIndex when present', () => {
    const data = projectColorDataForNote('track-note-1', snapshot.tracks);
    expect(data.colorIndex).toBe(4);
    expect(data.trackRow).toBeGreaterThanOrEqual(0);
  });

  it('resolveCustomTrackTableLinearRgb builds one entry per visible track', () => {
    const noteTracks = snapshot.tracks.filter((t) => t.kind === 'note');
    const table = resolveCustomTrackTableLinearRgb(noteTracks, new Map());
    expect(table.length).toBe(noteTracks.length);
    expect(table[0]?.r).toBeGreaterThan(0);
  });

  it('paletteLinearRgbFromPitch differs from mono constants', () => {
    expect(paletteLinearRgbFromPitch(60)).not.toEqual(MONO_LIGHT_LINEAR_RGB);
    expect(paletteLinearRgbFromPitch(60)).not.toEqual(MONO_DARK_LINEAR_RGB);
  });

  it('serializeProjectTrackNoteColorsForTracks emits entries for visible tracks', () => {
    const noteTracks = snapshot.tracks.filter((t) => t.kind === 'note');
    const serialized = serializeProjectTrackNoteColorsForTracks(noteTracks);
    expect(serialized).toContain('track-note-1');
    expect(parseTrackNoteColors(serialized).size).toBeGreaterThan(0);
  });
});

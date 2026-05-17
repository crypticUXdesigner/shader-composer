import { describe, it, expect } from 'vitest';
import { buildArrangementSnapshot } from './buildArrangementSnapshot';
import type { RawArrangementEntities } from './rawEntities';
import spikeFixture from './__fixtures__/spike-arrangement-raw.json';
import {
  buildTrackFilterParams,
  listArrangementTracksForFilter,
  parseTrackFilterList,
  readSelectedTrackIds,
  arrangementTrackFilterButtonLabel,
  pickDefaultArrangementNotesTrackId,
  defaultArrangementNotesTrackFilter,
  wouldExceedArrangementBakeCap,
} from './arrangementTrackFilter';
import { MAX_ARRANGEMENT_NOTES_PACKED } from './types';

const snapshot = buildArrangementSnapshot(spikeFixture as RawArrangementEntities);

describe('arrangementTrackFilter', () => {
  it('lists note tracks with counts for notes node filter', () => {
    const rows = listArrangementTracksForFilter(snapshot, {
      kinds: new Set(['note']),
      hideEmpty: true,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe('track-note-1');
    expect(rows[0]?.noteCount).toBe(3);
  });

  it('hideEmpty on note tracks omits lanes with zero notes even when regions exist', () => {
    const withEmptyNoteLane: typeof snapshot = {
      ...snapshot,
      tracks: [
        ...snapshot.tracks,
        {
          id: 'track-note-empty',
          kind: 'note',
          label: 'Empty MIDI',
          enabled: true,
          orderAmongTracks: 99,
        },
      ],
      regions: [
        ...snapshot.regions,
        {
          id: 'reg-empty',
          trackId: 'track-note-empty',
          startSeconds: 0,
          durationSeconds: 4,
          enabled: true,
          colorIndex: 0,
          loop: false,
        },
      ],
    };
    const rows = listArrangementTracksForFilter(withEmptyNoteLane, {
      kinds: new Set(['note']),
      hideEmpty: true,
      hideEmptyMetric: 'notes',
    });
    expect(rows.map((r) => r.id)).toEqual(['track-note-1']);
  });

  it('hideEmpty on lanes list omits tracks with zero regions', () => {
    const rows = listArrangementTracksForFilter(snapshot, {
      hideEmpty: true,
      hideEmptyMetric: 'regions',
    });
    expect(rows.every((r) => r.regionCount > 0)).toBe(true);
    expect(rows.some((r) => r.id === 'track-audio-1')).toBe(true);
  });

  it('readSelectedTrackIds treats mode 0 as all tracks', () => {
    const ids = ['track-note-1'];
    expect(readSelectedTrackIds(0, '', ids)).toEqual(new Set(ids));
  });

  it('buildTrackFilterParams uses mode 0 when all tracks selected', () => {
    const all = ['a', 'b'];
    expect(buildTrackFilterParams(all, all)).toEqual({
      trackFilterMode: 0,
      trackFilterList: '',
    });
  });

  it('buildTrackFilterParams uses mode 1 subset', () => {
    expect(buildTrackFilterParams(['a'], ['a', 'b'])).toEqual({
      trackFilterMode: 1,
      trackFilterList: 'a',
    });
  });

  it('buildTrackFilterParams preserves id order in trackFilterList', () => {
    expect(buildTrackFilterParams(['b', 'a'], ['a', 'b', 'c'])).toEqual({
      trackFilterMode: 1,
      trackFilterList: 'b,a',
    });
  });

  it('pickDefaultArrangementNotesTrackId returns the only note lane in spike fixture', () => {
    expect(pickDefaultArrangementNotesTrackId(snapshot)).toBe('track-note-1');
    expect(defaultArrangementNotesTrackFilter(snapshot)).toEqual({
      trackFilterMode: 1,
      trackFilterList: 'track-note-1',
    });
  });

  it('pickDefaultArrangementNotesTrackId prefers ~400 notes under bake cap', () => {
    const multi: typeof snapshot = {
      ...snapshot,
      tracks: [
        { id: 't-small', kind: 'note', label: 'Small', enabled: true, orderAmongTracks: 0 },
        { id: 't-mid', kind: 'note', label: 'Mid', enabled: true, orderAmongTracks: 1 },
        { id: 't-huge', kind: 'note', label: 'Huge', enabled: true, orderAmongTracks: 2 },
      ],
      notes: [
        ...Array.from({ length: 50 }, (_, i) => ({
          id: `n-s-${i}`,
          collectionId: 'c',
          trackId: 't-small',
          startSeconds: i,
          durationSeconds: 0.1,
          pitch: 60,
          velocity: 100,
        })),
        ...Array.from({ length: 420 }, (_, i) => ({
          id: `n-m-${i}`,
          collectionId: 'c',
          trackId: 't-mid',
          startSeconds: i,
          durationSeconds: 0.1,
          pitch: 62,
          velocity: 100,
        })),
        ...Array.from({ length: MAX_ARRANGEMENT_NOTES_PACKED + 100 }, (_, i) => ({
          id: `n-h-${i}`,
          collectionId: 'c',
          trackId: 't-huge',
          startSeconds: i,
          durationSeconds: 0.1,
          pitch: 64,
          velocity: 100,
        })),
      ],
    };
    expect(pickDefaultArrangementNotesTrackId(multi)).toBe('t-mid');
  });

  it('wouldExceedArrangementBakeCap blocks adds that cross the cap', () => {
    expect(wouldExceedArrangementBakeCap(2047, 1, MAX_ARRANGEMENT_NOTES_PACKED)).toBe(false);
    expect(wouldExceedArrangementBakeCap(2048, 0, MAX_ARRANGEMENT_NOTES_PACKED)).toBe(false);
    expect(wouldExceedArrangementBakeCap(2048, 1, MAX_ARRANGEMENT_NOTES_PACKED)).toBe(true);
  });

  it('button label reflects subset when multiple tracks exist', () => {
    const rows = listArrangementTracksForFilter(snapshot, { kinds: new Set(['note', 'audio']) });
    const label = arrangementTrackFilterButtonLabel(
      rows,
      parseTrackFilterList('track-note-1')
    );
    expect(label).toBe('1 / 2 tracks');
  });
});

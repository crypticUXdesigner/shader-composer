import { ticksToSeconds } from '@audiotool/nexus/utils';
import {
  MAX_ARRANGEMENT_NOTES,
  type ArrangementNote,
  type ArrangementRegion,
  type ArrangementSnapshot,
  type ArrangementTrack,
  type ArrangementTrackKind,
} from './types';
import type {
  RawArrangementEntities,
  RawAudioRegion,
  RawNote,
  RawNoteRegion,
  RawNoteTrack,
  RawPatternRegion,
} from './rawEntities';

function ticksAtBpm(ticks: number, bpm: number): number {
  return ticksToSeconds(ticks, bpm);
}

function trackLabel(
  track: RawNoteTrack,
  entityLabels: RawArrangementEntities['entityLabels']
): string | undefined {
  const fromPlayer = entityLabels[track.playerEntityId];
  return fromPlayer?.trim() ? fromPlayer.trim() : undefined;
}

function mapTracks(
  kind: ArrangementTrackKind,
  rows: RawNoteTrack[],
  entityLabels: RawArrangementEntities['entityLabels'],
  firstRegionColorByTrack: Map<string, number>
): ArrangementTrack[] {
  return rows.map((t) => {
    const colorIndex = firstRegionColorByTrack.get(t.id);
    const label = trackLabel(t, entityLabels);
    const out: ArrangementTrack = {
      id: t.id,
      kind,
      orderAmongTracks: t.orderAmongTracks,
      enabled: t.isEnabled,
    };
    if (label !== undefined) out.label = label;
    if (colorIndex !== undefined) out.colorIndex = colorIndex;
    return out;
  });
}

function regionFromRaw(
  kind: ArrangementRegion['kind'],
  row: RawNoteRegion | RawPatternRegion,
  bpm: number
): ArrangementRegion | undefined {
  const r = row.region;
  if (!r.isEnabled) return undefined;

  const startSeconds = ticksAtBpm(r.positionTicks, bpm);
  const durationSeconds = ticksAtBpm(r.durationTicks, bpm);
  const label = r.displayName?.trim() ? r.displayName.trim() : undefined;

  const out: ArrangementRegion = {
    id: row.id,
    trackId: row.trackEntityId,
    kind,
    startSeconds,
    durationSeconds,
    enabled: true,
  };
  if (label !== undefined) out.label = label;
  if (r.colorIndex !== undefined) out.colorIndex = r.colorIndex;
  if (kind === 'pattern' && 'patternIndex' in row && row.patternIndex !== undefined) {
    out.patternIndex = row.patternIndex;
  }
  return out;
}

function collectRegions(
  kind: ArrangementRegion['kind'],
  rows: Array<RawNoteRegion | RawAudioRegion | RawPatternRegion>,
  bpm: number,
  firstRegionColorByTrack: Map<string, number>
): ArrangementRegion[] {
  const out: ArrangementRegion[] = [];
  for (const row of rows) {
    const mapped = regionFromRaw(kind, row, bpm);
    if (mapped === undefined) continue;
    out.push(mapped);
    if (
      mapped.colorIndex !== undefined &&
      !firstRegionColorByTrack.has(mapped.trackId)
    ) {
      firstRegionColorByTrack.set(mapped.trackId, mapped.colorIndex);
    }
  }
  return out;
}

function sortTracks(tracks: ArrangementTrack[]): ArrangementTrack[] {
  return [...tracks].sort((a, b) => {
    if (a.orderAmongTracks !== b.orderAmongTracks) {
      return a.orderAmongTracks - b.orderAmongTracks;
    }
    return a.id.localeCompare(b.id);
  });
}

function sortRegions(regions: ArrangementRegion[]): ArrangementRegion[] {
  return [...regions].sort((a, b) => {
    if (a.startSeconds !== b.startSeconds) return a.startSeconds - b.startSeconds;
    if (a.trackId !== b.trackId) return a.trackId.localeCompare(b.trackId);
    return a.id.localeCompare(b.id);
  });
}

function sortNotes(notes: ArrangementNote[]): ArrangementNote[] {
  return [...notes].sort((a, b) => {
    if (a.startSeconds !== b.startSeconds) return a.startSeconds - b.startSeconds;
    if (a.pitch !== b.pitch) return a.pitch - b.pitch;
    return a.id.localeCompare(b.id);
  });
}

/**
 * v1 "muted" for arrangement notes: disabled note region or disabled note track.
 */
function isNoteRegionAudible(
  region: RawNoteRegion,
  enabledTrackIds: ReadonlySet<string>
): boolean {
  return region.region.isEnabled && enabledTrackIds.has(region.trackEntityId);
}

/**
 * Expand one collection note into audible global-timeline instances (loop repetitions).
 * Collection start on timeline = position + loopOffset - collectionOffset (Audiotool Region).
 */
function expandNoteInstancesForRegion(
  region: RawNoteRegion,
  note: RawNote,
  bpm: number
): ArrangementNote[] {
  const r = region.region;
  const positionTicks = r.positionTicks;
  const durationTicks = r.durationTicks;
  const collectionOffset = r.collectionOffsetTicks ?? 0;
  const loopOffset = r.loopOffsetTicks ?? 0;
  const loopDuration =
    r.loopDurationTicks !== undefined && r.loopDurationTicks > 0
      ? r.loopDurationTicks
      : durationTicks;

  const phaseInLoop = note.positionTicks - collectionOffset;
  const instances: ArrangementNote[] = [];

  for (let i = 0; ; i++) {
    const regionLocalStart = loopOffset + phaseInLoop + i * loopDuration;
    if (regionLocalStart >= durationTicks) break;

    const globalStartTicks = positionTicks + regionLocalStart;
    const globalEndTicks = Math.min(
      positionTicks + durationTicks,
      globalStartTicks + note.durationTicks
    );
    if (globalEndTicks <= globalStartTicks) continue;

    const id =
      i === 0 ? `${note.id}@${region.id}` : `${note.id}@${region.id}@loop${i}`;
    instances.push({
      id,
      collectionId: note.collectionEntityId,
      trackId: region.trackEntityId,
      startSeconds: ticksAtBpm(globalStartTicks, bpm),
      durationSeconds: ticksAtBpm(globalEndTicks - globalStartTicks, bpm),
      pitch: note.pitch,
      velocity: note.velocity,
    });
  }

  return instances;
}

/** Group enabled note regions by shared NoteCollection (many regions can reference one clip). */
function indexAudibleRegionsByCollection(
  noteRegions: RawNoteRegion[],
  enabledTrackIds: ReadonlySet<string>
): Map<string, RawNoteRegion[]> {
  const byCollection = new Map<string, RawNoteRegion[]>();
  for (const row of noteRegions) {
    if (!isNoteRegionAudible(row, enabledTrackIds)) continue;
    const list = byCollection.get(row.collectionEntityId);
    if (list === undefined) {
      byCollection.set(row.collectionEntityId, [row]);
    } else {
      list.push(row);
    }
  }
  return byCollection;
}

/**
 * Notes from enabled note regions on enabled note tracks; matches hearable MIDI including
 * loop repetitions inside looped regions.
 */
function collectNotes(
  noteRegions: RawNoteRegion[],
  noteTracks: RawNoteTrack[],
  rawNotes: RawNote[],
  bpm: number
): ArrangementNote[] {
  const enabledTrackIds = new Set(
    noteTracks.filter((t) => t.isEnabled).map((t) => t.id)
  );

  const regionsByCollection = indexAudibleRegionsByCollection(
    noteRegions,
    enabledTrackIds
  );

  const out: ArrangementNote[] = [];
  for (const note of rawNotes) {
    const regions = regionsByCollection.get(note.collectionEntityId);
    if (regions === undefined) continue;

    for (const region of regions) {
      const instances = expandNoteInstancesForRegion(region, note, bpm);
      for (const inst of instances) {
        out.push(inst);
        if (out.length >= MAX_ARRANGEMENT_NOTES) return sortNotes(out);
      }
    }
  }

  return sortNotes(out);
}

/**
 * Build a normalized {@link ArrangementSnapshot} from extracted document entities.
 * Uses outer `positionTicks` / `durationTicks` only; disabled regions are omitted.
 */
export function buildArrangementSnapshot(raw: RawArrangementEntities): ArrangementSnapshot {
  const { config } = raw;
  const bpm = config.tempoBpm > 0 ? config.tempoBpm : 125;
  const durationSeconds = ticksAtBpm(config.durationTicks, bpm);
  const firstRegionColorByTrack = new Map<string, number>();

  const noteRegions = collectRegions('note', raw.noteRegions, bpm, firstRegionColorByTrack);
  const audioRegions = collectRegions('audio', raw.audioRegions, bpm, firstRegionColorByTrack);
  const patternRegions = collectRegions(
    'pattern',
    raw.patternRegions,
    bpm,
    firstRegionColorByTrack
  );

  const tracks = sortTracks([
    ...mapTracks('note', raw.noteTracks, raw.entityLabels, firstRegionColorByTrack),
    ...mapTracks('audio', raw.audioTracks, raw.entityLabels, firstRegionColorByTrack),
    ...mapTracks('pattern', raw.patternTracks, raw.entityLabels, firstRegionColorByTrack),
  ]);

  const regions = sortRegions([...noteRegions, ...audioRegions, ...patternRegions]);
  const notes = collectNotes(raw.noteRegions, raw.noteTracks, raw.notes ?? [], bpm);

  return {
    tracks,
    regions,
    notes,
    bpm,
    durationSeconds,
    timeSignature: {
      numerator: config.signatureNumerator,
      denominator: config.signatureDenominator,
    },
    source: raw.source,
    automationTracks: [],
  };
}

/** @internal Exported for tests — tick → second at constant BPM. */
export function arrangementTicksToSeconds(ticks: number, bpm: number): number {
  return ticksAtBpm(ticks, bpm);
}

/** @internal Read outer region fields from Nexus-like shape in tests. */
export type { RawNoteTrack };

/** @internal Loop-aware note expansion for unit tests. */
export { expandNoteInstancesForRegion, indexAudibleRegionsByCollection, isNoteRegionAudible };

import type {
  ArrangementRegionKind,
  ArrangementSnapshotSource,
  ArrangementTrackKind,
} from './types';

/** Serializable region submessage (outer span; loop fields used for note expansion). */
export type RawRegionFields = {
  positionTicks: number;
  durationTicks: number;
  isEnabled: boolean;
  displayName?: string;
  colorIndex?: number;
  /** Nexus default 0 — loop start offset within the region (region-local ticks). */
  loopOffsetTicks?: number;
  /** Nexus default `durationTicks` when unset — one loop cycle length (region-local ticks). */
  loopDurationTicks?: number;
};

export type RawNoteTrack = {
  id: string;
  orderAmongTracks: number;
  isEnabled: boolean;
  playerEntityId: string;
};

export type RawAudioTrack = RawNoteTrack;
export type RawPatternTrack = RawNoteTrack;

export type RawNoteRegion = {
  id: string;
  /** Nexus `noteRegion.collection` → {@link NoteCollection} entity id. */
  collectionEntityId: string;
  trackEntityId: string;
  region: RawRegionFields & {
    collectionOffsetTicks?: number;
  };
};

export type RawNote = {
  id: string;
  /** Nexus `note.collection` → same {@link NoteCollection} id as the parent region. */
  collectionEntityId: string;
  positionTicks: number;
  durationTicks: number;
  pitch: number;
  velocity: number;
};

export type RawTimelineRegion = {
  id: string;
  trackEntityId: string;
  region: RawRegionFields;
};

export type RawAudioRegion = RawTimelineRegion;

export type RawPatternRegion = RawTimelineRegion & {
  patternIndex?: number;
};

export type RawConfig = {
  tempoBpm: number;
  signatureNumerator: number;
  signatureDenominator: number;
  durationTicks: number;
};

/** Device labels keyed by entity id (from `displayName` when present). */
export type RawEntityLabels = Record<string, string>;

export type RawArrangementEntities = {
  config: RawConfig;
  noteTracks: RawNoteTrack[];
  audioTracks: RawAudioTrack[];
  patternTracks: RawPatternTrack[];
  noteRegions: RawNoteRegion[];
  audioRegions: RawAudioRegion[];
  patternRegions: RawPatternRegion[];
  notes: RawNote[];
  entityLabels: RawEntityLabels;
  source: ArrangementSnapshotSource;
};

export const TRACK_KIND_BY_RAW: Record<ArrangementTrackKind, keyof Pick<
  RawArrangementEntities,
  'noteTracks' | 'audioTracks' | 'patternTracks'
>> = {
  note: 'noteTracks',
  audio: 'audioTracks',
  pattern: 'patternTracks',
};

export const REGION_KIND_BY_RAW: Record<ArrangementRegionKind, keyof Pick<
  RawArrangementEntities,
  'noteRegions' | 'audioRegions' | 'patternRegions'
>> = {
  note: 'noteRegions',
  audio: 'audioRegions',
  pattern: 'patternRegions',
};

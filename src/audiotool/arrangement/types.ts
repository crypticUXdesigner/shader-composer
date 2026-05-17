/**
 * Normalized arrangement snapshot for ShaderNoice (import-once from Audiotool publish commit).
 * Consumers must not import `@audiotool/nexus` — only this module's types and helpers.
 *
 * **Spike caps (typical published projects, manual sample n≈12):** ~8–24 tracks, ~20–180 regions,
 * notes often 0–4k when present. GPU packing limits below are conservative headroom for tasks 03–04.
 */
export const MAX_ARRANGEMENT_REGIONS = 512;
/** Importer cap for notes in snapshot JSON. */
export const MAX_ARRANGEMENT_NOTES = 8192;
/** Compile-time bake cap per arrangement-notes node (shader loop bound). */
export const MAX_ARRANGEMENT_NOTES_PACKED = 2048;
/**
 * Above this baked note count the per-pixel scan is likely too heavy for interactive preview
 * (see visible-window loop uniforms in arrangementNotesPreviewLoop). Tracks UI warns; shader still packs up to
 * {@link MAX_ARRANGEMENT_NOTES_PACKED}.
 */
export const ARRANGEMENT_NOTES_PERFORMANCE_WARN_COUNT = 512;
/**
 * Max notes the preview fragment shader may scan per pixel each frame when many notes overlap the
 * visible timeline window ({@link arrangementNotesPreviewLoop} clamps `noteLoopStart`/`noteLoopEnd`).
 * {@link resolveArrangementNotesPreviewLoopBudget} may return less when the bake is large.
 */
export const ARRANGEMENT_NOTES_PREVIEW_LOOP_BUDGET = 512;
/**
 * Above this filtered note count, {@link packArrangementNotesForGlsl} evenly subsamples the sorted
 * bake so compile-time literals and GPU arrays stay within an interactive budget (Tracks may show a higher count).
 */
export const ARRANGEMENT_NOTES_INTERACTIVE_PACK_LIMIT = 1280;

export type ArrangementTrackKind = 'note' | 'audio' | 'pattern';

export type ArrangementRegionKind = 'note' | 'audio' | 'pattern';

export type ArrangementTimeSignature = {
  numerator: number;
  denominator: number;
};

/** Playlist track + project identity at import time (publish commit). */
export type ArrangementSnapshotSource = {
  /** Audiotool playlist resource name, e.g. `tracks/{id}`. */
  trackName: string;
  /** Nexus project resource name, e.g. `projects/{uuid}`. */
  projectName: string;
  /** Publish commit index from `GetTrack`; `0` when unknown / latest-only import. */
  commitIndex: number;
};

export type ArrangementTrack = {
  id: string;
  kind: ArrangementTrackKind;
  orderAmongTracks: number;
  enabled: boolean;
  /** Resolved from player device `displayName` when available. */
  label?: string;
  /** First region color on the track, when any. */
  colorIndex?: number;
};

export type ArrangementRegion = {
  id: string;
  trackId: string;
  kind: ArrangementRegionKind;
  /** Outer span start on the global timeline (seconds). */
  startSeconds: number;
  /** Outer span duration on the global timeline (seconds). */
  durationSeconds: number;
  enabled: boolean;
  label?: string;
  colorIndex?: number;
  /** Pattern regions only. */
  patternIndex?: number;
};

export type ArrangementNote = {
  id: string;
  collectionId: string;
  trackId: string;
  startSeconds: number;
  durationSeconds: number;
  pitch: number;
  velocity: number;
};

/** Automation tracks stub for pillar 3 (task 05). */
export type ArrangementAutomationTrackStub = {
  id: string;
  label?: string;
};

export type ArrangementSnapshot = {
  tracks: ArrangementTrack[];
  regions: ArrangementRegion[];
  notes?: ArrangementNote[];
  bpm: number;
  durationSeconds: number;
  timeSignature: ArrangementTimeSignature;
  source: ArrangementSnapshotSource;
  /** Reserved for task 05. */
  automationTracks?: ArrangementAutomationTrackStub[];
};

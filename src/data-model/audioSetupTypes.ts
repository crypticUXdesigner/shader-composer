/**
 * Audio Setup Data Model Types
 *
 * Per JOINT_BRIEFING §5.1: AudioSetup with files, bands, remappers.
 * Audio is configured outside the visual node graph and exposed via named signals.
 * Playlist-waveform: primary source (playlist track or upload) and playlist state.
 */

import type { ArrangementSnapshot } from '../audiotool/arrangement/types';

export interface AudioFileEntry {
  id: string;
  name: string;
  filePath?: string;
  autoPlay: boolean;
}

export type AudioBandMode =
  | 'mean'
  | 'max'
  | 'rms';

export interface AudioBandEntry {
  id: string;
  name: string;
  sourceFileId: string;
  frequencyBands: [[number, number]];
  /**
   * How the FFT range is reduced to a single value.
   * Persisted on disk; keep string values stable.
   */
  bandMode?: AudioBandMode;
  /**
   * Time-based symmetric smoothing half-life (seconds): after this duration, half of the previous value remains.
   * 0 means immediate response. Infinity means frozen.
   */
  smoothingHalfLifeSeconds?: number;
  /** Future: time-based half-life for rising edges (seconds). */
  attackHalfLifeSeconds?: number;
  /** Future: time-based half-life for falling edges (seconds). */
  releaseHalfLifeSeconds?: number;
  fftSize: number;
  remapInMin?: number;
  remapInMax?: number;
  remapOutMin?: number;
  remapOutMax?: number;
}

export interface AudioRemapperEntry {
  id: string;
  name: string;
  bandId: string;
  inMin: number;
  inMax: number;
  outMin: number;
  outMax: number;
}

/**
 * Provenance for persisted playlist display metadata (denormalized; trackId remains canonical identity).
 */
export type PlaylistDisplayNameSource =
  | 'bundled'
  | 'audiotool'
  | 'user-cache'
  | 'unknown';

/** Primary when user selected a bundled or Audiotool playlist entry. */
export interface PlaylistPrimarySource {
  type: 'playlist';
  trackId: string;
  /** Last-known human-readable title — may lag renames on the Audiotool side. */
  displayName?: string;
  displayNameSource?: PlaylistDisplayNameSource;
  /** ISO timestamp when display metadata was written (persisted selection or hydration). */
  displayNameUpdatedAt?: string;
}

/** Primary source: one playlist track (by id) or one uploaded file. */
export type PrimarySource = PlaylistPrimarySource | { type: 'upload'; file: AudioFileEntry };

/** Metadata passed from the track picker when a list row is chosen (omit for programmatic switches). */
export interface PlaylistTrackPickMeta {
  displayName: string;
  displayNameSource: PlaylistDisplayNameSource;
}

/** Playlist state: order (track ids), current index, loop current track flag. */
export interface PlaylistState {
  order: string[];
  currentIndex: number;
  loopCurrentTrack: boolean;
}

export interface AudioSetup {
  files: AudioFileEntry[];
  bands: AudioBandEntry[];
  remappers: AudioRemapperEntry[];
  /** Explicit primary source (playlist track or upload). When absent, legacy: first file is primary. */
  primarySource?: PrimarySource;
  /** Playlist order and index; used when primarySource.type === 'playlist'. */
  playlistState?: PlaylistState;
  /**
   * One-shot DAW arrangement imported from the playlist track's published project (Audiotool).
   * Cleared when primary switches to upload or a different track.
   */
  arrangementSnapshot?: ArrangementSnapshot;
  /** ISO timestamp when `arrangementSnapshot` was last imported. */
  arrangementImportedAt?: string;
}

/** Named audio signal ID (e.g. "band-1-raw", "remap-bass-kick") */
export type AudioSignalId = string;

/**
 * Returns the single primary file id used for loader/analyzer/export.
 * Playlist: trackId. Upload: file.id. Legacy: files[0]?.id.
 * Returns undefined when setup is absent or no primary file is available.
 */
export function getPrimaryFileId(setup: AudioSetup | null | undefined): string | undefined {
  if (!setup) return undefined;
  const primary = setup.primarySource;
  if (primary) {
    return primary.type === 'playlist' ? primary.trackId : primary.file.id;
  }
  return setup.files[0]?.id;
}

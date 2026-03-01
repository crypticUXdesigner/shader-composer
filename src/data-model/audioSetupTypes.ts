/**
 * Audio Setup Data Model Types
 *
 * Per JOINT_BRIEFING §5.1: AudioSetup with files, bands, remappers.
 * Audio is configured outside the visual node graph and exposed via named signals.
 * Playlist-waveform: primary source (playlist track or upload) and playlist state.
 */

export interface AudioFileEntry {
  id: string;
  name: string;
  filePath?: string;
  autoPlay: boolean;
}

export interface AudioBandEntry {
  id: string;
  name: string;
  sourceFileId: string;
  frequencyBands: [[number, number]];
  smoothing: number;
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

/** Primary source: one playlist track (by id) or one uploaded file. */
export type PrimarySource =
  | { type: 'playlist'; trackId: string }
  | { type: 'upload'; file: AudioFileEntry };

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

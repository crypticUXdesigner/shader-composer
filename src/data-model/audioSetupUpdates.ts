/**
 * Immutable Audio Setup Update Utilities
 *
 * Provides immutable update functions for AudioSetup.
 * All functions return new AudioSetup instances.
 */

import type { ArrangementSnapshot } from '../audiotool/arrangement/types';
import type {
  AudioSetup,
  AudioFileEntry,
  AudioBandEntry,
  AudioRemapperEntry,
  PrimarySource,
  PlaylistState,
} from './audioSetupTypes';
import { defaultRemapperEntryForBand, defaultRemapperIdForBand } from './audioBandRemapMigration';

function withDefaultBandMode(entry: AudioBandEntry): AudioBandEntry {
  if (entry.bandMode != null) return entry;
  return { ...entry, bandMode: 'mean' };
}

function copyFile(entry: AudioFileEntry): AudioFileEntry {
  return { ...entry };
}

function copyBand(entry: AudioBandEntry): AudioBandEntry {
  const normalized = withDefaultBandMode(entry);
  const band = entry.frequencyBands[0];
  const copy: [[number, number]] = band ? [[band[0], band[1]]] : [[0, 0]];
  return { ...normalized, frequencyBands: copy };
}

function copyRemapper(entry: AudioRemapperEntry): AudioRemapperEntry {
  return { ...entry };
}

export function addFile(setup: AudioSetup, file: AudioFileEntry): AudioSetup {
  return {
    ...setup,
    files: [copyFile(file), ...setup.files],
  };
}

export function updateFile(
  setup: AudioSetup,
  fileId: string,
  updater: (file: AudioFileEntry) => AudioFileEntry
): AudioSetup {
  const index = setup.files.findIndex((f) => f.id === fileId);
  if (index === -1) return setup;
  const newFiles = [...setup.files];
  newFiles[index] = updater(copyFile(setup.files[index]));
  return { ...setup, files: newFiles };
}

export function removeFile(setup: AudioSetup, fileId: string): AudioSetup {
  return {
    ...setup,
    files: setup.files.filter((f) => f.id !== fileId),
    bands: setup.bands.filter((b) => b.sourceFileId !== fileId),
    remappers: setup.remappers.filter((r) => {
      const band = setup.bands.find((b) => b.id === r.bandId);
      return band?.sourceFileId !== fileId;
    }),
  };
}

export function addBand(setup: AudioSetup, band: AudioBandEntry): AudioSetup {
  const copied = copyBand(band);
  const defaultId = defaultRemapperIdForBand(copied.id);
  const hasDefault = setup.remappers.some((r) => r.id === defaultId);
  const remappers = hasDefault
    ? setup.remappers
    : [copyRemapper(defaultRemapperEntryForBand(copied)), ...setup.remappers];
  return {
    ...setup,
    bands: [copied, ...setup.bands],
    remappers,
  };
}

export function updateBand(
  setup: AudioSetup,
  bandId: string,
  updater: (band: AudioBandEntry) => AudioBandEntry
): AudioSetup {
  const index = setup.bands.findIndex((b) => b.id === bandId);
  if (index === -1) return setup;
  const newBands = [...setup.bands];
  newBands[index] = updater(copyBand(setup.bands[index]));
  return { ...setup, bands: newBands };
}

export function removeBand(setup: AudioSetup, bandId: string): AudioSetup {
  return {
    ...setup,
    bands: setup.bands.filter((b) => b.id !== bandId),
    remappers: setup.remappers.filter((r) => r.bandId !== bandId),
  };
}

export function addRemapper(setup: AudioSetup, remapper: AudioRemapperEntry): AudioSetup {
  return {
    ...setup,
    remappers: [copyRemapper(remapper), ...setup.remappers],
  };
}

export function updateRemapper(
  setup: AudioSetup,
  remapperId: string,
  updater: (remapper: AudioRemapperEntry) => AudioRemapperEntry
): AudioSetup {
  const index = setup.remappers.findIndex((r) => r.id === remapperId);
  if (index === -1) return setup;
  const newRemappers = [...setup.remappers];
  newRemappers[index] = updater(copyRemapper(setup.remappers[index]));
  return { ...setup, remappers: newRemappers };
}

export function removeRemapper(setup: AudioSetup, remapperId: string): AudioSetup {
  return {
    ...setup,
    remappers: setup.remappers.filter((r) => r.id !== remapperId),
  };
}

const REMAPPER_TRAILING_NUMBER_RE = /^(.+?) (\d+)$/;

/**
 * Picks a remapper display name for a duplicate: same stem as the source, next free trailing number.
 * E.g. "Level" → "Level 2"; "Level 2" with "Level" present → "Level 3".
 */
export function duplicateRemapperName(
  sourceName: string,
  existingNames: readonly string[],
): string {
  const trimmed = sourceName.trim();
  const sourceMatch = trimmed.match(REMAPPER_TRAILING_NUMBER_RE);
  const stem = (sourceMatch ? sourceMatch[1] : trimmed) || 'Remapper';

  let maxSuffix = 0;
  for (const raw of existingNames) {
    const name = raw.trim();
    const match = name.match(REMAPPER_TRAILING_NUMBER_RE);
    if (match) {
      if (match[1] === stem) {
        maxSuffix = Math.max(maxSuffix, Number.parseInt(match[2], 10));
      }
    } else if (name === stem) {
      maxSuffix = Math.max(maxSuffix, 1);
    }
  }

  if (sourceMatch && sourceMatch[1] === stem) {
    maxSuffix = Math.max(maxSuffix, Number.parseInt(sourceMatch[2], 10));
  } else if (trimmed === stem) {
    maxSuffix = Math.max(maxSuffix, 1);
  }

  return `${stem} ${maxSuffix + 1}`;
}

/** Clone remapper range settings with a new id and a unique numbered name. */
export function createDuplicateRemapperEntry(
  source: AudioRemapperEntry,
  newId: string,
  existingNames: readonly string[],
): AudioRemapperEntry {
  return {
    ...copyRemapper(source),
    id: newId,
    name: duplicateRemapperName(source.name, existingNames),
  };
}

// --- Primary source & playlist (playlist-waveform) ---

export function setPrimarySource(setup: AudioSetup, primarySource: PrimarySource | undefined): AudioSetup {
  return { ...setup, primarySource };
}

export function setArrangementSnapshot(
  setup: AudioSetup,
  snapshot: ArrangementSnapshot | undefined,
  importedAt?: string
): AudioSetup {
  if (snapshot === undefined) {
    return clearArrangementSnapshot(setup);
  }
  return {
    ...setup,
    arrangementSnapshot: snapshot,
    arrangementImportedAt: importedAt ?? new Date().toISOString(),
  };
}

export function clearArrangementSnapshot(setup: AudioSetup): AudioSetup {
  if (setup.arrangementSnapshot === undefined && setup.arrangementImportedAt === undefined) {
    return setup;
  }
  const next = { ...setup };
  delete next.arrangementSnapshot;
  delete next.arrangementImportedAt;
  return next;
}

/**
 * Drops a persisted snapshot when the primary source no longer matches `snapshot.source.trackName`
 * (upload primary, or a different playlist track).
 */
export function clearArrangementSnapshotIfPrimaryMismatch(setup: AudioSetup): AudioSetup {
  const snap = setup.arrangementSnapshot;
  if (snap === undefined) return setup;
  const primary = setup.primarySource;
  if (primary?.type !== 'playlist') return clearArrangementSnapshot(setup);
  if (primary.trackId !== snap.source.trackName) return clearArrangementSnapshot(setup);
  return setup;
}

export function setPlaylistOrder(setup: AudioSetup, order: string[]): AudioSetup {
  const playlistState: PlaylistState = {
    order,
    currentIndex: setup.playlistState?.currentIndex ?? 0,
    loopCurrentTrack: setup.playlistState?.loopCurrentTrack ?? false,
  };
  return { ...setup, playlistState };
}

export function setPlaylistCurrentIndex(setup: AudioSetup, currentIndex: number): AudioSetup {
  const ps = setup.playlistState;
  if (!ps) return setup;
  const clamped = Math.max(0, Math.min(currentIndex, Math.max(0, ps.order.length - 1)));
  return { ...setup, playlistState: { ...ps, currentIndex: clamped } };
}

export function setLoopCurrentTrack(setup: AudioSetup, loopCurrentTrack: boolean): AudioSetup {
  const ps = setup.playlistState;
  if (!ps) return setup;
  return { ...setup, playlistState: { ...ps, loopCurrentTrack } };
}

/**
 * Retarget bands so they follow the new primary source.
 *
 * For now the design is “bands follow the active track”:
 * - Any band whose sourceFileId was the previous primary id is updated.
 * - Any band whose sourceFileId is a playlist track id (present in
 *   playlistState.order) is also updated to point at the new primary id.
 *
 * This keeps presets using playlists or uploads in sync when the user switches
 * tracks from the bottom bar, so remappers always listen to the currently
 * selected track instead of a stale one.
 */
export function retargetBandsToPrimary(
  setup: AudioSetup,
  prevPrimaryId: string | undefined,
  newPrimaryId: string | undefined,
): AudioSetup {
  if (!newPrimaryId || prevPrimaryId === newPrimaryId) {
    return setup;
  }

  const playlistIds = new Set(setup.playlistState?.order ?? []);

  const bandsChanged = setup.bands.some((b) => {
    if (prevPrimaryId && b.sourceFileId === prevPrimaryId) return true;
    if (playlistIds.size > 0 && playlistIds.has(b.sourceFileId)) return true;
    return false;
  });
  if (!bandsChanged) return setup;

  const bands = setup.bands.map((band) => {
    const shouldRetarget =
      (prevPrimaryId && band.sourceFileId === prevPrimaryId) ||
      (playlistIds.size > 0 && playlistIds.has(band.sourceFileId));
    if (!shouldRetarget) return band;

    const copy = copyBand(band);
    copy.sourceFileId = newPrimaryId;
    return copy;
  });

  return { ...setup, bands };
}

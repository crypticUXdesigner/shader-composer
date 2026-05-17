/**
 * Per-file offline audio analysis invalidation tiers and stable digests.
 *
 * Tier rules (highest wins when classifying a setup delta for one file):
 * - **file (D):** decoded buffer identity changed (sample rate, length, duration, channels).
 * - **structural (C):** band/remapper topology on this file (add/remove, id, sourceFileId, remapper bandId).
 * - **band (B):** FFT / smoothing / band-level remap fields for bands on this file.
 * - **remapper (A):** remapper inMin/inMax/outMin/outMax only (bands on this file unchanged).
 * - **none:** no invalidation for this file.
 *
 * Preview canonical curves stay worker-built until tasks 03+ consume these helpers.
 * Never publish a sampler mixing old FFT with new remapper topology — use generation + digest gates (see WP _OVERVIEW).
 */

import type { AudioBandEntry, AudioRemapperEntry, AudioSetup } from '../../data-model/audioSetupTypes';

export type AudioInvalidationTier = 'none' | 'remapper' | 'band' | 'structural' | 'file';

const TIER_RANK: Record<AudioInvalidationTier, number> = {
  none: 0,
  remapper: 1,
  band: 2,
  structural: 3,
  file: 4,
};

export interface AudioSetupChangeBuffers {
  prev?: AudioBuffer | null;
  next?: AudioBuffer | null;
}

/** File ids referenced by at least one band (`sourceFileId`). */
export function fileIdsWithBandsFromSetup(setup: AudioSetup): Set<string> {
  return new Set(setup.bands.map((b) => b.sourceFileId));
}

function bandsForFile(setup: AudioSetup, fileId: string): AudioBandEntry[] {
  return setup.bands.filter((b) => b.sourceFileId === fileId);
}

function remappersForFile(setup: AudioSetup, fileId: string): AudioRemapperEntry[] {
  const bandIdsOnFile = new Set(bandsForFile(setup, fileId).map((b) => b.id));
  return setup.remappers.filter((r) => bandIdsOnFile.has(r.bandId));
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value);
}

/** Digest of decoded PCM for one file (runtime buffer, not persisted in AudioSetup). */
export function fileBufferDigest(buffer: AudioBuffer | null | undefined): string {
  if (!buffer) return 'missing';
  return `${buffer.sampleRate}:${buffer.duration}:${buffer.length}:${buffer.numberOfChannels}`;
}

/** Band/remapper ids and wiring for one file — channel layout. */
export function structuralDigest(setup: AudioSetup, fileId: string): string {
  const bands = bandsForFile(setup, fileId)
    .map((b) => ({ id: b.id, sourceFileId: b.sourceFileId }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const remappers = remappersForFile(setup, fileId)
    .map((r) => ({ id: r.id, bandId: r.bandId }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return stableStringify({ bands, remappers });
}

/** FFT range, mode, smoothing, and band-level remap fields for bands on one file. */
export function bandAnalysisDigest(setup: AudioSetup, fileId: string): string {
  const bands = bandsForFile(setup, fileId)
    .map((b) => ({
      id: b.id,
      frequencyBands: b.frequencyBands,
      bandMode: b.bandMode ?? 'mean',
      fftSize: b.fftSize,
      smoothingHalfLifeSeconds: b.smoothingHalfLifeSeconds ?? 0,
      attackHalfLifeSeconds: b.attackHalfLifeSeconds,
      releaseHalfLifeSeconds: b.releaseHalfLifeSeconds,
      remapInMin: b.remapInMin ?? 0,
      remapInMax: b.remapInMax ?? 1,
      remapOutMin: b.remapOutMin ?? 0,
      remapOutMax: b.remapOutMax ?? 1,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return stableStringify(bands);
}

/** Remapper mapping ranges for remappers whose band lives on this file. */
export function remapperMapDigest(setup: AudioSetup, fileId: string): string {
  const remappers = remappersForFile(setup, fileId)
    .map((r) => ({
      id: r.id,
      bandId: r.bandId,
      inMin: r.inMin,
      inMax: r.inMax,
      outMin: r.outMin,
      outMax: r.outMax,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return stableStringify(remappers);
}

function tierFromDigestDelta(
  prevDigest: string,
  nextDigest: string,
  tierIfChanged: Exclude<AudioInvalidationTier, 'none'>
): AudioInvalidationTier | null {
  return prevDigest !== nextDigest ? tierIfChanged : null;
}

/**
 * Classify how `next` differs from `prev` for one file that has bands.
 * Remapper edits on file A do not affect tier for file B.
 */
export function classifyAudioSetupChange(
  prev: AudioSetup,
  next: AudioSetup,
  fileId: string,
  buffers?: AudioSetupChangeBuffers
): AudioInvalidationTier {
  let worst: AudioInvalidationTier = 'none';

  const consider = (tier: AudioInvalidationTier | null): void => {
    if (tier != null && TIER_RANK[tier] > TIER_RANK[worst]) worst = tier;
  };

  if (buffers && (buffers.prev !== undefined || buffers.next !== undefined)) {
    consider(
      tierFromDigestDelta(
        fileBufferDigest(buffers.prev),
        fileBufferDigest(buffers.next),
        'file'
      )
    );
  }

  consider(tierFromDigestDelta(structuralDigest(prev, fileId), structuralDigest(next, fileId), 'structural'));
  consider(tierFromDigestDelta(bandAnalysisDigest(prev, fileId), bandAnalysisDigest(next, fileId), 'band'));
  consider(
    tierFromDigestDelta(remapperMapDigest(prev, fileId), remapperMapDigest(next, fileId), 'remapper')
  );

  return worst;
}

function bandAnalysisEntryDigest(band: AudioBandEntry): string {
  return stableStringify({
    id: band.id,
    frequencyBands: band.frequencyBands,
    bandMode: band.bandMode ?? 'mean',
    fftSize: band.fftSize,
    smoothingHalfLifeSeconds: band.smoothingHalfLifeSeconds ?? 0,
    attackHalfLifeSeconds: band.attackHalfLifeSeconds,
    releaseHalfLifeSeconds: band.releaseHalfLifeSeconds,
    remapInMin: band.remapInMin ?? 0,
    remapInMax: band.remapInMax ?? 1,
    remapOutMin: band.remapOutMin ?? 0,
    remapOutMax: band.remapOutMax ?? 1,
  });
}

/** Band ids on `fileId` whose FFT / smoothing / band-level remap fields changed between setups. */
export function bandIdsWithAnalysisChange(prev: AudioSetup, next: AudioSetup, fileId: string): string[] {
  const prevBands = bandsForFile(prev, fileId);
  const nextById = new Map(bandsForFile(next, fileId).map((b) => [b.id, b]));
  const changed: string[] = [];
  for (const pb of prevBands) {
    const nb = nextById.get(pb.id);
    if (!nb) continue;
    if (bandAnalysisEntryDigest(pb) !== bandAnalysisEntryDigest(nb)) {
      changed.push(pb.id);
    }
  }
  return changed;
}

/**
 * Migration: Band-level audio signals → audioSetup remappers
 *
 * Presets and graphs can use legacy virtual sources:
 * - `audio-signal:band-{bandId}-remap` — band-level remap fields on the band row
 * - `audio-signal:band-{bandId}-raw` — raw band analyzer output
 *
 * This migration creates one default remapper per band (`band-{bandId}`), rewrites connections to
 * `audio-signal:remap-{remapperId}`, with audioSetup as the single source of truth.
 *
 * - Remapper id for the default band remap is `band-{bandId}` (stable for idempotence).
 * - Band-level remap fields are left as-is for backward compat; runtime still resolves
 *   band-{bandId}-remap from band fields if present.
 */

import type { NodeGraph } from './types';
import type { AudioBandEntry, AudioSetup, AudioRemapperEntry } from './audioSetupTypes';
import { getVirtualNodeId } from '../utils/virtualNodes';

const BAND_REMAP_SIGNAL_PREFIX = 'band-';
const BAND_REMAP_SIGNAL_SUFFIX = '-remap';
const BAND_RAW_SIGNAL_SUFFIX = '-raw';

/**
 * Returns the virtual node id for the legacy band remap signal.
 */
function bandRemapVirtualNodeId(bandId: string): string {
  return getVirtualNodeId(`${BAND_REMAP_SIGNAL_PREFIX}${bandId}${BAND_REMAP_SIGNAL_SUFFIX}`);
}

/** Returns the virtual node id for the legacy band raw signal. */
function bandRawVirtualNodeId(bandId: string): string {
  return getVirtualNodeId(`${BAND_REMAP_SIGNAL_PREFIX}${bandId}${BAND_RAW_SIGNAL_SUFFIX}`);
}

/**
 * Returns the virtual node id for a remapper.
 */
function remapperVirtualNodeId(remapperId: string): string {
  return getVirtualNodeId(`remap-${remapperId}`);
}

/**
 * Stable remapper id for a band's default remap. Used so re-loading the same preset
 * does not create duplicate remappers.
 */
export function defaultRemapperIdForBand(bandId: string): string {
  return `${BAND_REMAP_SIGNAL_PREFIX}${bandId}`;
}

/** Default remapper row for a band (same shape as migration adds). */
export function defaultRemapperEntryForBand(band: AudioBandEntry): AudioRemapperEntry {
  return {
    id: defaultRemapperIdForBand(band.id),
    name: 'Default',
    bandId: band.id,
    inMin: band.remapInMin ?? 0,
    inMax: band.remapInMax ?? 1,
    outMin: band.remapOutMin ?? 0,
    outMax: band.remapOutMax ?? 1,
  };
}

/**
 * Migrate band-level remap to audioSetup remappers.
 * - For each band, ensure there is a remapper with id `band-{bandId}`; if not, add one
 *   using the band's remap range (or 0,1,0,1).
 * - Rewrite connections from audio-signal:band-{bandId}-remap or band-{bandId}-raw
 *   to audio-signal:remap-band-{bandId}.
 *
 * Idempotent: safe to run multiple times (e.g. on every load).
 */
export function migrateBandRemapToRemappers(
  graph: NodeGraph,
  audioSetup: AudioSetup
): { graph: NodeGraph; audioSetup: AudioSetup } {
  const existingRemapperIds = new Set(audioSetup.remappers.map((r) => r.id));
  const addedRemappers: AudioRemapperEntry[] = [];

  for (const band of audioSetup.bands) {
    const remapperId = defaultRemapperIdForBand(band.id);
    if (existingRemapperIds.has(remapperId)) continue;

    addedRemappers.push(defaultRemapperEntryForBand(band));
    existingRemapperIds.add(remapperId);
  }

  const legacySourceToRemapper = new Map<string, string>();
  for (const band of audioSetup.bands) {
    const remapperId = defaultRemapperIdForBand(band.id);
    const target = remapperVirtualNodeId(remapperId);
    legacySourceToRemapper.set(bandRemapVirtualNodeId(band.id), target);
    legacySourceToRemapper.set(bandRawVirtualNodeId(band.id), target);
  }

  const newConnections = graph.connections.map((c) => {
    const newSource = legacySourceToRemapper.get(c.sourceNodeId);
    if (newSource) return { ...c, sourceNodeId: newSource };
    return c;
  });

  const anyRewritten = newConnections.some(
    (c, i) => c.sourceNodeId !== graph.connections[i].sourceNodeId
  );
  const anyAdded = addedRemappers.length > 0;

  if (!anyRewritten && !anyAdded) {
    return { graph, audioSetup };
  }

  return {
    graph: { ...graph, connections: newConnections },
    audioSetup:
      anyAdded
        ? { ...audioSetup, remappers: [...audioSetup.remappers, ...addedRemappers] }
        : audioSetup,
  };
}

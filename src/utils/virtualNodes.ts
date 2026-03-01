/**
 * Virtual Nodes for Named Audio Signals
 *
 * Per JOINT_BRIEFING §5.2: Each named audio signal maps to a virtual node.
 * Virtual node has id `audio-signal:{signalId}`, no position, one output port "out".
 * Connections use existing Connection model with sourceNodeId = virtual node id.
 * No visual node rendered.
 *
 * Signal ID scheme:
 * - band-{bandId}-raw   — raw band output
 * - remap-{remapperId}  — remapper output (one default per band after migration)
 *
 * WP 11: parameterValueCalculator uses virtual node id to resolve value.
 * WP 12: Signal picker uses getNamedSignalsFromAudioSetup.
 */

import type { AudioSetup, AudioSignalId } from '../data-model/audioSetupTypes';

/** Prefix for virtual node IDs. Virtual node id = `${VIRTUAL_NODE_PREFIX}${signalId}` */
export const VIRTUAL_NODE_PREFIX = 'audio-signal:';

/**
 * Check if a node ID is a virtual node (audio signal).
 */
export function isVirtualNodeId(id: string): boolean {
  return id.startsWith(VIRTUAL_NODE_PREFIX) && id.length > VIRTUAL_NODE_PREFIX.length;
}

/**
 * Extract the signal ID from a virtual node id.
 * Returns the raw signalId (e.g. "band-abc-raw", "remap-xyz").
 * Returns empty string if id is not a valid virtual node id.
 */
export function getSignalIdFromVirtualNodeId(virtualNodeId: string): AudioSignalId {
  if (!isVirtualNodeId(virtualNodeId)) return '';
  return virtualNodeId.slice(VIRTUAL_NODE_PREFIX.length);
}

/**
 * Build virtual node id from a signal ID.
 */
export function getVirtualNodeId(signalId: AudioSignalId): string {
  return `${VIRTUAL_NODE_PREFIX}${signalId}`;
}

export interface NamedSignal {
  id: AudioSignalId;
  name: string;
  virtualNodeId: string;
}

/**
 * Derive named signals from audioSetup for the connection picker.
 * Returns band raw and remapper signals only (remappers are the single source of truth; band-level remap is migrated to remappers on load).
 */
export function getNamedSignalsFromAudioSetup(audioSetup: AudioSetup): NamedSignal[] {
  const result: NamedSignal[] = [];

  for (const band of audioSetup.bands) {
    const bandLabel = band.name || `Band ${band.id}`;
    result.push({
      id: `band-${band.id}-raw`,
      name: bandLabel,
      virtualNodeId: getVirtualNodeId(`band-${band.id}-raw`),
    });
  }

  for (const remapper of audioSetup.remappers) {
    const band = audioSetup.bands.find((b) => b.id === remapper.bandId);
    const bandLabel = band ? band.name || `Band ${band.id}` : `Band ${remapper.bandId}`;
    const remapperLabel = remapper.name || `Remap ${remapper.id}`;
    result.push({
      id: `remap-${remapper.id}`,
      name: `${bandLabel}: ${remapperLabel}`,
      virtualNodeId: getVirtualNodeId(`remap-${remapper.id}`),
    });
  }

  return result;
}

/**
 * Get all virtual node IDs that exist for the given audioSetup.
 * Used for validation and connection layer (e.g. to know which sourceNodeIds are valid).
 */
export function getVirtualNodeIdsFromAudioSetup(audioSetup: AudioSetup): string[] {
  const signals = getNamedSignalsFromAudioSetup(audioSetup);
  return signals.map((s) => s.virtualNodeId);
}

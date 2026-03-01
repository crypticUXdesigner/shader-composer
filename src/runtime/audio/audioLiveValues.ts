/**
 * Live value resolution for virtual nodes (audio-signal:...) and panel bands.
 * Extracted from AudioManager for smaller module size.
 */

import type { AudioSetup } from '../../data-model/audioSetupTypes';
import { getSignalIdFromVirtualNodeId } from '../../utils/virtualNodes';
import type { AnalyzerNodeState } from './FrequencyAnalyzer';

/**
 * Get live value for a virtual node (audio signal).
 * WP 11: Used by parameterValueCalculator when param is connected to virtual node.
 */
export function getVirtualNodeLiveValue(
  virtualNodeId: string,
  audioSetup: AudioSetup | null,
  getAnalyzerNodeState: (nodeId: string) => AnalyzerNodeState | undefined
): number | null {
  const signalId = getSignalIdFromVirtualNodeId(virtualNodeId);
  if (!signalId || !audioSetup) return null;

  const bandRawMatch = signalId.match(/^band-(.+)-raw$/);
  if (bandRawMatch) {
    const bandId = bandRawMatch[1];
    const analyzerState = getAnalyzerNodeState(bandId);
    const v = analyzerState?.smoothedBandValues?.[0];
    return typeof v === 'number' && !isNaN(v) ? v : null;
  }

  const bandRemapMatch = signalId.match(/^band-(.+)-remap$/);
  if (bandRemapMatch) {
    const bandId = bandRemapMatch[1];
    const band = audioSetup.bands.find((b) => b.id === bandId);
    if (!band) return null;
    const analyzerState = getAnalyzerNodeState(bandId);
    const bandValue = analyzerState?.smoothedBandValues?.[0];
    if (typeof bandValue !== 'number' || isNaN(bandValue)) return null;
    const inMin = band.remapInMin ?? 0;
    const inMax = band.remapInMax ?? 1;
    const outMin = band.remapOutMin ?? 0;
    const outMax = band.remapOutMax ?? 1;
    const range = inMax - inMin;
    const normalized = range !== 0 ? (bandValue - inMin) / range : 0;
    const clamped = Math.max(0, Math.min(1, normalized));
    return outMin + clamped * (outMax - outMin);
  }

  const remapMatch = signalId.match(/^remap-(.+)$/);
  if (remapMatch) {
    const remapperId = remapMatch[1];
    const remapper = audioSetup.remappers.find((r) => r.id === remapperId);
    if (!remapper) return null;
    const analyzerState = getAnalyzerNodeState(remapper.bandId);
    const bandValue = analyzerState?.smoothedBandValues?.[0];
    if (typeof bandValue !== 'number' || isNaN(bandValue)) return null;
    const { inMin, inMax, outMin, outMax } = remapper;
    const range = inMax - inMin;
    const normalized = range !== 0 ? (bandValue - inMin) / range : 0;
    const clamped = Math.max(0, Math.min(1, normalized));
    return outMin + clamped * (outMax - outMin);
  }

  return null;
}

/**
 * Get live incoming (raw band) and outgoing (remapped) values for a panel band or remapper.
 * Used for RemapRangeEditor needles.
 */
export function getPanelBandLiveValues(
  bandId: string,
  remap: { inMin: number; inMax: number; outMin: number; outMax: number },
  getAnalyzerNodeState: (nodeId: string) => AnalyzerNodeState | undefined
): { incoming: number | null; outgoing: number | null } {
  const analyzerState = getAnalyzerNodeState(bandId);
  if (!analyzerState?.smoothedBandValues?.length) {
    return { incoming: null, outgoing: null };
  }
  const incoming = analyzerState.smoothedBandValues[0];
  if (typeof incoming !== 'number' || isNaN(incoming)) {
    return { incoming: null, outgoing: null };
  }
  const { inMin, inMax, outMin, outMax } = remap;
  const range = inMax - inMin;
  const normalized = range !== 0 ? (incoming - inMin) / range : 0;
  const clamped = Math.max(0, Math.min(1, normalized));
  const outgoing = outMin + clamped * (outMax - outMin);
  return { incoming, outgoing };
}

/**
 * Sync panel audio setup bands to frequency analyzer nodes.
 * Extracted from AudioManager.setAudioSetup for smaller module size.
 */

import type { AudioSetup } from '../../data-model/audioSetupTypes';
import type { FrequencyAnalyzer } from './FrequencyAnalyzer';
import type { AudioPlaybackController } from './AudioPlaybackController';

const PANEL_BAND_PREFIX = 'band-';

function isPanelBandId(id: string): boolean {
  return id.startsWith(PANEL_BAND_PREFIX);
}

/**
 * Sync analyzers to match audioSetup.bands: remove obsolete, create/update per band.
 */
export function syncPanelAnalyzers(
  audioSetup: AudioSetup | null,
  frequencyAnalyzer: FrequencyAnalyzer,
  playbackController: AudioPlaybackController
): void {
  if (!audioSetup) {
    for (const bandId of frequencyAnalyzer.getAllAnalyzerNodeIds()) {
      if (isPanelBandId(bandId)) {
        frequencyAnalyzer.removeAnalyzerNode(bandId);
      }
    }
    return;
  }

  const bandIds = new Set(audioSetup.bands.map((b) => b.id));
  for (const analyzerId of frequencyAnalyzer.getAllAnalyzerNodeIds()) {
    if (isPanelBandId(analyzerId) && !bandIds.has(analyzerId)) {
      frequencyAnalyzer.removeAnalyzerNode(analyzerId);
    }
  }

  for (const band of audioSetup.bands) {
    const audioState = playbackController.getAudioNodeState(band.sourceFileId);
    if (!audioState?.analyserNode) continue;

    const frequencyBands = band.frequencyBands?.[0]
      ? [{ minHz: band.frequencyBands[0][0], maxHz: band.frequencyBands[0][1] }]
      : [{ minHz: 20, maxHz: 20000 }];
    const bandModes = [band.bandMode ?? 'mean'] as const;
    // Legacy: symmetric smoothingHalfLifeSeconds. Canonical: attack/release.
    // FrequencyAnalyzer still requires a symmetric array for fallback behavior,
    // so we derive a deterministic fallback from attack/release/default.
    const fallbackHalfLife =
      band.attackHalfLifeSeconds ??
      band.releaseHalfLifeSeconds ??
      band.smoothingHalfLifeSeconds ??
      1 / 120;
    const smoothingHalfLives = [fallbackHalfLife];
    const attackHalfLives = band.attackHalfLifeSeconds != null ? [band.attackHalfLifeSeconds] : undefined;
    const releaseHalfLives = band.releaseHalfLifeSeconds != null ? [band.releaseHalfLifeSeconds] : undefined;
    const fftSize = band.fftSize ?? 2048;

    const existing = frequencyAnalyzer.getAnalyzerNodeState(band.id);
    const approxEqual = (a: number | undefined, b: number | undefined): boolean => {
      if (a == null && b == null) return true;
      if (a == null || b == null) return false;
      if (!Number.isFinite(a) || !Number.isFinite(b)) return a === b;
      return Math.abs(a - b) <= 1e-9;
    };
    const arrayApproxEqual = (a: Array<number | undefined> | undefined, b: Array<number | undefined> | undefined): boolean => {
      if (!a && !b) return true;
      if (!a || !b) return false;
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!approxEqual(a[i], b[i])) return false;
      }
      return true;
    };
    // Recreate analyzer when band was retargeted to another track (remappers must follow the new source)
    const sourceChanged =
      existing?.analyserNode != null && existing.analyserNode !== audioState.analyserNode;
    const smoothingChanged = !existing || !arrayApproxEqual(existing.smoothingHalfLifeSeconds, smoothingHalfLives);
    const attackChanged = !existing || !arrayApproxEqual(existing.attackHalfLifeSeconds, attackHalfLives);
    const releaseChanged = !existing || !arrayApproxEqual(existing.releaseHalfLifeSeconds, releaseHalfLives);
    const configChanged =
      !existing ||
      sourceChanged ||
      existing.fftSize !== fftSize ||
      smoothingChanged ||
      attackChanged ||
      releaseChanged ||
      existing.frequencyBands.length !== frequencyBands.length ||
      existing.bandModes?.[0] !== bandModes[0] ||
      existing.frequencyBands.some(
        (fb, i) =>
          fb.minHz !== frequencyBands[i].minHz || fb.maxHz !== frequencyBands[i].maxHz
      );

    if (configChanged) {
      if (existing) frequencyAnalyzer.removeAnalyzerNode(band.id);
      try {
        frequencyAnalyzer.createAnalyzer(
          band.id,
          band.sourceFileId,
          frequencyBands,
          [...bandModes],
          smoothingHalfLives,
          attackHalfLives,
          releaseHalfLives,
          fftSize,
          audioState
        );
      } catch (err) {
        console.warn('[AudioManager] Failed to create analyzer for band', band.id, err);
      }
    }
  }
}

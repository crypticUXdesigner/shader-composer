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
    const smoothing = [band.smoothing ?? 0.8];
    const fftSize = band.fftSize ?? 2048;

    const existing = frequencyAnalyzer.getAnalyzerNodeState(band.id);
    // Recreate analyzer when band was retargeted to another track (remappers must follow the new source)
    const sourceChanged =
      existing?.analyserNode != null && existing.analyserNode !== audioState.analyserNode;
    const configChanged =
      !existing ||
      sourceChanged ||
      existing.fftSize !== fftSize ||
      existing.frequencyBands.length !== frequencyBands.length ||
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
          smoothing,
          fftSize,
          audioState
        );
      } catch (err) {
        console.warn('[AudioManager] Failed to create analyzer for band', band.id, err);
      }
    }
  }
}

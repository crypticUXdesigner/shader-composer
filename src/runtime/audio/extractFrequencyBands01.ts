import type { AudioBandMode } from '../../data-model/audioSetupTypes';

export type FrequencyBandHz = { minHz: number; maxHz: number };

/**
 * Reduce per-bin analyser bytes (0..255) into per-band values (0..1).
 * Semantics must stay aligned between live preview + offline/export.
 */
export function extractFrequencyBands01Into(
  frequencyData: Uint8Array,
  frequencyBands: FrequencyBandHz[],
  bandModes: AudioBandMode[],
  sampleRate: number,
  fftSize: number,
  out01: number[]
): void {
  for (let bandIndex = 0; bandIndex < frequencyBands.length; bandIndex++) {
    const band = frequencyBands[bandIndex]!;
    const mode = bandModes[bandIndex] ?? 'mean';
    const minBin = Math.floor((band.minHz / sampleRate) * fftSize);
    const maxBin = Math.ceil((band.maxHz / sampleRate) * fftSize);

    let count = 0;
    let sum = 0;
    let sumSquares = 0;
    let max = 0;

    for (let i = minBin; i <= maxBin && i < frequencyData.length; i++) {
      const v = frequencyData[i] ?? 0;
      count++;
      sum += v;
      if (v > max) max = v;
      if (mode === 'rms') sumSquares += v * v;
    }

    let reduced = 0;
    if (count > 0) {
      if (mode === 'max') {
        reduced = max;
      } else if (mode === 'rms') {
        reduced = Math.sqrt(sumSquares / count);
      } else {
        reduced = sum / count;
      }
    }

    out01[bandIndex] = reduced / 255.0;
  }
}


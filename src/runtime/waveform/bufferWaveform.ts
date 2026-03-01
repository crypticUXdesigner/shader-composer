/**
 * Derive waveform from AudioBuffer (upload fallback for 02B).
 * Downsample to target length with RMS per bucket; output 0–1 for drawing.
 */

export const DEFAULT_WAVEFORM_LENGTH = 480;

export interface BufferWaveformResult {
  values: number[];
  durationSeconds: number;
}

/**
 * Compute waveform from AudioBuffer: mono or first channel, downsampled to target length.
 * Uses RMS per bucket; returns values in 0–1 range (same semantic as audiograph).
 */
export function computeWaveformFromBuffer(
  buffer: AudioBuffer,
  targetLength: number = DEFAULT_WAVEFORM_LENGTH
): BufferWaveformResult {
  const durationSeconds = buffer.duration;
  const channel = buffer.getChannelData(0);
  const totalSamples = channel.length;
  if (totalSamples === 0) {
    return { values: [], durationSeconds };
  }

  const values: number[] = [];
  const bucketSize = totalSamples / targetLength;
  let maxRms = 0;

  for (let i = 0; i < targetLength; i++) {
    const start = Math.floor(i * bucketSize);
    const end = Math.min(Math.floor((i + 1) * bucketSize), totalSamples);
    let sumSq = 0;
    let count = 0;
    for (let j = start; j < end; j++) {
      const s = channel[j];
      sumSq += s * s;
      count++;
    }
    const rms = count > 0 ? Math.sqrt(sumSq / count) : 0;
    values.push(rms);
    if (rms > maxRms) maxRms = rms;
  }

  // Normalize to 0–1 (peak-normalize like RMS display)
  if (maxRms > 0) {
    for (let i = 0; i < values.length; i++) {
      values[i] = values[i] / maxRms;
    }
  }

  return { values, durationSeconds };
}

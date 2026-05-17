import type { AnalyzerConfig } from '../../video-export/OfflineAudioProvider';
import { remapValue } from '../audio/remapValue';
import type { AudioAnalysisCurveCache } from './AudioAnalysisCurveSampler';

/** Smoothed band values (index 0) per frame — same series the worker feeds into remapperOut. */
export function extractBandSmoothedSeriesFromCache(
  cache: AudioAnalysisCurveCache
): Map<string, Float32Array> {
  const { frameCount, channels, values } = cache;
  const channelCount = channels.length;
  const out = new Map<string, Float32Array>();

  for (let j = 0; j < channelCount; j++) {
    const ch = channels[j]!;
    if (ch.paramName !== 'band' && ch.paramName !== 'band0') continue;
    const series = new Float32Array(frameCount);
    for (let k = 0; k < frameCount; k++) {
      series[k] = values[k * channelCount + j]!;
    }
    out.set(ch.nodeId, series);
  }
  return out;
}

export type RemapperPatchConfig = {
  id: string;
  bandId: string;
  inMin: number;
  inMax: number;
  outMin: number;
  outMax: number;
};

/**
 * Rewrite remapperOut channels from stored per-band smoothed series and new remapper ranges.
 * Band / remap channels are unchanged (FFT + band smoothing unchanged for Tier A).
 */
/**
 * Rewrite band + remap channels for rebuilt bands from new smoothed series and analyzer configs.
 */
export function patchBandAndRemapChannelsFromBandSeries(
  cache: AudioAnalysisCurveCache,
  bandSeriesByBandId: Map<string, Float32Array>,
  analyzerConfigs: AnalyzerConfig[]
): void {
  const { frameCount, channels, values } = cache;
  const channelCount = channels.length;

  for (const a of analyzerConfigs) {
    const series = bandSeriesByBandId.get(a.nodeId);
    if (!series || series.length !== frameCount) continue;

    for (let j = 0; j < channelCount; j++) {
      const ch = channels[j]!;
      if (ch.nodeId !== a.nodeId) continue;
      if (ch.paramName.startsWith('band')) {
        for (let k = 0; k < frameCount; k++) {
          let v = series[k]!;
          if (ch.min !== undefined) v = Math.max(ch.min, v);
          if (ch.max !== undefined) v = Math.min(ch.max, v);
          values[k * channelCount + j] = v;
        }
      } else if (ch.paramName.startsWith('remap')) {
        const remapIdx = ch.paramName === 'remap' || ch.paramName === 'remap0' ? 0 : parseInt(ch.paramName.replace('remap', ''), 10);
        const remapCfg = a.bandRemap[remapIdx] ?? a.bandRemap[0];
        if (!remapCfg) continue;
        const { inMin, inMax, outMin, outMax } = remapCfg;
        for (let k = 0; k < frameCount; k++) {
          let v = remapValue(series[k]!, inMin, inMax, outMin, outMax);
          if (ch.min !== undefined) v = Math.max(ch.min, v);
          if (ch.max !== undefined) v = Math.min(ch.max, v);
          values[k * channelCount + j] = v;
        }
      }
    }
  }
}

export function patchRemapperChannelsFromBandCache(
  cache: AudioAnalysisCurveCache,
  bandSeriesByBandId: Map<string, Float32Array>,
  remapperConfigs: RemapperPatchConfig[]
): void {
  const { frameCount, channels, values } = cache;
  const channelCount = channels.length;

  for (const r of remapperConfigs) {
    const series = bandSeriesByBandId.get(r.bandId);
    if (!series || series.length !== frameCount) continue;

    let channelIndex = -1;
    for (let j = 0; j < channelCount; j++) {
      const ch = channels[j]!;
      if (ch.nodeId === `remap-${r.id}` && ch.paramName === 'out') {
        channelIndex = j;
        break;
      }
    }
    if (channelIndex < 0) continue;

    const chMeta = channels[channelIndex]!;
    for (let k = 0; k < frameCount; k++) {
      let v = remapValue(series[k]!, r.inMin, r.inMax, r.outMin, r.outMax);
      if (chMeta.min !== undefined) v = Math.max(chMeta.min, v);
      if (chMeta.max !== undefined) v = Math.min(chMeta.max, v);
      values[k * channelCount + channelIndex] = v;
    }
  }
}

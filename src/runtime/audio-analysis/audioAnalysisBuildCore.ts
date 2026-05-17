/**
 * Shared offline audio analysis frame loop (worker + parity tests).
 * Spectrum smoothing is shared across bands; subset rebuild runs the full temporal loop
 * but only updates smoothed series for the requested analyzer configs (cold-start at k=0).
 */

import type { AnalyzerConfig } from '../../video-export/OfflineAudioProvider';
import { extractFrequencyBands01Into } from '../audio/extractFrequencyBands01';
import { remapValue } from '../audio/remapValue';
import type { AudioAnalysisCurveCache } from './AudioAnalysisCurveSampler';

const TWO_PI = 2 * Math.PI;

const ANALYSER_MIN_DB = -100;
const ANALYSER_MAX_DB = -30;
const ANALYSER_SMOOTHING_TIME_CONSTANT = 0.8;
export const DEFAULT_HALF_LIFE_SECONDS = 1 / 120;

export type AnalysisChannelMeta = {
  nodeId: string;
  paramName: string;
  min?: number;
  max?: number;
  defaultValue?: number;
  kind: 'band' | 'remap' | 'remapperOut';
  index?: number;
};

export type BuildAnalysisParams = {
  pcmChannels: Float32Array[];
  sampleRate: number;
  startTimeSeconds: number;
  hopHz: number;
  frameRateForDuration: number;
  maxFrames: number;
  analyzerConfigs: AnalyzerConfig[];
  remapperConfigs: Array<{ id: string; bandId: string; inMin: number; inMax: number; outMin: number; outMax: number }>;
  /** When set, invoked every N frames with progress 0..1. Return false to cancel. */
  onProgress?: (progress01: number) => boolean | void;
};

function fftInPlace(buffer: Float32Array, fftSize: number): void {
  const n = fftSize;
  if (n <= 1) return;
  const log2n = Math.round(Math.log2(n));
  for (let i = 0; i < n; i++) {
    let j = 0;
    for (let b = 0; b < log2n; b++) {
      j |= ((i >> b) & 1) << (log2n - 1 - b);
    }
    if (i < j) {
      const reI = buffer[i * 2];
      const imI = buffer[i * 2 + 1];
      buffer[i * 2] = buffer[j * 2];
      buffer[i * 2 + 1] = buffer[j * 2 + 1];
      buffer[j * 2] = reI;
      buffer[j * 2 + 1] = imI;
    }
  }
  for (let len = 2; len <= n; len *= 2) {
    const half = len / 2;
    const angle = -TWO_PI / len;
    for (let start = 0; start < n; start += len) {
      let wRe = 1;
      let wIm = 0;
      const wReStep = Math.cos(angle);
      const wImStep = Math.sin(angle);
      for (let k = 0; k < half; k++) {
        const i = start + k;
        const j = i + half;
        const reI = buffer[i * 2];
        const imI = buffer[i * 2 + 1];
        const reJ = buffer[j * 2];
        const imJ = buffer[j * 2 + 1];
        const tRe = wRe * reJ - wIm * imJ;
        const tIm = wRe * imJ + wIm * reJ;
        buffer[i * 2] = reI + tRe;
        buffer[i * 2 + 1] = imI + tIm;
        buffer[j * 2] = reI - tRe;
        buffer[j * 2 + 1] = imI - tIm;
        const nextWRe = wRe * wReStep - wIm * wImStep;
        const nextWIm = wRe * wImStep + wIm * wReStep;
        wRe = nextWRe;
        wIm = nextWIm;
      }
    }
  }
}

function applyBlackmanWindow(workBuffer: Float32Array, fftSize: number): void {
  if (fftSize <= 1) return;
  const nMinus1 = fftSize - 1;
  const a0 = 0.42;
  const a1 = 0.5;
  const a2 = 0.08;
  for (let i = 0; i < fftSize; i++) {
    const phase = (TWO_PI * i) / nMinus1;
    const w = a0 - a1 * Math.cos(phase) + a2 * Math.cos(2 * phase);
    workBuffer[i * 2] *= w;
  }
}

function computeLinearMagnitudeSpectrumFromPcm(
  pcmChannels: Float32Array[],
  timeSeconds: number,
  sampleRate: number,
  fftSize: number,
  workBuffer: Float32Array,
  outMagnitudes: Float32Array
): void {
  const frequencyBinCount = fftSize / 2;
  const endSampleExclusive = Math.max(0, Math.floor(timeSeconds * sampleRate));
  const startSample = Math.max(0, endSampleExclusive - fftSize);
  const numberOfChannels = pcmChannels.length;
  const length = pcmChannels[0]?.length ?? 0;

  for (let i = 0; i < fftSize; i++) {
    const srcIndex = startSample + i;
    let sample = 0;
    if (srcIndex >= 0 && srcIndex < length) {
      if (numberOfChannels === 1) {
        sample = pcmChannels[0]![srcIndex] ?? 0;
      } else {
        let sum = 0;
        for (let ch = 0; ch < numberOfChannels; ch++) {
          sum += pcmChannels[ch]![srcIndex] ?? 0;
        }
        sample = sum / numberOfChannels;
      }
    }
    workBuffer[i * 2] = sample;
    workBuffer[i * 2 + 1] = 0;
  }

  applyBlackmanWindow(workBuffer, fftSize);
  fftInPlace(workBuffer, fftSize);
  for (let k = 0; k < frequencyBinCount; k++) {
    const re = workBuffer[k * 2];
    const im = workBuffer[k * 2 + 1];
    outMagnitudes[k] = Math.sqrt(re * re + im * im) / fftSize;
  }
}

function tauSecondsFromLegacyPrevRetention(prevRetention: number): number {
  if (prevRetention <= 0) return 0;
  if (prevRetention >= 1) return Number.POSITIVE_INFINITY;
  const dt = 1 / 120;
  return -dt / Math.log(prevRetention);
}

function prevRetentionFromTau(dt: number, tau: number): number {
  if (tau === Number.POSITIVE_INFINITY) return 1;
  if (tau <= 0) return 0;
  return Math.exp(-dt / tau);
}

export function buildAnalysisChannels(
  analyzers: AnalyzerConfig[],
  remappers: Array<{ id: string; bandId: string; inMin: number; inMax: number; outMin: number; outMax: number }>
): AnalysisChannelMeta[] {
  const channels: AnalysisChannelMeta[] = [];
  for (const a of analyzers) {
    const bandCount = Math.max(a.frequencyBands.length, 1);
    for (let i = 0; i < bandCount; i++) {
      channels.push({
        nodeId: a.nodeId,
        paramName: bandCount === 1 ? 'band' : `band${i}`,
        kind: 'band',
        index: i,
        min: 0,
        max: 1,
        defaultValue: 0,
      });
    }
    const remapCount = Math.max(a.bandRemap.length, 1);
    for (let i = 0; i < remapCount; i++) {
      channels.push({
        nodeId: a.nodeId,
        paramName: remapCount === 1 ? 'remap' : `remap${i}`,
        kind: 'remap',
        index: i,
        min: 0,
        max: 1,
        defaultValue: 0,
      });
    }
  }
  for (const r of remappers) {
    channels.push({
      nodeId: `remap-${r.id}`,
      paramName: 'out',
      kind: 'remapperOut',
      min: 0,
      max: 1,
      defaultValue: 0,
    });
  }
  return channels;
}

export function computeAnalysisFrameCount(params: Pick<BuildAnalysisParams, 'startTimeSeconds' | 'hopHz' | 'frameRateForDuration' | 'maxFrames'>): {
  hopSeconds: number;
  frameCount: number;
} {
  const hopSeconds = 1 / params.hopHz;
  const lastSampleTime =
    params.startTimeSeconds + (Math.max(1, params.maxFrames) - 0.5) / params.frameRateForDuration;
  const frameCount = Math.ceil((lastSampleTime - params.startTimeSeconds) / hopSeconds) + 2;
  return { hopSeconds, frameCount };
}

/**
 * Rebuild smoothed band series (index 0) for a subset of analyzers.
 * Uses the same spectrum + per-band smoothing loop as a full build (cold-start at k=0).
 */
export function buildBandSmoothedSeriesSubset(
  params: BuildAnalysisParams,
  subsetAnalyzerConfigs: AnalyzerConfig[]
): Map<string, Float32Array> {
  const { hopSeconds, frameCount } = computeAnalysisFrameCount(params);
  const { pcmChannels, sampleRate, startTimeSeconds, onProgress } = params;

  const spectrumFftSize = 4096;
  const spectrumBinCount = spectrumFftSize / 2;
  const work = new Float32Array(spectrumFftSize * 2);
  const magnitudes = new Float32Array(spectrumBinCount);
  const smoothedMagnitudes = new Float32Array(spectrumBinCount);
  const spectrumBytes = new Uint8Array(spectrumBinCount);

  const tauAnalyser = tauSecondsFromLegacyPrevRetention(ANALYSER_SMOOTHING_TIME_CONSTANT);
  const smoothedBandsById = new Map<string, number[]>();
  const seriesByBandId = new Map<string, Float32Array>();

  for (const a of subsetAnalyzerConfigs) {
    seriesByBandId.set(a.nodeId, new Float32Array(frameCount));
  }

  for (let k = 0; k < frameCount; k++) {
    if (onProgress && k % 240 === 0) {
      const keepGoing = onProgress((k + 1) / frameCount);
      if (keepGoing === false) return seriesByBandId;
    }

    const t = startTimeSeconds + k * hopSeconds;
    const dt = k === 0 ? 0 : hopSeconds;

    computeLinearMagnitudeSpectrumFromPcm(pcmChannels, t, sampleRate, spectrumFftSize, work, magnitudes);

    const retA = prevRetentionFromTau(dt, tauAnalyser);
    for (let i = 0; i < magnitudes.length; i++) {
      const cur = magnitudes[i] ?? 0;
      const prev = smoothedMagnitudes[i] ?? 0;
      smoothedMagnitudes[i] = retA * prev + (1 - retA) * cur;
    }

    const dbRange = ANALYSER_MAX_DB - ANALYSER_MIN_DB;
    const minMag = 1e-10;
    for (let i = 0; i < spectrumBytes.length; i++) {
      const mag = Math.max(minMag, smoothedMagnitudes[i] ?? 0);
      const db = 20 * Math.log10(mag);
      const clampedDb = Math.max(ANALYSER_MIN_DB, Math.min(ANALYSER_MAX_DB, db));
      const byte = Math.round((255 * (clampedDb - ANALYSER_MIN_DB)) / dbRange);
      spectrumBytes[i] = Math.max(0, Math.min(255, byte));
    }

    for (const a of subsetAnalyzerConfigs) {
      const bandValues: number[] = new Array(a.frequencyBands.length).fill(0);
      extractFrequencyBands01Into(
        spectrumBytes,
        a.frequencyBands,
        a.bandModes,
        sampleRate,
        a.mappingFftSize,
        bandValues
      );
      let smoothed = smoothedBandsById.get(a.nodeId);
      if (!smoothed || smoothed.length !== bandValues.length) {
        smoothed = new Array(bandValues.length).fill(0);
        smoothedBandsById.set(a.nodeId, smoothed);
      }
      for (let i = 0; i < bandValues.length; i++) {
        const cur = bandValues[i] ?? 0;
        const prev = smoothed[i] ?? 0;
        const useAttackRelease = a.attackHalfLifeSeconds?.[i] != null || a.releaseHalfLifeSeconds?.[i] != null;
        const rising = cur > prev;
        const halfLifeSeconds = useAttackRelease
          ? rising
            ? a.attackHalfLifeSeconds?.[i]
            : a.releaseHalfLifeSeconds?.[i]
          : a.smoothingHalfLifeSeconds?.[i];
        const tauB =
          (halfLifeSeconds ?? a.smoothingHalfLifeSeconds?.[i] ?? DEFAULT_HALF_LIFE_SECONDS) <= 0
            ? 0
            : !Number.isFinite(halfLifeSeconds ?? a.smoothingHalfLifeSeconds?.[i] ?? DEFAULT_HALF_LIFE_SECONDS)
              ? Number.POSITIVE_INFINITY
              : (halfLifeSeconds ?? a.smoothingHalfLifeSeconds?.[i] ?? DEFAULT_HALF_LIFE_SECONDS) / Math.LN2;
        const retB = prevRetentionFromTau(dt, tauB);
        smoothed[i] = retB * prev + (1 - retB) * cur;
      }
      const series = seriesByBandId.get(a.nodeId);
      if (series) series[k] = smoothed[0] ?? 0;
    }
  }

  if (onProgress) onProgress(1);
  return seriesByBandId;
}

/** Full offline analysis cache (all bands + remappers on one file). */
export function buildFullAnalysisCache(params: BuildAnalysisParams): AudioAnalysisCurveCache {
  const { hopSeconds, frameCount } = computeAnalysisFrameCount(params);
  const { analyzerConfigs, remapperConfigs, pcmChannels, sampleRate, startTimeSeconds, onProgress } = params;

  const channels = buildAnalysisChannels(analyzerConfigs, remapperConfigs);
  const channelCount = channels.length;
  const values = new Float32Array(frameCount * channelCount);

  const spectrumFftSize = 4096;
  const spectrumBinCount = spectrumFftSize / 2;
  const work = new Float32Array(spectrumFftSize * 2);
  const magnitudes = new Float32Array(spectrumBinCount);
  const smoothedMagnitudes = new Float32Array(spectrumBinCount);
  const spectrumBytes = new Uint8Array(spectrumBinCount);

  const tauAnalyser = tauSecondsFromLegacyPrevRetention(ANALYSER_SMOOTHING_TIME_CONSTANT);
  const smoothedBandsById = new Map<string, number[]>();

  for (let k = 0; k < frameCount; k++) {
    if (onProgress && k % 240 === 0) {
      const keepGoing = onProgress((k + 1) / frameCount);
      if (keepGoing === false) {
        return {
          startTimeSeconds,
          hopSeconds,
          frameCount,
          channels: channels.map((c) => ({
            nodeId: c.nodeId,
            paramName: c.paramName,
            min: c.min,
            max: c.max,
            defaultValue: c.defaultValue,
          })),
          values,
        };
      }
    }

    const t = startTimeSeconds + k * hopSeconds;
    const dt = k === 0 ? 0 : hopSeconds;

    computeLinearMagnitudeSpectrumFromPcm(pcmChannels, t, sampleRate, spectrumFftSize, work, magnitudes);

    const retA = prevRetentionFromTau(dt, tauAnalyser);
    for (let i = 0; i < magnitudes.length; i++) {
      const cur = magnitudes[i] ?? 0;
      const prev = smoothedMagnitudes[i] ?? 0;
      smoothedMagnitudes[i] = retA * prev + (1 - retA) * cur;
    }

    const dbRange = ANALYSER_MAX_DB - ANALYSER_MIN_DB;
    const minMag = 1e-10;
    for (let i = 0; i < spectrumBytes.length; i++) {
      const mag = Math.max(minMag, smoothedMagnitudes[i] ?? 0);
      const db = 20 * Math.log10(mag);
      const clampedDb = Math.max(ANALYSER_MIN_DB, Math.min(ANALYSER_MAX_DB, db));
      const byte = Math.round((255 * (clampedDb - ANALYSER_MIN_DB)) / dbRange);
      spectrumBytes[i] = Math.max(0, Math.min(255, byte));
    }

    for (const a of analyzerConfigs) {
      const bandValues: number[] = new Array(a.frequencyBands.length).fill(0);
      extractFrequencyBands01Into(
        spectrumBytes,
        a.frequencyBands,
        a.bandModes,
        sampleRate,
        a.mappingFftSize,
        bandValues
      );
      let smoothed = smoothedBandsById.get(a.nodeId);
      if (!smoothed || smoothed.length !== bandValues.length) {
        smoothed = new Array(bandValues.length).fill(0);
        smoothedBandsById.set(a.nodeId, smoothed);
      }
      for (let i = 0; i < bandValues.length; i++) {
        const cur = bandValues[i] ?? 0;
        const prev = smoothed[i] ?? 0;
        const useAttackRelease = a.attackHalfLifeSeconds?.[i] != null || a.releaseHalfLifeSeconds?.[i] != null;
        const rising = cur > prev;
        const halfLifeSeconds = useAttackRelease
          ? rising
            ? a.attackHalfLifeSeconds?.[i]
            : a.releaseHalfLifeSeconds?.[i]
          : a.smoothingHalfLifeSeconds?.[i];
        const tauB =
          (halfLifeSeconds ?? a.smoothingHalfLifeSeconds?.[i] ?? DEFAULT_HALF_LIFE_SECONDS) <= 0
            ? 0
            : !Number.isFinite(halfLifeSeconds ?? a.smoothingHalfLifeSeconds?.[i] ?? DEFAULT_HALF_LIFE_SECONDS)
              ? Number.POSITIVE_INFINITY
              : (halfLifeSeconds ?? a.smoothingHalfLifeSeconds?.[i] ?? DEFAULT_HALF_LIFE_SECONDS) / Math.LN2;
        const retB = prevRetentionFromTau(dt, tauB);
        smoothed[i] = retB * prev + (1 - retB) * cur;
      }
    }

    const base = k * channelCount;
    for (let j = 0; j < channels.length; j++) {
      const ch = channels[j]!;
      let v = ch.defaultValue ?? 0;
      if (ch.kind === 'band' || ch.kind === 'remap') {
        const sm = smoothedBandsById.get(ch.nodeId);
        const idx = ch.index ?? 0;
        const bandValue = sm?.[idx] ?? 0;
        if (ch.kind === 'band') {
          v = bandValue;
        } else {
          const a = analyzerConfigs.find((aa) => aa.nodeId === ch.nodeId);
          const remapCfg = a?.bandRemap[idx] ?? a?.bandRemap[0];
          if (remapCfg) {
            const { inMin, inMax, outMin, outMax } = remapCfg;
            v = remapValue(bandValue, inMin, inMax, outMin, outMax);
          }
        }
      } else {
        const rid = ch.nodeId.startsWith('remap-') ? ch.nodeId.slice('remap-'.length) : ch.nodeId;
        const r = remapperConfigs.find((rr) => rr.id === rid);
        if (r) {
          const bandRaw = smoothedBandsById.get(r.bandId)?.[0] ?? 0;
          v = remapValue(bandRaw, r.inMin, r.inMax, r.outMin, r.outMax);
        }
      }
      if (ch.min !== undefined) v = Math.max(ch.min, v);
      if (ch.max !== undefined) v = Math.min(ch.max, v);
      values[base + j] = v;
    }
  }

  if (onProgress) onProgress(1);

  return {
    startTimeSeconds,
    hopSeconds,
    frameCount,
    channels: channels.map((c) => ({
      nodeId: c.nodeId,
      paramName: c.paramName,
      min: c.min,
      max: c.max,
      defaultValue: c.defaultValue,
    })),
    values,
  };
}

import { describe, expect, it } from 'vitest';
import type { AudioSetup } from '../../data-model/audioSetupTypes';
import { buildOfflineAudioAnalysisConfigs } from '../../video-export/OfflineAudioProvider';
import {
  buildBandSmoothedSeriesSubset,
  buildFullAnalysisCache,
} from './audioAnalysisBuildCore';
import {
  extractBandSmoothedSeriesFromCache,
  patchBandAndRemapChannelsFromBandSeries,
  patchRemapperChannelsFromBandCache,
} from './audioAnalysisRemapperPatch';

/** Short synthetic stereo track (~0.5s) for offline analysis parity. */
function makeTestPcm(sampleRate: number, durationSeconds: number): Float32Array[] {
  const length = Math.ceil(sampleRate * durationSeconds);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const s = Math.sin(TWO_PI * 220 * t) * 0.4 + Math.sin(TWO_PI * 880 * t) * 0.2;
    left[i] = s;
    right[i] = s * 0.9;
  }
  return [left, right];
}

const TWO_PI = 2 * Math.PI;
const SAMPLE_RATE = 48000;
const DURATION = 0.5;
const HOP_HZ = 120;
const FRAME_RATE = 120;
const MAX_FRAMES = Math.ceil(DURATION * FRAME_RATE) + 2;

function twoBandSetup(): AudioSetup {
  return {
    files: [],
    bands: [
      {
        id: 'band-a',
        name: 'Low',
        sourceFileId: 'file-1',
        frequencyBands: [[60, 250]],
        bandMode: 'mean',
        fftSize: 2048,
        smoothingHalfLifeSeconds: 1 / 120,
      },
      {
        id: 'band-b',
        name: 'High',
        sourceFileId: 'file-1',
        frequencyBands: [[2000, 8000]],
        bandMode: 'mean',
        fftSize: 2048,
        smoothingHalfLifeSeconds: 1 / 120,
      },
    ],
    remappers: [
      {
        id: 'remap-a',
        name: 'Low map',
        bandId: 'band-a',
        inMin: 0,
        inMax: 1,
        outMin: 0,
        outMax: 1,
      },
    ],
  };
}

function compareSeries(a: Float32Array, b: Float32Array, sampleIndices: number[]): void {
  expect(a.length).toBe(b.length);
  for (const k of sampleIndices) {
    expect(Math.abs((a[k] ?? 0) - (b[k] ?? 0))).toBeLessThan(1e-5);
  }
}

describe('Tier B band subset rebuild parity', () => {
  const pcm = makeTestPcm(SAMPLE_RATE, DURATION);

  it('subset rebuild for one band matches full build band series', () => {
    const setup = twoBandSetup();
    const { analyzerConfigs, remapperConfigs } = buildOfflineAudioAnalysisConfigs(setup, 'file-1');

    const fullCache = buildFullAnalysisCache({
      pcmChannels: pcm,
      sampleRate: SAMPLE_RATE,
      startTimeSeconds: 0,
      hopHz: HOP_HZ,
      frameRateForDuration: FRAME_RATE,
      maxFrames: MAX_FRAMES,
      analyzerConfigs,
      remapperConfigs,
    });

    const changedSetup: AudioSetup = {
      ...setup,
      bands: setup.bands.map((b) =>
        b.id === 'band-a' ? { ...b, bandMode: 'max' as const, frequencyBands: [[80, 300]] } : b
      ),
    };
    const { analyzerConfigs: nextConfigs, remapperConfigs: nextRemappers } = buildOfflineAudioAnalysisConfigs(
      changedSetup,
      'file-1'
    );
    const subsetConfig = nextConfigs.filter((a) => a.nodeId === 'band-a');

    const patchedSeries = buildBandSmoothedSeriesSubset(
      {
        pcmChannels: pcm,
        sampleRate: SAMPLE_RATE,
        startTimeSeconds: 0,
        hopHz: HOP_HZ,
        frameRateForDuration: FRAME_RATE,
        maxFrames: MAX_FRAMES,
        analyzerConfigs: [],
        remapperConfigs: [],
      },
      subsetConfig
    );

    const fullNextCache = buildFullAnalysisCache({
      pcmChannels: pcm,
      sampleRate: SAMPLE_RATE,
      startTimeSeconds: 0,
      hopHz: HOP_HZ,
      frameRateForDuration: FRAME_RATE,
      maxFrames: MAX_FRAMES,
      analyzerConfigs: nextConfigs,
      remapperConfigs: nextRemappers,
    });

    const fullSeries = extractBandSmoothedSeriesFromCache(fullNextCache);
    const sampleIndices = [0, 3, 17, 42, 99, fullCache.frameCount - 1];

    compareSeries(patchedSeries.get('band-a')!, fullSeries.get('band-a')!, sampleIndices);
  });

  it('changing band A only leaves band B channels identical vs full rebuild', () => {
    const setup = twoBandSetup();
    const { analyzerConfigs, remapperConfigs } = buildOfflineAudioAnalysisConfigs(setup, 'file-1');

    const baselineCache = buildFullAnalysisCache({
      pcmChannels: pcm,
      sampleRate: SAMPLE_RATE,
      startTimeSeconds: 0,
      hopHz: HOP_HZ,
      frameRateForDuration: FRAME_RATE,
      maxFrames: MAX_FRAMES,
      analyzerConfigs,
      remapperConfigs,
    });

    const changedSetup: AudioSetup = {
      ...setup,
      bands: setup.bands.map((b) =>
        b.id === 'band-a' ? { ...b, fftSize: 4096, frequencyBands: [[100, 400]] } : b
      ),
    };
    const { analyzerConfigs: nextConfigs, remapperConfigs: nextRemappers } = buildOfflineAudioAnalysisConfigs(
      changedSetup,
      'file-1'
    );

    const bandSeries = extractBandSmoothedSeriesFromCache(baselineCache);
    const subsetConfig = nextConfigs.filter((a) => a.nodeId === 'band-a');
    const rebuiltA = buildBandSmoothedSeriesSubset(
      {
        pcmChannels: pcm,
        sampleRate: SAMPLE_RATE,
        startTimeSeconds: 0,
        hopHz: HOP_HZ,
        frameRateForDuration: FRAME_RATE,
        maxFrames: MAX_FRAMES,
        analyzerConfigs: [],
        remapperConfigs: [],
      },
      subsetConfig
    );
    bandSeries.set('band-a', rebuiltA.get('band-a')!);

    const patchedCache = {
      startTimeSeconds: baselineCache.startTimeSeconds,
      hopSeconds: baselineCache.hopSeconds,
      frameCount: baselineCache.frameCount,
      channels: baselineCache.channels.map((c) => ({ ...c })),
      values: new Float32Array(baselineCache.values),
    };

    patchBandAndRemapChannelsFromBandSeries(patchedCache, bandSeries, subsetConfig);
    patchRemapperChannelsFromBandCache(patchedCache, bandSeries, nextRemappers);

    const fullNextCache = buildFullAnalysisCache({
      pcmChannels: pcm,
      sampleRate: SAMPLE_RATE,
      startTimeSeconds: 0,
      hopHz: HOP_HZ,
      frameRateForDuration: FRAME_RATE,
      maxFrames: MAX_FRAMES,
      analyzerConfigs: nextConfigs,
      remapperConfigs: nextRemappers,
    });

    const channelCount = patchedCache.channels.length;
    const bandBIndex = patchedCache.channels.findIndex((c) => c.nodeId === 'band-b' && c.paramName === 'band');
    expect(bandBIndex).toBeGreaterThanOrEqual(0);
    const fc = patchedCache.frameCount;
    const sampleIndices = [0, 5, 20, Math.min(55, fc - 1), fc - 2, fc - 1];

    for (const k of sampleIndices) {
      const patched = patchedCache.values[k * channelCount + bandBIndex]!;
      const full = fullNextCache.values[k * channelCount + bandBIndex]!;
      expect(Math.abs(patched - full)).toBeLessThan(1e-5);
    }

    const bandAIndex = patchedCache.channels.findIndex((c) => c.nodeId === 'band-a' && c.paramName === 'band');
    for (const k of sampleIndices) {
      const patched = patchedCache.values[k * channelCount + bandAIndex]!;
      const full = fullNextCache.values[k * channelCount + bandAIndex]!;
      expect(Math.abs(patched - full)).toBeLessThan(1e-5);
    }
  });
});

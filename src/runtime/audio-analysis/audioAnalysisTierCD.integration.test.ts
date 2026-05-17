import { describe, expect, it } from 'vitest';
import type { AudioSetup } from '../../data-model/audioSetupTypes';
import { buildOfflineAudioAnalysisConfigs } from '../../video-export/OfflineAudioProvider';
import { AudioAnalysisCurveSampler } from './AudioAnalysisCurveSampler';
import {
  buildBandSmoothedSeriesSubset,
  buildFullAnalysisCache,
} from './audioAnalysisBuildCore';
import {
  extractBandSmoothedSeriesFromCache,
  patchBandAndRemapChannelsFromBandSeries,
  patchRemapperChannelsFromBandCache,
} from './audioAnalysisRemapperPatch';
import { reshapeCurveCacheTopology } from './audioAnalysisStructuralPatch';

const SAMPLE_RATE = 48000;
const DURATION = 0.5;
const HOP_HZ = 120;
const FRAME_RATE = 120;
const MAX_FRAMES = Math.ceil(DURATION * FRAME_RATE) + 2;

function makeTestPcm(): Float32Array[] {
  const length = Math.ceil(SAMPLE_RATE * DURATION);
  const ch = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    ch[i] = Math.sin(2 * Math.PI * 220 * t) * 0.35 + Math.sin(2 * Math.PI * 660 * t) * 0.15;
  }
  return [ch];
}

function twoBandSetup(): AudioSetup {
  return {
    files: [],
    bands: [
      {
        id: 'band-a',
        name: 'Low',
        sourceFileId: 'file-1',
        frequencyBands: [[60, 300]],
        bandMode: 'mean',
        fftSize: 2048,
        smoothingHalfLifeSeconds: 1 / 120,
      },
      {
        id: 'band-b',
        name: 'High',
        sourceFileId: 'file-1',
        frequencyBands: [[2000, 6000]],
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

function twoFileSetup(): { setup: AudioSetup; file1: string; file2: string } {
  return {
    file1: 'file-1',
    file2: 'file-2',
    setup: {
      files: [],
      bands: [
        {
          id: 'band-f1',
          name: 'F1',
          sourceFileId: 'file-1',
          frequencyBands: [[80, 400]],
          fftSize: 2048,
          smoothingHalfLifeSeconds: 1 / 120,
        },
        {
          id: 'band-f2',
          name: 'F2',
          sourceFileId: 'file-2',
          frequencyBands: [[400, 2000]],
          fftSize: 2048,
          smoothingHalfLifeSeconds: 1 / 120,
        },
      ],
      remappers: [
        {
          id: 'remap-f1',
          name: 'R1',
          bandId: 'band-f1',
          inMin: 0,
          inMax: 1,
          outMin: 0,
          outMax: 1,
        },
        {
          id: 'remap-f2',
          name: 'R2',
          bandId: 'band-f2',
          inMin: 0,
          inMax: 1,
          outMin: 0,
          outMax: 1,
        },
      ],
    },
  };
}

function uniformSnapshot(sampler: AudioAnalysisCurveSampler, time: number): Map<string, number> {
  const m = new Map<string, number>();
  for (const u of sampler.getUniformUpdatesAtTime(time)) {
    m.set(`${u.nodeId}.${u.paramName}`, u.value);
  }
  return m;
}

function compareSnapshots(a: Map<string, number>, b: Map<string, number>, epsilon = 1e-5): void {
  const keys = new Set([...a.keys(), ...b.keys()]);
  for (const key of keys) {
    expect(a.has(key), `missing in a: ${key}`).toBe(true);
    expect(b.has(key), `missing in b: ${key}`).toBe(true);
    expect(Math.abs((a.get(key) ?? 0) - (b.get(key) ?? 0))).toBeLessThan(epsilon);
  }
}

/** Simulates Tier A → B → A on one file; final curves match one full rebuild of final setup. */
describe('Tier C/D integration — rapid mixed edits', () => {
  const pcm = makeTestPcm();

  it('remapper → band → remapper sequence matches full rebuild of final setup', () => {
    const setup0 = twoBandSetup();
    const { analyzerConfigs, remapperConfigs } = buildOfflineAudioAnalysisConfigs(setup0, 'file-1');
    let cache = buildFullAnalysisCache({
      pcmChannels: pcm,
      sampleRate: SAMPLE_RATE,
      startTimeSeconds: 0,
      hopHz: HOP_HZ,
      frameRateForDuration: FRAME_RATE,
      maxFrames: MAX_FRAMES,
      analyzerConfigs,
      remapperConfigs,
    });
    let bandSeries = extractBandSmoothedSeriesFromCache(cache);

    const setup1: AudioSetup = {
      ...setup0,
      remappers: [{ ...setup0.remappers[0]!, inMin: 0.1, inMax: 0.9, outMin: 0.05, outMax: 0.95 }],
    };
    patchRemapperChannelsFromBandCache(
      cache,
      bandSeries,
      buildOfflineAudioAnalysisConfigs(setup1, 'file-1').remapperConfigs
    );

    const setup2: AudioSetup = {
      ...setup1,
      bands: setup1.bands.map((b) =>
        b.id === 'band-a' ? { ...b, bandMode: 'max' as const, frequencyBands: [[70, 350]] } : b
      ),
    };
    const subset = buildOfflineAudioAnalysisConfigs(setup2, 'file-1').analyzerConfigs.filter(
      (a) => a.nodeId === 'band-a'
    );
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
      subset
    );
    for (const [bandId, series] of patchedSeries) {
      bandSeries.set(bandId, series);
    }
    patchBandAndRemapChannelsFromBandSeries(cache, bandSeries, subset);
    patchRemapperChannelsFromBandCache(
      cache,
      bandSeries,
      buildOfflineAudioAnalysisConfigs(setup2, 'file-1').remapperConfigs
    );

    const setup3: AudioSetup = {
      ...setup2,
      remappers: [{ ...setup2.remappers[0]!, outMin: 0.2, outMax: 0.7 }],
    };
    patchRemapperChannelsFromBandCache(
      cache,
      bandSeries,
      buildOfflineAudioAnalysisConfigs(setup3, 'file-1').remapperConfigs
    );

    const incrementalSampler = new AudioAnalysisCurveSampler(cache);

    const { analyzerConfigs: finalConfigs, remapperConfigs: finalRemappers } = buildOfflineAudioAnalysisConfigs(
      setup3,
      'file-1'
    );
    const fullCache = buildFullAnalysisCache({
      pcmChannels: pcm,
      sampleRate: SAMPLE_RATE,
      startTimeSeconds: 0,
      hopHz: HOP_HZ,
      frameRateForDuration: FRAME_RATE,
      maxFrames: MAX_FRAMES,
      analyzerConfigs: finalConfigs,
      remapperConfigs: finalRemappers,
    });
    const fullSampler = new AudioAnalysisCurveSampler(fullCache);

    const times = [0.03, 0.11, 0.19, 0.27, 0.35, 0.42];
    for (const t of times) {
      compareSnapshots(uniformSnapshot(incrementalSampler, t), uniformSnapshot(fullSampler, t));
    }
  });
});

describe('Tier C/D integration — multi-file independence', () => {
  const pcm = makeTestPcm();

  it('remapper edit on file 2 does not mutate file 1 sampler cache', () => {
    const { setup, file1, file2 } = twoFileSetup();

    const buildForFile = (fileId: string) => {
      const { analyzerConfigs, remapperConfigs } = buildOfflineAudioAnalysisConfigs(setup, fileId);
      return buildFullAnalysisCache({
        pcmChannels: pcm,
        sampleRate: SAMPLE_RATE,
        startTimeSeconds: 0,
        hopHz: HOP_HZ,
        frameRateForDuration: FRAME_RATE,
        maxFrames: MAX_FRAMES,
        analyzerConfigs,
        remapperConfigs,
      });
    };

    const cache1 = buildForFile(file1);
    const cache2 = buildForFile(file2);
    const sampler1Before = new AudioAnalysisCurveSampler(cache1);
    const snap1Before = uniformSnapshot(sampler1Before, 0.12);

    const nextSetup: AudioSetup = {
      ...setup,
      remappers: setup.remappers.map((r) =>
        r.id === 'remap-f2' ? { ...r, inMin: 0.2, inMax: 0.85, outMin: 0.1, outMax: 0.9 } : r
      ),
    };
    const bandSeries2 = extractBandSmoothedSeriesFromCache(cache2);
    patchRemapperChannelsFromBandCache(
      cache2,
      bandSeries2,
      buildOfflineAudioAnalysisConfigs(nextSetup, file2).remapperConfigs
    );
    new AudioAnalysisCurveSampler(cache2);

    const sampler1After = new AudioAnalysisCurveSampler(cache1);
    compareSnapshots(snap1Before, uniformSnapshot(sampler1After, 0.12));
  });

  it('structural add remapper on file 1 leaves file 2 cache reference stable', () => {
    const { setup, file1, file2 } = twoFileSetup();
    const buildForFile = (fileId: string, s: AudioSetup) => {
      const { analyzerConfigs, remapperConfigs } = buildOfflineAudioAnalysisConfigs(s, fileId);
      return buildFullAnalysisCache({
        pcmChannels: pcm,
        sampleRate: SAMPLE_RATE,
        startTimeSeconds: 0,
        hopHz: HOP_HZ,
        frameRateForDuration: FRAME_RATE,
        maxFrames: MAX_FRAMES,
        analyzerConfigs,
        remapperConfigs,
      });
    };

    const cache1 = buildForFile(file1, setup);
    const cache2 = buildForFile(file2, setup);
    const cache2Ref = cache2;

    const nextSetup: AudioSetup = {
      ...setup,
      remappers: [
        ...setup.remappers,
        {
          id: 'remap-f1b',
          name: 'Extra',
          bandId: 'band-f1',
          inMin: 0,
          inMax: 1,
          outMin: 0.3,
          outMax: 0.7,
        },
      ],
    };
    const bandSeries1 = extractBandSmoothedSeriesFromCache(cache1);
    reshapeCurveCacheTopology(cache1, nextSetup, file1, bandSeries1);

    expect(cache2).toBe(cache2Ref);
  });
});

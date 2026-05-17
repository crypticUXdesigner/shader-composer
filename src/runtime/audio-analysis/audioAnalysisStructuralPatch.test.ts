import { describe, expect, it } from 'vitest';
import type { AudioSetup } from '../../data-model/audioSetupTypes';
import { buildOfflineAudioAnalysisConfigs } from '../../video-export/OfflineAudioProvider';
import { AudioAnalysisCurveSampler } from './AudioAnalysisCurveSampler';
import { buildFullAnalysisCache } from './audioAnalysisBuildCore';
import { extractBandSmoothedSeriesFromCache, patchRemapperChannelsFromBandCache } from './audioAnalysisRemapperPatch';
import { isRemapperTopologyOnlyStructuralChange, reshapeCurveCacheTopology } from './audioAnalysisStructuralPatch';

const SAMPLE_RATE = 48000;
const DURATION = 0.4;
const HOP_HZ = 120;
const FRAME_RATE = 120;
const MAX_FRAMES = Math.ceil(DURATION * FRAME_RATE) + 2;

function makeTestPcm(): Float32Array[] {
  const length = Math.ceil(SAMPLE_RATE * DURATION);
  const ch = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    ch[i] = Math.sin((2 * Math.PI * 440 * i) / SAMPLE_RATE) * 0.35;
  }
  return [ch, ch];
}

function baseSetup(): AudioSetup {
  return {
    files: [],
    bands: [
      {
        id: 'band-a',
        name: 'A',
        sourceFileId: 'file-1',
        frequencyBands: [[80, 400]],
        bandMode: 'mean',
        fftSize: 2048,
        smoothingHalfLifeSeconds: 1 / 120,
      },
    ],
    remappers: [
      {
        id: 'remap-1',
        name: 'R1',
        bandId: 'band-a',
        inMin: 0,
        inMax: 1,
        outMin: 0,
        outMax: 1,
      },
    ],
  };
}

function sampleUniforms(
  sampler: AudioAnalysisCurveSampler,
  times: number[]
): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const t of times) {
    for (const u of sampler.getUniformUpdatesAtTime(t)) {
      const key = `${u.nodeId}.${u.paramName}`;
      if (!out.has(key)) out.set(key, []);
      out.get(key)!.push(u.value);
    }
  }
  return out;
}

describe('audioAnalysisStructuralPatch', () => {
  const pcm = makeTestPcm();

  it('isRemapperTopologyOnlyStructuralChange for add remapper', () => {
    const prev = baseSetup();
    const next: AudioSetup = {
      ...prev,
      remappers: [
        ...prev.remappers,
        {
          id: 'remap-2',
          name: 'R2',
          bandId: 'band-a',
          inMin: 0.1,
          inMax: 0.9,
          outMin: 0,
          outMax: 1,
        },
      ],
    };
    expect(isRemapperTopologyOnlyStructuralChange(prev, next, 'file-1')).toBe(true);
  });

  it('reshapeCurveCacheTopology matches full build after add remapper', () => {
    const prev = baseSetup();
    const next: AudioSetup = {
      ...prev,
      remappers: [
        ...prev.remappers,
        {
          id: 'remap-2',
          name: 'R2',
          bandId: 'band-a',
          inMin: 0.15,
          inMax: 0.85,
          outMin: 0.2,
          outMax: 0.8,
        },
      ],
    };

    const { analyzerConfigs: prevConfigs, remapperConfigs: prevRemappers } = buildOfflineAudioAnalysisConfigs(
      prev,
      'file-1'
    );
    const prevCache = buildFullAnalysisCache({
      pcmChannels: pcm,
      sampleRate: SAMPLE_RATE,
      startTimeSeconds: 0,
      hopHz: HOP_HZ,
      frameRateForDuration: FRAME_RATE,
      maxFrames: MAX_FRAMES,
      analyzerConfigs: prevConfigs,
      remapperConfigs: prevRemappers,
    });
    const bandSeries = extractBandSmoothedSeriesFromCache(prevCache);
    const reshaped = reshapeCurveCacheTopology(prevCache, next, 'file-1', bandSeries);

    const { analyzerConfigs: nextConfigs, remapperConfigs: nextRemappers } = buildOfflineAudioAnalysisConfigs(
      next,
      'file-1'
    );
    const fullNext = buildFullAnalysisCache({
      pcmChannels: pcm,
      sampleRate: SAMPLE_RATE,
      startTimeSeconds: 0,
      hopHz: HOP_HZ,
      frameRateForDuration: FRAME_RATE,
      maxFrames: MAX_FRAMES,
      analyzerConfigs: nextConfigs,
      remapperConfigs: nextRemappers,
    });

    const times = [0.02, 0.08, 0.15, 0.22, 0.31];
    const reshapedSampler = new AudioAnalysisCurveSampler(reshaped);
    const fullSampler = new AudioAnalysisCurveSampler(fullNext);
    const a = sampleUniforms(reshapedSampler, times);
    const b = sampleUniforms(fullSampler, times);

    for (const [key, valuesA] of a) {
      const valuesB = b.get(key);
      expect(valuesB, key).toBeDefined();
      for (let i = 0; i < valuesA.length; i++) {
        expect(Math.abs(valuesA[i]! - valuesB![i]!)).toBeLessThan(1e-5);
      }
    }
  });
});

import { describe, expect, it } from 'vitest';
import type { AudioAnalysisCurveCache } from './AudioAnalysisCurveSampler';
import {
  extractBandSmoothedSeriesFromCache,
  patchRemapperChannelsFromBandCache,
} from './audioAnalysisRemapperPatch';
import { remapValue } from '../audio/remapValue';

function buildSyntheticCache(
  frameCount: number,
  bandId: string,
  bandSeries: Float32Array,
  remapperId: string,
  remapperConfig: { inMin: number; inMax: number; outMin: number; outMax: number }
): AudioAnalysisCurveCache {
  const channels = [
    { nodeId: bandId, paramName: 'band', min: 0, max: 1, defaultValue: 0 },
    { nodeId: `remap-${remapperId}`, paramName: 'out', min: 0, max: 1, defaultValue: 0 },
  ];
  const channelCount = channels.length;
  const values = new Float32Array(frameCount * channelCount);
  for (let k = 0; k < frameCount; k++) {
    const raw = bandSeries[k]!;
    values[k * channelCount] = raw;
    values[k * channelCount + 1] = remapValue(
      raw,
      remapperConfig.inMin,
      remapperConfig.inMax,
      remapperConfig.outMin,
      remapperConfig.outMax
    );
  }
  return {
    startTimeSeconds: 0,
    hopSeconds: 1 / 120,
    frameCount,
    channels,
    values,
  };
}

describe('audioAnalysisRemapperPatch', () => {
  it('extractBandSmoothedSeriesFromCache round-trips band channel', () => {
    const frameCount = 48;
    const bandSeries = Float32Array.from({ length: frameCount }, (_, k) => k / frameCount);
    const cache = buildSyntheticCache(frameCount, 'band-a', bandSeries, 'r1', {
      inMin: 0,
      inMax: 1,
      outMin: 0,
      outMax: 1,
    });
    const extracted = extractBandSmoothedSeriesFromCache(cache);
    expect(extracted.get('band-a')).toEqual(bandSeries);
  });

  it('patchRemapperChannelsFromBandCache matches full remap at sampled frames', () => {
    const frameCount = 240;
    const bandSeries = Float32Array.from({ length: frameCount }, (_, k) =>
      Math.sin(k * 0.07) * 0.4 + 0.5
    );
    const initialRemap = { inMin: 0, inMax: 1, outMin: 0, outMax: 1 };
    const cache = buildSyntheticCache(frameCount, 'band-a', bandSeries, 'r1', initialRemap);
    const bandSeriesByBandId = extractBandSmoothedSeriesFromCache(cache);

    const nextRemap = { inMin: 0.2, inMax: 0.8, outMin: 0.1, outMax: 0.9 };
    patchRemapperChannelsFromBandCache(cache, bandSeriesByBandId, [
      { id: 'r1', bandId: 'band-a', ...nextRemap },
    ]);

    const channelCount = cache.channels.length;
    const remapperChannelIndex = 1;
    const sampleIndices = [0, 3, 17, 42, 99, 120, 155, 200, 239];
    for (let i = 0; i < 20; i++) {
      const k = sampleIndices[i % sampleIndices.length]!;
      const expected = remapValue(
        bandSeries[k]!,
        nextRemap.inMin,
        nextRemap.inMax,
        nextRemap.outMin,
        nextRemap.outMax
      );
      const actual = cache.values[k * channelCount + remapperChannelIndex]!;
      expect(Math.abs(actual - expected)).toBeLessThan(1e-5);
    }
  });
});

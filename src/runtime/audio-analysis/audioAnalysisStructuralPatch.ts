/**
 * Tier C structural patch: reshape published curve cache when remapper topology changes
 * but band FFT/smoothing config is unchanged (add/remove remapper, stable band ids).
 */

import type { AudioSetup } from '../../data-model/audioSetupTypes';
import { buildOfflineAudioAnalysisConfigs } from '../../video-export/OfflineAudioProvider';
import {
  bandAnalysisDigest,
  classifyAudioSetupChange,
  structuralDigest,
  type AudioSetupChangeBuffers,
} from './audioAnalysisInvalidation';
import type { AudioAnalysisCurveCache } from './AudioAnalysisCurveSampler';
import { buildAnalysisChannels } from './audioAnalysisBuildCore';
import {
  patchBandAndRemapChannelsFromBandSeries,
  patchRemapperChannelsFromBandCache,
} from './audioAnalysisRemapperPatch';

/** Structural tier with unchanged band-analysis fields — safe to reshape channels without FFT. */
export function isRemapperTopologyOnlyStructuralChange(
  prev: AudioSetup,
  next: AudioSetup,
  fileId: string,
  buffers?: AudioSetupChangeBuffers
): boolean {
  const tier = classifyAudioSetupChange(prev, next, fileId, buffers);
  if (tier !== 'structural') return false;
  if (bandAnalysisDigest(prev, fileId) !== bandAnalysisDigest(next, fileId)) return false;
  return structuralDigest(prev, fileId) !== structuralDigest(next, fileId);
}

/**
 * Rebuild channel layout from setup; copy existing band/remap columns; fill remapperOut from band series.
 */
export function reshapeCurveCacheTopology(
  cache: AudioAnalysisCurveCache,
  setup: AudioSetup,
  fileId: string,
  bandSeriesByBandId: Map<string, Float32Array>
): AudioAnalysisCurveCache {
  const { analyzerConfigs, remapperConfigs } = buildOfflineAudioAnalysisConfigs(setup, fileId);
  const channelMeta = buildAnalysisChannels(analyzerConfigs, remapperConfigs);
  const newChannels = channelMeta.map((c) => ({
    nodeId: c.nodeId,
    paramName: c.paramName,
    min: c.min,
    max: c.max,
    defaultValue: c.defaultValue,
  }));

  const { frameCount } = cache;
  const oldChannelCount = cache.channels.length;
  const newChannelCount = newChannels.length;
  const newValues = new Float32Array(frameCount * newChannelCount);

  const oldIndexByKey = new Map<string, number>();
  for (let j = 0; j < oldChannelCount; j++) {
    const ch = cache.channels[j]!;
    oldIndexByKey.set(`${ch.nodeId}\0${ch.paramName}`, j);
  }

  for (let j = 0; j < newChannelCount; j++) {
    const ch = newChannels[j]!;
    const oldJ = oldIndexByKey.get(`${ch.nodeId}\0${ch.paramName}`);
    if (oldJ === undefined) continue;
    for (let k = 0; k < frameCount; k++) {
      newValues[k * newChannelCount + j] = cache.values[k * oldChannelCount + oldJ]!;
    }
  }

  const nextCache: AudioAnalysisCurveCache = {
    startTimeSeconds: cache.startTimeSeconds,
    hopSeconds: cache.hopSeconds,
    frameCount,
    channels: newChannels,
    values: newValues,
  };

  patchBandAndRemapChannelsFromBandSeries(nextCache, bandSeriesByBandId, analyzerConfigs);
  patchRemapperChannelsFromBandCache(nextCache, bandSeriesByBandId, remapperConfigs);
  return nextCache;
}

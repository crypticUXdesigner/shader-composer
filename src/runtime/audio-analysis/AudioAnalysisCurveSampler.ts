import type { UniformUpdate } from '../../video-export/OfflineAudioProvider';

export type AudioAnalysisCurveCache = {
  startTimeSeconds: number;
  hopSeconds: number;
  frameCount: number;
  channels: Array<{ nodeId: string; paramName: string; min?: number; max?: number; defaultValue?: number }>;
  values: Float32Array;
};

function clampNumber(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export class AudioAnalysisCurveSampler {
  private readonly cache: AudioAnalysisCurveCache;
  private readonly sampledValues: Float32Array;

  constructor(cache: AudioAnalysisCurveCache) {
    this.cache = cache;
    this.sampledValues = new Float32Array(cache.channels.length);
  }

  /** Mutable cache reference for Tier A remapper patch (in-place channel rewrite). */
  getCurveCache(): AudioAnalysisCurveCache {
    return this.cache;
  }

  getUniformUpdatesAtTime(timeSeconds: number): UniformUpdate[] {
    const cache = this.cache;
    const channelCount = cache.channels.length;
    if (cache.frameCount < 2 || channelCount === 0) return [];

    const x = (timeSeconds - cache.startTimeSeconds) / cache.hopSeconds;
    const i0 = clampNumber(Math.floor(x + 1e-9), 0, cache.frameCount - 2);
    const i1 = i0 + 1;
    const u = clampNumber(x - i0, 0, 1);
    const o0 = i0 * channelCount;
    const o1 = i1 * channelCount;

    for (let j = 0; j < channelCount; j++) {
      const a = cache.values[o0 + j]!;
      const b = cache.values[o1 + j]!;
      this.sampledValues[j] = a + (b - a) * u;
    }

    const updates: UniformUpdate[] = new Array(channelCount);
    for (let j = 0; j < channelCount; j++) {
      const ch = cache.channels[j]!;
      let v = this.sampledValues[j] ?? (ch.defaultValue ?? 0);
      if (ch.min !== undefined) v = Math.max(ch.min, v);
      if (ch.max !== undefined) v = Math.min(ch.max, v);
      updates[j] = { nodeId: ch.nodeId, paramName: ch.paramName, value: v };
    }
    return updates;
  }
}


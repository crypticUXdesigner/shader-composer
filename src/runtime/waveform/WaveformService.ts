/**
 * WaveformService - unified waveform data for current primary source (02B).
 * For playlist tracks: audiograph API (with buffer fallback on failure).
 * For uploads: buffer-derived waveform only.
 * Exposes getWaveformForPrimary(), getWaveformForCurveEditor(), and getWaveformSlice() for 03A/03B/03C.
 */

import type { PrimarySource } from '../../data-model/audioSetupTypes';
import type { AudiographResolution, WaveformData } from './types';
import { AudiographClient, SCRUBBER_RESOLUTION } from './AudiographClient';
import { computeWaveformFromBuffer, DEFAULT_WAVEFORM_LENGTH } from './bufferWaveform';
import { getTrackDurationSeconds, getTracksData, resolvePlaylistTrackMp3Url } from '../tracksData';

/** Normalize playlist trackId to API resource name (e.g. tracks/123). */
function toAudiographResourceName(trackId: string): string {
  return trackId.startsWith('tracks/') ? trackId : `tracks/${trackId}`;
}

/**
 * Audiograph resolution for the automation curve editor background (full track).
 * Higher than {@link SCRUBBER_RESOLUTION} so short regions still look detailed.
 */
export const CURVE_EDITOR_AUDIOGRAPH_RESOLUTION: AudiographResolution = 960;

/** Buffer RMS bucket count for uploads / buffer fallbacks when drawing the curve editor waveform. */
export const CURVE_EDITOR_BUFFER_WAVEFORM_LENGTH = 1920;

export interface WaveformServiceDeps {
  /** Current primary source (from audioSetup.primarySource). */
  getPrimarySource: () => PrimarySource | undefined;
  /** Primary file id (playlist trackId or upload file id). */
  getPrimaryFileId: () => string | undefined;
  /** Current primary AudioBuffer when loaded (e.g. from audioManager.getAudioNodeState(id)?.audioBuffer). */
  getPrimaryBuffer: () => AudioBuffer | null;
  /** Optional: resolve track duration in seconds for playlist track when buffer not yet loaded. Defaults to getTrackDurationSeconds. */
  getTrackDurationSeconds?: (trackId: string) => Promise<number | undefined>;
}

const EMPTY_WAVEFORM: WaveformData = { values: [], durationSeconds: 0, source: 'buffer' };

/**
 * Returns waveform values for the time range [startTime, endTime] as a slice of the full values.
 * Same 0–1 normalized format. If full values are empty, returns [].
 */
export function getWaveformSlice(
  fullValues: number[],
  durationSeconds: number,
  startTime: number,
  endTime: number
): number[] {
  if (fullValues.length === 0 || durationSeconds <= 0 || startTime >= endTime) return [];
  const start = Math.max(0, startTime);
  const end = Math.min(durationSeconds, endTime);
  const startIdx = Math.floor((start / durationSeconds) * fullValues.length);
  const endIdx = Math.ceil((end / durationSeconds) * fullValues.length);
  return fullValues.slice(startIdx, endIdx);
}

export class WaveformService {
  private deps: WaveformServiceDeps;
  private audiographClient: AudiographClient;
  private lastPrimaryId: string | undefined = undefined;
  private trackWaveformCache = new Map<string, WaveformData>();
  private trackWaveformInFlight = new Map<string, Promise<WaveformData>>();
  private decodeCtx: OfflineAudioContext | null = null;
  private disposed = false;

  constructor(deps: WaveformServiceDeps, audiographClient?: AudiographClient) {
    this.deps = deps;
    this.audiographClient = audiographClient ?? new AudiographClient();
  }

  /**
   * Stable key identifying the current primary audio source.
   * Intended for UI layers to subscribe to primary changes without knowing internals.
   */
  getPrimaryWaveformKey(): string {
    const primary = this.deps.getPrimarySource();
    const primaryId = this.deps.getPrimaryFileId();
    if (!primary || !primaryId) return '';
    return `${primary.type}:${primaryId}`;
  }

  /**
   * Stop audiograph / MP3 decode bookkeeping when the service is dropped (runtime teardown,
   * project switch). In-flight fetches still settle but no longer write into cleared caches.
   */
  dispose(): void {
    this.disposed = true;
    this.trackWaveformCache.clear();
    this.trackWaveformInFlight.clear();
    this.audiographClient.clearCache();
    this.lastPrimaryId = undefined;
    this.decodeCtx = null;
  }

  private getDecodeContext(): OfflineAudioContext {
    // OfflineAudioContext can decode without a user gesture and is safe for background work.
    if (this.decodeCtx) return this.decodeCtx;
    if (this.disposed) {
      // Straggling MP3 decode after `dispose()` must not reattach a context to this instance.
      return new OfflineAudioContext(1, 1, 44100);
    }
    this.decodeCtx = new OfflineAudioContext(1, 1, 44100);
    return this.decodeCtx;
  }

  private mp3WaveformCacheKey(trackId: string, targetLength: number): string {
    return `${trackId}\0${targetLength}`;
  }

  private async getWaveformFromTrackMp3(trackId: string, targetLength: number): Promise<WaveformData> {
    const cacheKey = this.mp3WaveformCacheKey(trackId, targetLength);
    const cached = this.trackWaveformCache.get(cacheKey);
    if (cached) return cached;
    const inFlight = this.trackWaveformInFlight.get(cacheKey);
    if (inFlight) return inFlight;

    const promise = (async () => {
      if (this.disposed) return EMPTY_WAVEFORM;
      try {
        const data = await getTracksData();
        const mp3Url = resolvePlaylistTrackMp3Url(data, toAudiographResourceName(trackId));
        if (!mp3Url) return EMPTY_WAVEFORM;

        const res = await fetch(mp3Url);
        if (!res.ok) return EMPTY_WAVEFORM;
        const arrayBuffer = await res.arrayBuffer();

        const ctx = this.getDecodeContext();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
        const { values, durationSeconds } = computeWaveformFromBuffer(audioBuffer, targetLength);

        const waveform: WaveformData = {
          values,
          valuesRight: values.slice(),
          durationSeconds,
          source: 'buffer',
        };
        if (!this.disposed) this.trackWaveformCache.set(cacheKey, waveform);
        return waveform;
      } catch {
        return EMPTY_WAVEFORM;
      }
    })();

    this.trackWaveformInFlight.set(cacheKey, promise);
    promise.finally(() => this.trackWaveformInFlight.delete(cacheKey));
    return promise;
  }

  /**
   * Shared implementation: audiograph resolution and buffer bucket count differ per consumer.
   */
  private async resolveWaveformForPrimary(options: {
    audiographResolution: AudiographResolution;
    bufferTargetLength: number;
  }): Promise<WaveformData> {
    const { audiographResolution, bufferTargetLength } = options;
    if (this.disposed) return EMPTY_WAVEFORM;
    const primary = this.deps.getPrimarySource();
    const primaryId = this.deps.getPrimaryFileId();
    const buffer = this.deps.getPrimaryBuffer();

    if (!primary || !primaryId) {
      return EMPTY_WAVEFORM;
    }

    // Invalidate audiograph cache when primary changes
    if (this.lastPrimaryId != null && this.lastPrimaryId !== primaryId) {
      this.audiographClient.clearCache();
    }
    this.lastPrimaryId = primaryId;

    if (primary.type === 'upload') {
      if (!buffer) return EMPTY_WAVEFORM;
      const { values, durationSeconds } = computeWaveformFromBuffer(buffer, bufferTargetLength);
      return { values, durationSeconds, source: 'buffer' };
    }

    // Playlist: stereo audiograph (reference); shared L/R scale. Fallback to buffer if empty/zeros.
    const resourceName = toAudiographResourceName(primary.trackId);
    const stereo = await this.audiographClient.getAudiographStereo(resourceName, audiographResolution);
    const left = stereo?.left ?? [];
    const right = stereo?.right ?? [];
    const maxL = left.length ? Math.max(...left) : 0;
    const hasUsefulAudiograph = left.length > 0 && maxL > 0;

    if (hasUsefulAudiograph) {
      const durationSeconds =
        buffer?.duration ??
        (await (this.deps.getTrackDurationSeconds ?? getTrackDurationSeconds)?.(primary.trackId)) ??
        0;
      return {
        values: left,
        valuesRight: right.length === left.length ? right : left,
        durationSeconds,
        source: 'audiograph',
      };
    }

    // Fallback: buffer-derived when we have the buffer (e.g. track already loaded for playback).
    // Used when audiograph is missing, empty, or all zeros so we still show a real waveform.
    if (buffer) {
      const { values, durationSeconds } = computeWaveformFromBuffer(buffer, bufferTargetLength);
      return { values, durationSeconds, source: 'buffer' };
    }

    // Last resort for playlist: fetch MP3 and derive waveform client-side (avoids relying on Audiograph RPC).
    // Cached per track id and target length.
    return await this.getWaveformFromTrackMp3(primary.trackId, bufferTargetLength);
  }

  /**
   * Get waveform for the current primary source.
   * Playlist: fetch audiograph (or from cache); on failure fall back to buffer if loaded.
   * Upload: buffer-derived only.
   * Returns empty WaveformData on no primary or when no data available (no crash).
   */
  async getWaveformForPrimary(): Promise<WaveformData> {
    return this.resolveWaveformForPrimary({
      audiographResolution: SCRUBBER_RESOLUTION,
      bufferTargetLength: DEFAULT_WAVEFORM_LENGTH,
    });
  }

  /**
   * Higher-resolution waveform for the automation curve editor background only.
   * Does not affect scrubber / mini timeline (those use {@link getWaveformForPrimary}).
   */
  async getWaveformForCurveEditor(): Promise<WaveformData> {
    return this.resolveWaveformForPrimary({
      audiographResolution: CURVE_EDITOR_AUDIOGRAPH_RESOLUTION,
      bufferTargetLength: CURVE_EDITOR_BUFFER_WAVEFORM_LENGTH,
    });
  }

  /**
   * Return a slice of waveform values for the given time window (for timeline/curve editor).
   * Use with the same `fullValues` / `durationSeconds` returned from getWaveformForPrimary or getWaveformForCurveEditor.
   */
  getWaveformSlice(
    fullValues: number[],
    durationSeconds: number,
    startTime: number,
    endTime: number
  ): number[] {
    return getWaveformSlice(fullValues, durationSeconds, startTime, endTime);
  }
}

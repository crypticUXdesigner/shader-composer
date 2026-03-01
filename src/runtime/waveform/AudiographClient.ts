/**
 * Client for AudioTool audiograph API (GetAudiographs).
 * Fetches RMS-normalized uint32[] per resource name; caches by (resource_name, resolution, channels).
 * Normalizes values to 0–1 for drawing.
 *
 * Checklist (matches rpc.audiotool.com):
 * - URL: POST {baseUrl}/audiotool.audiograph.v1.AudiographService/GetAudiographs (default base: https://rpc.audiotool.com)
 * - Headers: Content-Type: application/json; optional Authorization: Bearer <VITE_AUDIOTOOL_API_TOKEN>
 * - Body: JSON with resource_names (e.g. ["tracks/12345"]), resolution (120|240|480|960|1920|3840), channels (1|2)
 * - Track ID must be a valid Audiotool track/sample resource name (e.g. tracks/xyz).
 */

import type { AudiographChannels, AudiographResolution } from './types';

/** Response shape from GetAudiographs (JSON). */
interface GetAudiographsResponse {
  audiographs?: Array<{
    graphs?: Array<{ values?: unknown[] }>;
  }>;
}

/** Resolution for scrubber/timeline (reference: 120). */
export const SCRUBBER_RESOLUTION: AudiographResolution = 120;
const DEFAULT_RESOLUTION: AudiographResolution = SCRUBBER_RESOLUTION;
const DEFAULT_CHANNELS: AudiographChannels = 1;

/** Uint32 max for normalizing audiograph values to 0–1. */
const UINT32_MAX = 0xffff_ffff;

/** Default base URL for Audiograph RPC (override with VITE_AUDIOGRAPH_API_URL). */
const DEFAULT_AUDIOGRAPH_BASE_URL = 'https://rpc.audiotool.com';

function getAudiographBaseUrl(): string {
  try {
    const env = (import.meta as { env?: { VITE_AUDIOGRAPH_API_URL?: string } }).env;
    const fromEnv = (env?.VITE_AUDIOGRAPH_API_URL as string)?.trim();
    return fromEnv && fromEnv !== '' ? fromEnv : DEFAULT_AUDIOGRAPH_BASE_URL;
  } catch {
    return DEFAULT_AUDIOGRAPH_BASE_URL;
  }
}

/** Optional Bearer token for rpc.audiotool.com (VITE_AUDIOTOOL_API_TOKEN). */
function getApiToken(): string {
  try {
    const env = (import.meta as { env?: { VITE_AUDIOTOOL_API_TOKEN?: string } }).env;
    return (env?.VITE_AUDIOTOOL_API_TOKEN as string)?.trim() ?? '';
  } catch {
    return '';
  }
}

/**
 * Request body for GetAudiographs (snake_case as per API checklist).
 * resource_names, resolution (120|240|480|960|1920|3840), channels (1|2).
 */
function buildGetAudiographsBody(resourceName: string, resolution: number, channels: number): Record<string, unknown> {
  return {
    resource_names: [resourceName],
    resolution,
    channels,
  };
}

/**
 * Parse a single value from API (number or string).
 * Values already in 0–1 are kept; otherwise treat as integer (uint16 or uint32) and normalize to 0–1.
 * We use UINT32_MAX so values are in 0–1; caller then peak-normalizes so API scale (e.g. 0–65535) doesn't matter.
 */
function parseValue(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) {
    if (v >= 0 && v <= 1) return v;
    return Math.max(0, Math.min(1, v / UINT32_MAX));
  }
  const n = typeof v === 'string' ? Number(v) : Number.NaN;
  if (!Number.isFinite(n)) return 0;
  if (n >= 0 && n <= 1) return n;
  return Math.max(0, Math.min(1, n / UINT32_MAX));
}

/** Peak-normalize array to 0–1 range so waveform is visible regardless of API scale (uint16 vs uint32). */
function peakNormalize(values: number[]): void {
  if (values.length === 0) return;
  const max = Math.max(...values);
  if (max <= 0) return;
  for (let i = 0; i < values.length; i++) {
    values[i] /= max;
  }
}

/**
 * Audiograph API client with in-memory cache.
 * Uses HTTP POST with JSON body (grpc-gateway style); base URL from VITE_AUDIOGRAPH_API_URL.
 */
type MonoCacheEntry = { values: number[]; fetchedAt: number };
type StereoCacheEntry = { left: number[]; right: number[]; fetchedAt: number };

export class AudiographClient {
  private cache = new Map<string, MonoCacheEntry>();
  private stereoCache = new Map<string, StereoCacheEntry>();
  private monoInFlight = new Map<string, Promise<number[] | null>>();
  private stereoInFlight = new Map<string, Promise<{ left: number[]; right: number[] } | null>>();
  private readonly baseUrl: string;
  private readonly cacheTtlMs: number;
  private lastErrorLogged: string | null = null;

  constructor(options?: { baseUrl?: string; cacheTtlMs?: number }) {
    this.baseUrl = options?.baseUrl ?? getAudiographBaseUrl();
    this.cacheTtlMs = options?.cacheTtlMs ?? 300_000; // 5 min
  }

  private cacheKey(resourceName: string, resolution: AudiographResolution, channels: AudiographChannels): string {
    return `${resourceName}|${resolution}|${channels}`;
  }

  /**
   * Fetch audiograph for a resource (e.g. track id). Returns values normalized to 0–1.
   * On failure returns null; logs error once per distinct message.
   */
  async getAudiograph(
    resourceName: string,
    resolution: AudiographResolution = DEFAULT_RESOLUTION,
    channels: AudiographChannels = DEFAULT_CHANNELS
  ): Promise<number[] | null> {
    if (!this.baseUrl) return null;

    const key = this.cacheKey(resourceName, resolution, channels);
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.fetchedAt < this.cacheTtlMs) {
      return cached.values;
    }
    const inFlight = this.monoInFlight.get(key);
    if (inFlight) return inFlight;

    const promise = this.fetchMono(resourceName, resolution, channels, key);
    this.monoInFlight.set(key, promise);
    promise.finally(() => this.monoInFlight.delete(key));
    return promise;
  }

  private async fetchMono(
    resourceName: string,
    resolution: AudiographResolution,
    channels: AudiographChannels,
    key: string
  ): Promise<number[] | null> {
    try {
      const url = `${this.baseUrl.replace(/\/$/, '')}/audiotool.audiograph.v1.AudiographService/GetAudiographs`;
      const body = buildGetAudiographsBody(resourceName, resolution, channels);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = getApiToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as GetAudiographsResponse;
      if (!res.ok) {
        const msg = `Audiograph API error: ${res.status} ${res.statusText}`;
        this.logErrorOnce(msg);
        return null;
      }
      const ag = data.audiographs?.[0];
      const graphs = ag?.graphs;
      const raw = Array.isArray(graphs) ? graphs[0]?.values : undefined;
      if (!Array.isArray(raw) || raw.length === 0) {
        this.logEmptyAudiograph(resourceName, data, 'mono');
        return null;
      }
      const values = raw.map((v) => parseValue(v));
      peakNormalize(values);
      this.cache.set(key, { values, fetchedAt: Date.now() });
      this.lastErrorLogged = null;
      return values;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logErrorOnce(`Audiograph fetch failed: ${msg}`);
      return null;
    }
  }

  /**
   * Fetch stereo audiograph (left and right channels). Returns values normalized to 0–1.
   * Used for mini timeline bar display: up = left, down = right.
   */
  async getAudiographStereo(
    resourceName: string,
    resolution: AudiographResolution = DEFAULT_RESOLUTION
  ): Promise<{ left: number[]; right: number[] } | null> {
    if (!this.baseUrl) return null;

    const key = this.cacheKey(resourceName, resolution, 2);
    const cached = this.stereoCache.get(key);
    if (cached && Date.now() - cached.fetchedAt < this.cacheTtlMs) {
      return { left: cached.left, right: cached.right };
    }
    const inFlight = this.stereoInFlight.get(key);
    if (inFlight) return inFlight;

    const promise = this.fetchStereo(resourceName, resolution, key);
    this.stereoInFlight.set(key, promise);
    promise.finally(() => this.stereoInFlight.delete(key));
    return promise;
  }

  private async fetchStereo(
    resourceName: string,
    resolution: AudiographResolution,
    key: string
  ): Promise<{ left: number[]; right: number[] } | null> {
    try {
      const url = `${this.baseUrl.replace(/\/$/, '')}/audiotool.audiograph.v1.AudiographService/GetAudiographs`;
      const body = buildGetAudiographsBody(resourceName, resolution, 2);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = getApiToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as GetAudiographsResponse;
      if (!res.ok) {
        const msg = `Audiograph API error: ${res.status} ${res.statusText}`;
        this.logErrorOnce(msg);
        return null;
      }
      const ag = data.audiographs?.[0];
      const graphs = ag?.graphs ?? [];
      const rawLeft = Array.isArray(graphs[0]?.values) ? graphs[0].values : undefined;
      const rawRight = Array.isArray(graphs[1]?.values) ? graphs[1].values : undefined;
      if (!Array.isArray(rawLeft) || rawLeft.length === 0) {
        this.logEmptyAudiograph(resourceName, data, 'stereo');
        return null;
      }
      const left = rawLeft.map((v) => parseValue(v));
      const right =
        Array.isArray(rawRight) && rawRight.length === rawLeft.length
          ? rawRight.map((v) => parseValue(v))
          : left.slice();
      // Reference: shared peak normalization so L/R are comparable
      const maxLeft = left.length ? Math.max(...left) : 0;
      const maxRight = right.length ? Math.max(...right) : 0;
      const maxValue = Math.max(maxLeft, maxRight);
      if (maxValue > 0) {
        for (let i = 0; i < left.length; i++) {
          left[i] /= maxValue;
        }
        for (let i = 0; i < right.length; i++) {
          right[i] /= maxValue;
        }
      }
      this.stereoCache.set(key, { left, right, fetchedAt: Date.now() });
      this.lastErrorLogged = null;
      return { left, right };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logErrorOnce(`Audiograph stereo fetch failed: ${msg}`);
      return null;
    }
  }

  private logErrorOnce(_message: string): void {
    if (this.lastErrorLogged === _message) return;
    this.lastErrorLogged = _message;
  }

  private logEmptyAudiograph(
    _resourceName: string,
    _data: GetAudiographsResponse,
    _kind: 'mono' | 'stereo'
  ): void {
    // No logging; kept for call-site compatibility.
  }

  /** Invalidate cache for a resource (e.g. when primary changes). */
  invalidate(resourceName: string, resolution?: AudiographResolution, channels?: AudiographChannels): void {
    const prefix = `${resourceName}|`;
    if (resolution !== undefined && channels !== undefined) {
      const key = this.cacheKey(resourceName, resolution, channels);
      this.cache.delete(key);
      this.monoInFlight.delete(key);
      this.stereoCache.delete(this.cacheKey(resourceName, resolution, 2));
      this.stereoInFlight.delete(this.cacheKey(resourceName, resolution, 2));
    } else {
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) this.cache.delete(key), this.monoInFlight.delete(key);
      }
      for (const key of this.stereoCache.keys()) {
        if (key.startsWith(prefix)) this.stereoCache.delete(key), this.stereoInFlight.delete(key);
      }
    }
  }

  /** Clear entire cache (e.g. on primary change when caller doesn't know resource). */
  clearCache(): void {
    this.cache.clear();
    this.stereoCache.clear();
    this.monoInFlight.clear();
    this.stereoInFlight.clear();
  }
}

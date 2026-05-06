/**
 * Offline Audio Provider - Per-frame audio state for video export
 *
 * Given the primary audio file's AudioBuffer, sample rate, frame rate, and audioSetup
 * (for band/remapper config), produces per-frame state: raw channel samples for
 * the export file and FFT-derived band values (and remapped values) for shader uniforms.
 * No dependency on live AudioManager or DOM.
 */

import type { AudioSetup } from '../data-model/audioSetupTypes';
import type { AudioBandMode } from '../data-model/audioSetupTypes';
import { extractFrequencyBands01Into } from '../runtime/audio/extractFrequencyBands01';

// --- Types (API for 02B / 03) ---

export interface FrameAudioState {
  /**
   * One Float32Array per channel for this frame's audio chunk.
   * Length can vary by ±1 sample depending on sampleRate/frameRate rounding.
   */
  channelSamples: Float32Array[];
  /** Uniform updates: { nodeId, paramName, value } — apply via setAudioUniform / setParameters */
  uniformUpdates: Array<{ nodeId: string; paramName: string; value: number }>;
  /** Timeline currentTime for this frame (seconds). Used as uTimelineTime so automation stays in sync. */
  timelineTime: number;
}

export interface UniformUpdate {
  nodeId: string;
  paramName: string;
  value: number;
}

/** Per-band config derived from audioSetup. */
export interface AnalyzerConfig {
  nodeId: string;
  frequencyBands: Array<{ minHz: number; maxHz: number }>;
  /** Per-band extraction mode (parity with live preview). */
  bandModes: AudioBandMode[];
  /** Time-based smoothing half-life per band (seconds). */
  smoothingHalfLifeSeconds?: number[];
  /** Optional time-based attack half-life per band (seconds). When present with release, preferred over symmetric half-life. */
  attackHalfLifeSeconds?: number[];
  /** Optional time-based release half-life per band (seconds). When present with attack, preferred over symmetric half-life. */
  releaseHalfLifeSeconds?: number[];
  /**
   * FFT size used to compute the underlying spectrum (matches the live AnalyserNode's fftSize).
   * Live uses 4096 in AudioManager.loadAudioFile().
   */
  spectrumFftSize: number;
  /**
   * FFT size used for Hz→bin mapping (matches what live code currently uses when extracting bands).
   * Note: live stores this per band (often 2048) even though the underlying AnalyserNode is 4096.
   * To match preview, export mirrors this behavior.
   */
  mappingFftSize: number;
  bandRemap: Array<{ inMin: number; inMax: number; outMin: number; outMax: number }>;
}

export interface OfflineAudioProviderConfig {
  sampleRate: number;
  frameRate: number;
  /** Primary file id (from audioSetup.files[0]) */
  primaryFileId: string;
  /** Start time offset (seconds) for export (seek); uniforms and FFT sample at absolute time. */
  startTimeSeconds?: number;
  /** Total number of video frames to be exported (used to size analysis cache). */
  maxFrames: number;
  /** How analysis cache is built. 'eager' blocks; 'async' builds in chunks and reports readiness. */
  cacheBuildMode?: 'eager' | 'async';
  /** When cacheBuildMode is 'async', yield to the event loop every N canonical frames. */
  cacheYieldEveryFrames?: number;
  /** Optional progress callback for async cache builds. */
  onCacheBuildProgress01?: (progress01: number) => void;
  /** Band configs from audioSetup (filtered by primary file) */
  analyzerConfigs: AnalyzerConfig[];
  /** Remapper configs from audioSetup */
  remapperConfigs: Array<{ id: string; bandId: string; inMin: number; inMax: number; outMin: number; outMax: number }>;
}

// --- Offline FFT (radix-2, real input → magnitude spectrum 0–255) ---

const TWO_PI = 2 * Math.PI;

/**
 * In-place radix-2 FFT. Buffer length must be 2 * fftSize (interleaved re, im).
 * Input: real samples in buffer[0], buffer[2], ... buffer[2*(fftSize-1)]; imaginary = 0.
 * Output: complex spectrum in same buffer (re, im interleaved).
 */
function fftInPlace(buffer: Float32Array, fftSize: number): void {
  const n = fftSize;
  if (n <= 1) return;

  // Bit-reversal permutation (log2(n) bits)
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

/**
 * Apply Blackman window to real samples in workBuffer (in-place).
 * workBuffer layout: [re0, im0, re1, im1, ...]; only re values are used for windowing.
 *
 * WebAudio AnalyserNode uses a Blackman window internally; using it offline improves
 * audio-reactive visual fidelity between preview and export.
 */
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

// AnalyserNode defaults: getByteFrequencyData returns dB mapped to 0–255 with this range
const ANALYSER_MIN_DB = -100;
const ANALYSER_MAX_DB = -30;
// Live playback uses AnalyserNode.smoothingTimeConstant = 0.8 (see AudioManager.loadAudioFile()).
// We approximate that internal smoothing stage offline so band values more closely match preview.
const ANALYSER_SMOOTHING_TIME_CONSTANT = 0.8;

// Canonical analysis timeline for export cache (Hz)
const EXPORT_ANALYSIS_RATE_HZ = 120;
const EXPORT_ANALYSIS_HOP_SECONDS = 1 / EXPORT_ANALYSIS_RATE_HZ;

// Reference cadence for defaults and analyser smoothing math.
const REFERENCE_FPS = 120;
const REFERENCE_DT_SECONDS = 1 / REFERENCE_FPS;
const DEFAULT_HALF_LIFE_SECONDS = 1 / REFERENCE_FPS;

function clampNumber(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function tauSecondsFromLegacyPrevRetention(prevRetention: number): number {
  if (prevRetention <= 0) return 0;
  if (prevRetention >= 1) return Number.POSITIVE_INFINITY;
  return -REFERENCE_DT_SECONDS / Math.log(prevRetention);
}

function tauSecondsFromHalfLifeSeconds(halfLifeSeconds: number): number {
  if (halfLifeSeconds <= 0) return 0;
  if (!Number.isFinite(halfLifeSeconds)) return Number.POSITIVE_INFINITY;
  return halfLifeSeconds / Math.LN2;
}

function prevRetentionFromTauSeconds(dtSeconds: number, tauSeconds: number): number {
  if (tauSeconds === Number.POSITIVE_INFINITY) return 1;
  if (tauSeconds <= 0) return 0;
  // exp(-dt/tau) gives the previous-retention coefficient for this dt.
  return Math.exp(-dtSeconds / tauSeconds);
}

export type AudioAnalysisChannelKind = 'band' | 'remap' | 'remapperOut';

export interface AudioAnalysisChannel {
  /** Unique key for debugging/invalidation (not used in hot sampling loop). */
  uniformKey: string;
  kind: AudioAnalysisChannelKind;
  /** Metadata (not used in hot sampling loop). */
  sourceId?: string;
  /** Direct uniform target. */
  nodeId: string;
  paramName: string;
  /** Optional index for band/remap channels (avoids parsing paramName). */
  index?: number;
  /** Optional clamp after interpolation. */
  min?: number;
  max?: number;
  /** Used when cache unavailable/out-of-range. */
  defaultValue?: number;
}

export interface AudioAnalysisCurveCache {
  startTimeSeconds: number;
  hopSeconds: number;
  frameCount: number;
  channels: AudioAnalysisChannel[];
  values: Float32Array;
}

/**
 * Compute linear magnitude spectrum (per-bin) from buffer at time t.
 *
 * WebAudio's AnalyserNode applies `smoothingTimeConstant` in the *linear magnitude domain* per bin
 * (before dB conversion / byte scaling). To match preview parity, we expose linear magnitudes here
 * so the provider can apply that smoothing in the correct domain.
 *
 * Uses a causal window of `fftSize` samples ending at sample index `floor(t * sampleRate)`,
 * matching the "most recent samples" model from WebAudio/Chromium.
 *
 * Mono: uses channel 0. Multi-channel: averages channels (approximates WebAudio mixdown).
 */
function computeLinearMagnitudeSpectrum(
  buffer: AudioBuffer,
  timeSeconds: number,
  sampleRate: number,
  fftSize: number,
  workBuffer: Float32Array,
  outMagnitudes: Float32Array
): void {
  const frequencyBinCount = fftSize / 2;
  const endSampleExclusive = Math.max(0, Math.floor(timeSeconds * sampleRate));
  const startSample = Math.max(0, endSampleExclusive - fftSize);
  const numberOfChannels = buffer.numberOfChannels;

  // Fill interleaved buffer: real = sample, im = 0; pad with zero if out of range
  for (let i = 0; i < fftSize; i++) {
    const srcIndex = startSample + i;
    if (srcIndex < 0) {
      workBuffer[i * 2] = 0;
    } else if (srcIndex >= buffer.length) {
      workBuffer[i * 2] = 0;
    } else if (numberOfChannels === 1) {
      workBuffer[i * 2] = buffer.getChannelData(0)[srcIndex] ?? 0;
    } else {
      let sum = 0;
      for (let ch = 0; ch < numberOfChannels; ch++) {
        sum += buffer.getChannelData(ch)[srcIndex] ?? 0;
      }
      workBuffer[i * 2] = sum / numberOfChannels;
    }
    workBuffer[i * 2 + 1] = 0;
  }

  // Blackman window to better match WebAudio AnalyserNode
  applyBlackmanWindow(workBuffer, fftSize);

  fftInPlace(workBuffer, fftSize);

  // WebAudio/Chromium magnitude scaling is effectively `abs(X[k]) / fftSize` (no coherent-gain compensation).
  for (let k = 0; k < frequencyBinCount; k++) {
    const re = workBuffer[k * 2];
    const im = workBuffer[k * 2 + 1];
    outMagnitudes[k] = Math.sqrt(re * re + im * im) / fftSize;
  }
}

/**
 * Extract band values from frequency data (same formula as FrequencyAnalyzer.extractFrequencyBands).
 */
function extractFrequencyBandsOffline(
  frequencyData: Uint8Array,
  frequencyBands: Array<{ minHz: number; maxHz: number }>,
  bandModes: AudioBandMode[],
  sampleRate: number,
  fftSize: number
): number[] {
  const bandValues: number[] = new Array(frequencyBands.length).fill(0);
  extractFrequencyBands01Into(frequencyData, frequencyBands, bandModes, sampleRate, fftSize, bandValues);
  return bandValues;
}

// --- OfflineAudioProvider ---

export class OfflineAudioProvider {
  private readonly buffer: AudioBuffer;
  private readonly config: OfflineAudioProviderConfig;
  /** Per-band smoothed values matching the app's per-band smoothing (second stage). */
  private readonly smoothedBandValues: Map<string, number[]> = new Map();
  /** Previous per-bin magnitudes for approximating AnalyserNode smoothingTimeConstant (first stage). */
  private readonly analyserSmoothedMagnitudes: Float32Array;
  /** Per-frame byte spectrum (post analyser smoothing, post dB conversion). */
  private readonly spectrumBytes: Uint8Array;
  /** Scratch per-frame per-bin magnitudes (pre analyser smoothing). */
  private readonly spectrumMagnitudes: Float32Array;
  /** FFT work buffer (reuse to avoid allocations) */
  private readonly fftWorkBuffer: Float32Array;
  /** Reused per-frame channel sample buffers (audio mux input). Sized to max samples per frame. */
  private readonly frameChannelSamples: Float32Array[];
  private readonly maxSamplesPerFrame: number;

  private analysisCache: AudioAnalysisCurveCache | null = null;
  private sampledValues: Float32Array | null = null;
  private cacheBuildPromise: Promise<void> | null = null;
  private cacheBuildGeneration: number = 0;

  private readonly analyzerConfigById: Map<string, AnalyzerConfig>;

  constructor(
    buffer: AudioBuffer,
    config: OfflineAudioProviderConfig
  ) {
    this.buffer = buffer;
    this.config = config;
    const maxFftSize = Math.max(4096, ...this.config.analyzerConfigs.map((a) => a.spectrumFftSize));
    this.fftWorkBuffer = new Float32Array(maxFftSize * 2);
    // Underlying export spectrum matches live analyser fftSize (4096). Keep fixed so we smooth the same bins.
    const spectrumFftSize = 4096;
    const spectrumBinCount = spectrumFftSize / 2;
    this.analyserSmoothedMagnitudes = new Float32Array(spectrumBinCount);
    this.spectrumMagnitudes = new Float32Array(spectrumBinCount);
    this.spectrumBytes = new Uint8Array(spectrumBinCount);
    // Use ceil so we can represent frames where rounding yields +1 sample.
    this.maxSamplesPerFrame = Math.ceil(config.sampleRate / config.frameRate);
    this.frameChannelSamples = Array.from(
      { length: buffer.numberOfChannels },
      () => new Float32Array(this.maxSamplesPerFrame)
    );

    this.analyzerConfigById = new Map(this.config.analyzerConfigs.map((a) => [a.nodeId, a]));
    const buildMode = this.config.cacheBuildMode ?? 'eager';
    if (buildMode === 'eager') {
      this.analysisCache = this.buildAnalysisCacheSync();
      this.sampledValues = new Float32Array(this.analysisCache.channels.length);
    } else {
      // Defer cache construction; caller can kick off async build.
      this.analysisCache = null;
      this.sampledValues = null;
    }
  }

  isCacheReady(): boolean {
    return this.analysisCache !== null;
  }

  startAsyncCacheBuild(): void {
    if (this.analysisCache) return;
    if (this.cacheBuildPromise) return;
    const gen = ++this.cacheBuildGeneration;
    this.cacheBuildPromise = this.buildAnalysisCacheAsync().finally(() => {
      // keep promise for inspection/debug if needed
      if (this.cacheBuildGeneration !== gen) return;
    });
  }

  private buildAnalysisCacheSync(): AudioAnalysisCurveCache {
    const { config, buffer } = this;
    const startTimeSeconds = config.startTimeSeconds ?? 0;
    const maxFrames = Math.max(1, config.maxFrames);
    const exportFps = config.frameRate;

    // Cache starts at the semantic clip boundary (startSeconds), not the first frame center.
    const cacheStartSeconds = startTimeSeconds;

    // Ensure there is always a canonical frame after the last video sample time for interpolation.
    const lastSampleTime = cacheStartSeconds + (maxFrames - 0.5) / exportFps;
    const frameCount = Math.ceil((lastSampleTime - cacheStartSeconds) / EXPORT_ANALYSIS_HOP_SECONDS) + 2;

    const channels = this.buildChannels();
    const channelCount = channels.length;
    const values = new Float32Array(frameCount * channelCount);

    // Warm-up window based on longest relevant smoothing tau (cap for practicality).
    const tauAnalyserSeconds = tauSecondsFromLegacyPrevRetention(ANALYSER_SMOOTHING_TIME_CONSTANT);
    let maxTauBandSeconds = 0;
    for (const a of config.analyzerConfigs) {
      const halfLives = a.smoothingHalfLifeSeconds;
      const bandCount = Math.max(a.frequencyBands.length, 1);
      for (let i = 0; i < bandCount; i++) {
        const attack = a.attackHalfLifeSeconds?.[i];
        const release = a.releaseHalfLifeSeconds?.[i];
        const symmetric = halfLives?.[i] ?? DEFAULT_HALF_LIFE_SECONDS;
        const tauAttack =
          attack != null ? tauSecondsFromHalfLifeSeconds(attack)
          : tauSecondsFromHalfLifeSeconds(symmetric);
        const tauRelease =
          release != null ? tauSecondsFromHalfLifeSeconds(release)
          : tauSecondsFromHalfLifeSeconds(symmetric);
        const tau = Math.max(tauAttack, tauRelease);
        if (Number.isFinite(tau) && tau > maxTauBandSeconds) maxTauBandSeconds = tau;
      }
    }
    const maxTauSeconds = Math.max(tauAnalyserSeconds, maxTauBandSeconds);
    const warmUpSeconds = clampNumber(5 * maxTauSeconds, 0.25, 3.0);

    const warmStartSeconds = Math.max(0, cacheStartSeconds - warmUpSeconds);

    // Advance analysis state from warmStartSeconds up to cacheStartSeconds (do not store warm-up values).
    // Use canonical hop steps and a final partial step if needed.
    let t = warmStartSeconds;
    // Initialize per-analyzer band smoothing state to 0 to match initial "cold" conditions.
    this.smoothedBandValues.clear();
    // Clear analyser smoothing state.
    this.analyserSmoothedMagnitudes.fill(0);

    const warmSteps = Math.max(0, Math.floor((cacheStartSeconds - warmStartSeconds) / EXPORT_ANALYSIS_HOP_SECONDS));
    for (let i = 0; i < warmSteps; i++) {
      t = warmStartSeconds + (i + 1) * EXPORT_ANALYSIS_HOP_SECONDS;
      this.stepAnalysisAt(buffer, t, EXPORT_ANALYSIS_HOP_SECONDS, tauAnalyserSeconds);
    }
    const remainingWarmDt = cacheStartSeconds - (warmStartSeconds + warmSteps * EXPORT_ANALYSIS_HOP_SECONDS);
    if (remainingWarmDt > 0) {
      t = cacheStartSeconds;
      this.stepAnalysisAt(buffer, t, remainingWarmDt, tauAnalyserSeconds);
    }

    // Build stored cache frames at exact 120 Hz grid starting at cacheStartSeconds.
    for (let k = 0; k < frameCount; k++) {
      const tk = cacheStartSeconds + k * EXPORT_ANALYSIS_HOP_SECONDS;
      const dt = k === 0 ? 0 : EXPORT_ANALYSIS_HOP_SECONDS;
      if (dt > 0) {
        this.stepAnalysisAt(buffer, tk, dt, tauAnalyserSeconds);
      } else {
        // For k=0, we still need to compute spectrum-derived values at tk, but do not advance smoothing state.
        // We do this by running analysis with dt=0 (retention=1).
        this.stepAnalysisAt(buffer, tk, 0, tauAnalyserSeconds);
      }
      this.writeCacheRow(values, k, channels);
    }

    return {
      startTimeSeconds: cacheStartSeconds,
      hopSeconds: EXPORT_ANALYSIS_HOP_SECONDS,
      frameCount,
      channels,
      values,
    };
  }

  private async buildAnalysisCacheAsync(): Promise<void> {
    const { config, buffer } = this;
    const startTimeSeconds = config.startTimeSeconds ?? 0;
    const maxFrames = Math.max(1, config.maxFrames);
    const exportFps = config.frameRate;
    const cacheStartSeconds = startTimeSeconds;
    const lastSampleTime = cacheStartSeconds + (maxFrames - 0.5) / exportFps;
    const frameCount = Math.ceil((lastSampleTime - cacheStartSeconds) / EXPORT_ANALYSIS_HOP_SECONDS) + 2;

    const channels = this.buildChannels();
    const channelCount = channels.length;
    const values = new Float32Array(frameCount * channelCount);

    const tauAnalyserSeconds = tauSecondsFromLegacyPrevRetention(ANALYSER_SMOOTHING_TIME_CONSTANT);
    let maxTauBandSeconds = 0;
    for (const a of config.analyzerConfigs) {
      const halfLives = a.smoothingHalfLifeSeconds;
      const bandCount = Math.max(a.frequencyBands.length, 1);
      for (let i = 0; i < bandCount; i++) {
        const attack = a.attackHalfLifeSeconds?.[i];
        const release = a.releaseHalfLifeSeconds?.[i];
        const symmetric = halfLives?.[i] ?? DEFAULT_HALF_LIFE_SECONDS;
        const tauAttack =
          attack != null ? tauSecondsFromHalfLifeSeconds(attack)
          : tauSecondsFromHalfLifeSeconds(symmetric);
        const tauRelease =
          release != null ? tauSecondsFromHalfLifeSeconds(release)
          : tauSecondsFromHalfLifeSeconds(symmetric);
        const tau = Math.max(tauAttack, tauRelease);
        if (Number.isFinite(tau) && tau > maxTauBandSeconds) maxTauBandSeconds = tau;
      }
    }
    const maxTauSeconds = Math.max(tauAnalyserSeconds, maxTauBandSeconds);
    const warmUpSeconds = clampNumber(5 * maxTauSeconds, 0.25, 3.0);
    const warmStartSeconds = Math.max(0, cacheStartSeconds - warmUpSeconds);

    this.smoothedBandValues.clear();
    this.analyserSmoothedMagnitudes.fill(0);

    const warmSteps = Math.max(0, Math.floor((cacheStartSeconds - warmStartSeconds) / EXPORT_ANALYSIS_HOP_SECONDS));
    for (let i = 0; i < warmSteps; i++) {
      const t = warmStartSeconds + (i + 1) * EXPORT_ANALYSIS_HOP_SECONDS;
      this.stepAnalysisAt(buffer, t, EXPORT_ANALYSIS_HOP_SECONDS, tauAnalyserSeconds);
      if (i % 200 === 0) {
        await new Promise<void>((r) => setTimeout(r, 0));
      }
    }
    const remainingWarmDt = cacheStartSeconds - (warmStartSeconds + warmSteps * EXPORT_ANALYSIS_HOP_SECONDS);
    if (remainingWarmDt > 0) {
      this.stepAnalysisAt(buffer, cacheStartSeconds, remainingWarmDt, tauAnalyserSeconds);
    }

    const yieldEvery = Math.max(1, config.cacheYieldEveryFrames ?? 240);
    for (let k = 0; k < frameCount; k++) {
      const tk = cacheStartSeconds + k * EXPORT_ANALYSIS_HOP_SECONDS;
      const dt = k === 0 ? 0 : EXPORT_ANALYSIS_HOP_SECONDS;
      this.stepAnalysisAt(buffer, tk, dt, tauAnalyserSeconds);
      this.writeCacheRow(values, k, channels);
      if (config.onCacheBuildProgress01) {
        config.onCacheBuildProgress01((k + 1) / frameCount);
      }
      if (k % yieldEvery === 0) {
        await new Promise<void>((r) => setTimeout(r, 0));
      }
    }

    this.analysisCache = {
      startTimeSeconds: cacheStartSeconds,
      hopSeconds: EXPORT_ANALYSIS_HOP_SECONDS,
      frameCount,
      channels,
      values,
    };
    this.sampledValues = new Float32Array(channels.length);
  }

  private buildChannels(): AudioAnalysisChannel[] {
    const { config } = this;
    const channels: AudioAnalysisChannel[] = [];

    // Analyzer band uniforms + band remap uniforms (post-remap).
    for (const analyzer of config.analyzerConfigs) {
      const bandCount = Math.max(analyzer.frequencyBands.length, 1);
      for (let i = 0; i < bandCount; i++) {
        const bandParamName = bandCount === 1 ? 'band' : `band${i}`;
        channels.push({
          uniformKey: `${analyzer.nodeId}.${bandParamName}`,
          kind: 'band',
          sourceId: config.primaryFileId,
          nodeId: analyzer.nodeId,
          paramName: bandParamName,
          index: i,
          min: 0,
          max: 1,
          defaultValue: 0,
        });
      }

      const remapCount = Math.max(analyzer.bandRemap.length, 1);
      for (let i = 0; i < remapCount; i++) {
        const remapParamName = remapCount === 1 ? 'remap' : `remap${i}`;
        channels.push({
          uniformKey: `${analyzer.nodeId}.${remapParamName}`,
          kind: 'remap',
          sourceId: config.primaryFileId,
          nodeId: analyzer.nodeId,
          paramName: remapParamName,
          index: i,
          min: 0,
          max: 1,
          defaultValue: 0,
        });
      }
    }

    // Remapper virtual nodes.
    for (const remap of config.remapperConfigs) {
      channels.push({
        uniformKey: `remap-${remap.id}.out`,
        kind: 'remapperOut',
        sourceId: config.primaryFileId,
        nodeId: `remap-${remap.id}`,
        paramName: 'out',
        min: 0,
        max: 1,
        defaultValue: 0,
      });
    }

    return channels;
  }

  private stepAnalysisAt(
    buffer: AudioBuffer,
    timeSeconds: number,
    dtSeconds: number,
    tauAnalyserSeconds: number
  ): void {
    const { config } = this;
    const sampleRate = config.sampleRate;

    // Compute analyser-like spectrum for this time.
    {
      const spectrumFftSize = 4096;
      const workBuf =
        spectrumFftSize <= this.fftWorkBuffer.length / 2
          ? this.fftWorkBuffer
          : new Float32Array(spectrumFftSize * 2);

      computeLinearMagnitudeSpectrum(
        buffer,
        timeSeconds,
        sampleRate,
        spectrumFftSize,
        workBuf,
        this.spectrumMagnitudes
      );

      const retention = prevRetentionFromTauSeconds(dtSeconds, tauAnalyserSeconds);
      for (let k = 0; k < this.spectrumMagnitudes.length; k++) {
        const cur = this.spectrumMagnitudes[k] ?? 0;
        const prev = this.analyserSmoothedMagnitudes[k] ?? 0;
        this.analyserSmoothedMagnitudes[k] = retention * prev + (1 - retention) * cur;
      }

      // dB conversion + byte scaling (matches getByteFrequencyData mapping)
      const dbRange = ANALYSER_MAX_DB - ANALYSER_MIN_DB;
      const minMagnitude = 1e-10; // avoid log(0)
      for (let k = 0; k < this.spectrumBytes.length; k++) {
        const mag = Math.max(minMagnitude, this.analyserSmoothedMagnitudes[k] ?? 0);
        const db = 20 * Math.log10(mag);
        const clampedDb = Math.max(ANALYSER_MIN_DB, Math.min(ANALYSER_MAX_DB, db));
        const byte = Math.round(255 * (clampedDb - ANALYSER_MIN_DB) / dbRange);
        this.spectrumBytes[k] = Math.max(0, Math.min(255, byte));
      }
    }

    // Band extraction and per-band smoothing (time-based).
    for (const analyzer of config.analyzerConfigs) {
      const { mappingFftSize, frequencyBands, bandModes } = analyzer;
      const bandValues = extractFrequencyBandsOffline(
        this.spectrumBytes,
        frequencyBands,
        bandModes,
        sampleRate,
        mappingFftSize
      );

      let smoothed = this.smoothedBandValues.get(analyzer.nodeId);
      if (!smoothed || smoothed.length !== bandValues.length) {
        smoothed = new Array(bandValues.length).fill(0);
        this.smoothedBandValues.set(analyzer.nodeId, smoothed);
      }

      for (let i = 0; i < bandValues.length; i++) {
        const cur = bandValues[i] ?? 0;
        const prev = smoothed[i] ?? 0;
        const useAttackRelease =
          analyzer.attackHalfLifeSeconds?.[i] != null || analyzer.releaseHalfLifeSeconds?.[i] != null;
        const rising = cur > prev;
        const halfLifeSeconds = useAttackRelease
          ? (rising ? analyzer.attackHalfLifeSeconds?.[i] : analyzer.releaseHalfLifeSeconds?.[i])
          : analyzer.smoothingHalfLifeSeconds?.[i];
        const fallbackHalfLifeSeconds = analyzer.smoothingHalfLifeSeconds?.[i] ?? DEFAULT_HALF_LIFE_SECONDS;
        const tauBandSeconds =
          tauSecondsFromHalfLifeSeconds(halfLifeSeconds ?? fallbackHalfLifeSeconds);
        const retention = prevRetentionFromTauSeconds(dtSeconds, tauBandSeconds);
        smoothed[i] = retention * prev + (1 - retention) * cur;
      }
    }

    // Remapper outputs depend on smoothed band values; cache write uses current state.
  }

  private writeCacheRow(values: Float32Array, frameIndex: number, channels: AudioAnalysisChannel[]): void {
    const base = frameIndex * channels.length;

    // Precompute lookups for this write.
    const analyzerSmoothedById = this.smoothedBandValues;

    for (let j = 0; j < channels.length; j++) {
      const ch = channels[j]!;
      let v = ch.defaultValue ?? 0;

      if (ch.kind === 'band' || ch.kind === 'remap') {
        const smoothedBands = analyzerSmoothedById.get(ch.nodeId);
        // band/remap live on analyzer nodeId; when missing, leave default.
        if (smoothedBands) {
          const bandIndex = ch.kind === 'band' ? (ch.index ?? 0) : (ch.index ?? 0);
          const bandValue = smoothedBands[bandIndex] ?? 0;

          if (ch.kind === 'band') {
            v = bandValue;
          } else {
            // remap: derive from analyzer config's remap parameters.
            const analyzer = this.analyzerConfigById.get(ch.nodeId);
            if (analyzer) {
              const remapIndex = ch.index ?? 0;
              const remapCfg = analyzer.bandRemap[remapIndex] ?? analyzer.bandRemap[0];
              if (remapCfg) {
                const { inMin, inMax, outMin, outMax } = remapCfg;
                const range = inMax - inMin;
                const normalized = range !== 0 ? (bandValue - inMin) / range : 0;
                const clamped = Math.max(0, Math.min(1, normalized));
                v = outMin + clamped * (outMax - outMin);
              }
            }
          }
        }
      } else if (ch.kind === 'remapperOut') {
        // remap-{id}.out: find remapper config, read its band's smoothed value, apply its remap.
        const remapperId = ch.nodeId.startsWith('remap-') ? ch.nodeId.slice('remap-'.length) : ch.nodeId;
        const remapCfg = this.config.remapperConfigs.find((r) => r.id === remapperId);
        if (remapCfg) {
          const bandRaw = analyzerSmoothedById.get(remapCfg.bandId)?.[0] ?? 0;
          const { inMin, inMax, outMin, outMax } = remapCfg;
          const range = inMax - inMin;
          const normalized = range !== 0 ? (bandRaw - inMin) / range : 0;
          const clamped = Math.max(0, Math.min(1, normalized));
          v = outMin + clamped * (outMax - outMin);
        }
      }

      if (ch.min !== undefined) v = Math.max(ch.min, v);
      if (ch.max !== undefined) v = Math.min(ch.max, v);
      values[base + j] = v;
    }
  }

  private sampleAnalysisAt(timeSeconds: number, outValues: Float32Array): void {
    const cache = this.analysisCache;
    if (!cache) {
      outValues.fill(0);
      return;
    }
    const channelCount = cache.channels.length;
    if (cache.frameCount < 2 || channelCount === 0) {
      for (let j = 0; j < channelCount; j++) outValues[j] = cache.channels[j]?.defaultValue ?? 0;
      return;
    }

    const x = (timeSeconds - cache.startTimeSeconds) / cache.hopSeconds;
    // Epsilon avoids boundary issues when x lands very close to an integer due to fp rounding.
    const i0 = clampNumber(Math.floor(x + 1e-9), 0, cache.frameCount - 2);
    const i1 = i0 + 1;
    const u = clampNumber(x - i0, 0, 1);
    const o0 = i0 * channelCount;
    const o1 = i1 * channelCount;

    for (let j = 0; j < channelCount; j++) {
      const a = cache.values[o0 + j]!;
      const b = cache.values[o1 + j]!;
      outValues[j] = a + (b - a) * u;
    }
  }

  /**
   * Sample canonical 120 Hz analysis cache at an arbitrary time (seconds) and return
   * final uniform-driving values (bands/remaps/remapper outs) as update objects.
   *
   * This is used by live preview (Phase 2) to sample by audio playback time.
   * Does not include file uniforms (currentTime/duration/isPlaying).
   */
  getUniformUpdatesAtTime(timeSeconds: number): UniformUpdate[] {
    const cache = this.analysisCache;
    const sampled = this.sampledValues;
    if (!cache || !sampled) return [];
    this.sampleAnalysisAt(timeSeconds, sampled);
    const channels = cache.channels;
    const updates: UniformUpdate[] = new Array(channels.length);
    for (let j = 0; j < channels.length; j++) {
      const ch = channels[j]!;
      let v = sampled[j] ?? (ch.defaultValue ?? 0);
      if (ch.min !== undefined) v = Math.max(ch.min, v);
      if (ch.max !== undefined) v = Math.min(ch.max, v);
      updates[j] = { nodeId: ch.nodeId, paramName: ch.paramName, value: v };
    }
    return updates;
  }

  /**
   * Get per-frame audio state for video export.
   * @param frameIndex - Zero-based frame index
   * @returns channelSamples (one Float32Array per channel for this frame) and uniformUpdates
   */
  getFrameState(frameIndex: number): FrameAudioState {
    const { buffer, config } = this;
    const sampleRate = config.sampleRate;
    const frameRate = config.frameRate;
    const startTimeSeconds = config.startTimeSeconds ?? 0;
    const startSampleOffset = Math.round(startTimeSeconds * sampleRate);
    // Compute exact integer sample bounds for this frame so audio stays sample-accurate
    // across the whole export (prevents drift from per-frame rounding).
    const startSample = startSampleOffset + Math.round(frameIndex * sampleRate / frameRate);
    const endSample = startSampleOffset + Math.round((frameIndex + 1) * sampleRate / frameRate);
    // Use frame-center time for analysis (closer to how rAF sampling feels in preview).
    // Keep muxed audio sample-accurate by still slicing [startSample, endSample) for channelSamples.
    const t = startTimeSeconds + (frameIndex + 0.5) / frameRate;
    const targetLength = Math.max(0, Math.min(this.maxSamplesPerFrame, endSample - startSample));

    const numberOfChannels = this.frameChannelSamples.length;
    for (let ch = 0; ch < numberOfChannels; ch++) {
      const channelData = buffer.getChannelData(ch);
      const out = this.frameChannelSamples[ch];
      for (let i = 0; i < targetLength; i++) {
        const srcIndex = startSample + i;
        out[i] = srcIndex >= 0 && srcIndex < channelData.length ? channelData[srcIndex] : 0;
      }
      // Ensure any leftover samples from previous frames don't leak into this frame.
      for (let i = targetLength; i < out.length; i++) out[i] = 0;
    }

    // Return per-frame views at the correct length (no extra padding).
    const channelSamples = this.frameChannelSamples.map((c) => c.subarray(0, targetLength));

    const uniformUpdates: UniformUpdate[] = [];

    // Primary file uniforms (fileId.currentTime, fileId.duration, fileId.isPlaying)
    uniformUpdates.push(
      { nodeId: config.primaryFileId, paramName: 'currentTime', value: t },
      { nodeId: config.primaryFileId, paramName: 'duration', value: buffer.duration },
      { nodeId: config.primaryFileId, paramName: 'isPlaying', value: 1 }
    );

    // Sample the canonical 120 Hz cache at the frame-center time.
    uniformUpdates.push(...this.getUniformUpdatesAtTime(t));

    return { channelSamples, uniformUpdates, timelineTime: t };
  }
}

// --- Factory: build provider from audioSetup ---

/**
 * Create OfflineAudioProvider from audioSetup, primary file id, and buffer.
 * Derives band and remapper configs from audioSetup.
 * Only includes bands whose sourceFileId matches the primary file.
 */
export function createOfflineAudioProvider(
  audioSetup: AudioSetup,
  primaryFileId: string,
  buffer: AudioBuffer,
  sampleRate: number,
  frameRate: number,
  startTimeSeconds: number = 0,
  maxFrames: number,
  options?: {
    cacheBuildMode?: 'eager' | 'async';
    cacheYieldEveryFrames?: number;
    onCacheBuildProgress01?: (progress01: number) => void;
  }
): OfflineAudioProvider {
  const { analyzerConfigs, remapperConfigs } = buildOfflineAudioAnalysisConfigs(audioSetup, primaryFileId);

  return new OfflineAudioProvider(buffer, {
    sampleRate,
    frameRate,
    primaryFileId,
    startTimeSeconds,
    maxFrames: Math.max(1, maxFrames),
    cacheBuildMode: options?.cacheBuildMode,
    cacheYieldEveryFrames: options?.cacheYieldEveryFrames,
    onCacheBuildProgress01: options?.onCacheBuildProgress01,
    analyzerConfigs,
    remapperConfigs,
  });
}

export function buildOfflineAudioAnalysisConfigs(
  audioSetup: AudioSetup,
  primaryFileId: string
): { analyzerConfigs: AnalyzerConfig[]; remapperConfigs: OfflineAudioProviderConfig['remapperConfigs'] } {
  const bandsForPrimary = audioSetup.bands.filter((b) => b.sourceFileId === primaryFileId);

  const analyzerConfigs: AnalyzerConfig[] = bandsForPrimary.map((band) => {
    const fb = band.frequencyBands[0];
    const frequencyBands: Array<{ minHz: number; maxHz: number }> = fb
      ? [{ minHz: Number(fb[0]), maxHz: Number(fb[1]) }]
      : [{ minHz: 20, maxHz: 20000 }];

    const bandModes: AudioBandMode[] = [band.bandMode ?? 'mean'];
    const attackHalfLifeSeconds = band.attackHalfLifeSeconds;
    const releaseHalfLifeSeconds = band.releaseHalfLifeSeconds;
    const smoothingHalfLifeSeconds =
      attackHalfLifeSeconds ??
      releaseHalfLifeSeconds ??
      band.smoothingHalfLifeSeconds ??
      DEFAULT_HALF_LIFE_SECONDS;
    const spectrumFftSize = 4096;
    const mappingFftSize = band.fftSize ?? 2048;

    const bandRemap: Array<{ inMin: number; inMax: number; outMin: number; outMax: number }> = [
      {
        inMin: band.remapInMin ?? 0,
        inMax: band.remapInMax ?? 1,
        outMin: band.remapOutMin ?? 0,
        outMax: band.remapOutMax ?? 1,
      },
    ];

    return {
      nodeId: band.id,
      frequencyBands,
      bandModes,
      smoothingHalfLifeSeconds: [smoothingHalfLifeSeconds],
      attackHalfLifeSeconds: attackHalfLifeSeconds != null ? [attackHalfLifeSeconds] : undefined,
      releaseHalfLifeSeconds: releaseHalfLifeSeconds != null ? [releaseHalfLifeSeconds] : undefined,
      spectrumFftSize,
      mappingFftSize,
      bandRemap,
    };
  });

  const remapperConfigs = audioSetup.remappers
    .filter((r) => bandsForPrimary.some((b) => b.id === r.bandId))
    .map((r) => ({
      id: r.id,
      bandId: r.bandId,
      inMin: r.inMin,
      inMax: r.inMax,
      outMin: r.outMin,
      outMax: r.outMax,
    }));

  return { analyzerConfigs, remapperConfigs };
}

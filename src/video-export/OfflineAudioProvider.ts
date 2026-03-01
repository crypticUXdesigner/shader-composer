/**
 * Offline Audio Provider - Per-frame audio state for video export
 *
 * Given the primary audio file's AudioBuffer, sample rate, frame rate, and audioSetup
 * (for band/remapper config), produces per-frame state: raw channel samples for
 * the export file and FFT-derived band values (and remapped values) for shader uniforms.
 * No dependency on live AudioManager or DOM.
 *
 * WP 15B: Reads from audioSetup instead of graph nodes.
 */

import type { AudioSetup } from '../data-model/audioSetupTypes';

// --- Types (API for 02B / 03) ---

export interface FrameAudioState {
  /** One Float32Array per channel; each length = samples per frame at sampleRate/frameRate */
  channelSamples: Float32Array[];
  /** Uniform updates: { nodeId, paramName, value } — apply via setAudioUniform / setParameters */
  uniformUpdates: Array<{ nodeId: string; paramName: string; value: number }>;
  /** Timeline currentTime for this frame (seconds). Used as uTimelineTime so automation stays in sync (WP 07). */
  timelineTime: number;
}

export interface UniformUpdate {
  nodeId: string;
  paramName: string;
  value: number;
}

/** Per-band config derived from audioSetup (WP 15B) */
export interface AnalyzerConfig {
  nodeId: string;
  frequencyBands: Array<{ minHz: number; maxHz: number }>;
  /** Per-band smoothing (0–1). Length matches band count. */
  smoothing: number[];
  fftSize: number;
  bandRemap: Array<{ inMin: number; inMax: number; outMin: number; outMax: number }>;
}

export interface OfflineAudioProviderConfig {
  sampleRate: number;
  frameRate: number;
  /** Primary file id (from audioSetup.files[0]) */
  primaryFileId: string;
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
 * Apply Hann window to real samples in workBuffer (in-place).
 * workBuffer layout: [re0, im0, re1, im1, ...]; only re values are used for windowing.
 */
function applyHannWindow(workBuffer: Float32Array, fftSize: number): void {
  if (fftSize <= 1) return;
  const nMinus1 = fftSize - 1;
  for (let i = 0; i < fftSize; i++) {
    const hann = 0.5 * (1 - Math.cos((TWO_PI * i) / nMinus1));
    workBuffer[i * 2] *= hann;
  }
}

// AnalyserNode defaults: getByteFrequencyData returns dB mapped to 0–255 with this range
const ANALYSER_MIN_DB = -100;
const ANALYSER_MAX_DB = -30;

/**
 * Compute frequency spectrum (0–255) from buffer at time t.
 * Uses a window of fftSize samples centered at sample index t * sampleRate.
 * Applies Hann window and outputs decibel-scaled bytes to match AnalyserNode.getByteFrequencyData(),
 * so export audio reactivity matches live (same 0–255 range and log scale).
 * Mono: uses channel 0. Multi-channel: uses channel 0.
 */
function computeMagnitudeSpectrum(
  buffer: AudioBuffer,
  timeSeconds: number,
  sampleRate: number,
  fftSize: number,
  workBuffer: Float32Array
): Uint8Array {
  const frequencyBinCount = fftSize / 2;
  const centerSample = timeSeconds * sampleRate;
  const startSample = Math.max(0, Math.floor(centerSample - fftSize / 2));
  const channelData = buffer.getChannelData(0);

  // Fill interleaved buffer: real = sample, im = 0; pad with zero if out of range
  for (let i = 0; i < fftSize; i++) {
    const srcIndex = startSample + i;
    workBuffer[i * 2] = srcIndex >= 0 && srcIndex < channelData.length ? channelData[srcIndex] : 0;
    workBuffer[i * 2 + 1] = 0;
  }

  // Hann window for spectral leakage; AnalyserNode uses Blackman but dB scaling matters more for reactivity
  applyHannWindow(workBuffer, fftSize);

  fftInPlace(workBuffer, fftSize);

  // Match AnalyserNode: magnitude → dB → byte 0–255 (same formula as getByteFrequencyData).
  // Normalize magnitude by fftSize, convert to dB, then map ANALYSER_MIN_DB..ANALYSER_MAX_DB → 0..255.
  const out = new Uint8Array(frequencyBinCount);
  const dbRange = ANALYSER_MAX_DB - ANALYSER_MIN_DB;
  const minMagnitude = 1e-10; // avoid log(0) = -Infinity
  for (let k = 0; k < frequencyBinCount; k++) {
    const re = workBuffer[k * 2];
    const im = workBuffer[k * 2 + 1];
    const magnitude = Math.sqrt(re * re + im * im) / fftSize;
    const db = 20 * Math.log10(Math.max(minMagnitude, magnitude));
    const clampedDb = Math.max(ANALYSER_MIN_DB, Math.min(ANALYSER_MAX_DB, db));
    const byte = Math.round(255 * (clampedDb - ANALYSER_MIN_DB) / dbRange);
    out[k] = Math.max(0, Math.min(255, byte));
  }
  return out;
}

/**
 * Extract band values from frequency data (same formula as FrequencyAnalyzer.extractFrequencyBands).
 */
function extractFrequencyBandsOffline(
  frequencyData: Uint8Array,
  frequencyBands: Array<{ minHz: number; maxHz: number }>,
  sampleRate: number,
  fftSize: number
): number[] {
  const bandValues: number[] = [];
  for (const band of frequencyBands) {
    const minBin = Math.floor((band.minHz / sampleRate) * fftSize);
    const maxBin = Math.ceil((band.maxHz / sampleRate) * fftSize);
    let sum = 0;
    let count = 0;
    for (let i = minBin; i <= maxBin && i < frequencyData.length; i++) {
      sum += frequencyData[i];
      count++;
    }
    const average = count > 0 ? sum / count : 0;
    const normalized = average / 255.0;
    bandValues.push(normalized);
  }
  return bandValues;
}

// --- OfflineAudioProvider ---

export class OfflineAudioProvider {
  private readonly buffer: AudioBuffer;
  private readonly config: OfflineAudioProviderConfig;
  /** Per-band smoothed band values (first stage, stateful across frames) */
  private readonly smoothedBandValues: Map<string, number[]> = new Map();
  /** Per-band double-smoothed band values (second stage, matches live AnalyserNode + app smoothing) */
  private readonly doubleSmoothedBandValues: Map<string, number[]> = new Map();
  /** FFT work buffer (reuse to avoid allocations) */
  private readonly fftWorkBuffer: Float32Array;

  constructor(
    buffer: AudioBuffer,
    config: OfflineAudioProviderConfig
  ) {
    this.buffer = buffer;
    this.config = config;
    const maxFftSize = Math.max(4096, ...this.config.analyzerConfigs.map((a) => a.fftSize));
    this.fftWorkBuffer = new Float32Array(maxFftSize * 2);
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
    const t = frameIndex / frameRate;
    const samplesPerFrame = sampleRate / frameRate;
    const startSample = Math.floor(t * sampleRate);
    const targetLength = Math.round(samplesPerFrame);

    const channelSamples: Float32Array[] = [];
    const numberOfChannels = buffer.numberOfChannels;
    for (let ch = 0; ch < numberOfChannels; ch++) {
      const channelData = buffer.getChannelData(ch);
      const frame = new Float32Array(targetLength);
      for (let i = 0; i < targetLength; i++) {
        const srcIndex = startSample + i;
        frame[i] = srcIndex >= 0 && srcIndex < channelData.length ? channelData[srcIndex] : 0;
      }
      channelSamples.push(frame);
    }

    const uniformUpdates: UniformUpdate[] = [];

    // Primary file uniforms (fileId.currentTime, fileId.duration, fileId.isPlaying)
    uniformUpdates.push(
      { nodeId: config.primaryFileId, paramName: 'currentTime', value: t },
      { nodeId: config.primaryFileId, paramName: 'duration', value: buffer.duration },
      { nodeId: config.primaryFileId, paramName: 'isPlaying', value: 1 }
    );

    // Band FFT and extraction (one FFT per band). Two smoothing stages to match live.
    for (const analyzer of config.analyzerConfigs) {
      const { fftSize, frequencyBands, smoothing, bandRemap } = analyzer;
      const workBuf = fftSize <= this.fftWorkBuffer.length / 2 ? this.fftWorkBuffer : new Float32Array(fftSize * 2);
      const frequencyData = computeMagnitudeSpectrum(
        buffer,
        t,
        sampleRate,
        fftSize,
        workBuf
      );
      const bandValues = extractFrequencyBandsOffline(
        frequencyData,
        frequencyBands,
        sampleRate,
        fftSize
      );

      let smoothed = this.smoothedBandValues.get(analyzer.nodeId);
      if (!smoothed || smoothed.length !== bandValues.length) {
        smoothed = bandValues.slice();
        this.smoothedBandValues.set(analyzer.nodeId, smoothed);
      }
      for (let i = 0; i < bandValues.length; i++) {
        const s = smoothing[i] ?? 0.8;
        smoothed[i] = s * bandValues[i] + (1 - s) * smoothed[i];
      }

      // Second smoothing stage to match live (AnalyserNode has internal smoothing + app smoothing)
      let doubleSmoothed = this.doubleSmoothedBandValues.get(analyzer.nodeId);
      if (!doubleSmoothed || doubleSmoothed.length !== smoothed.length) {
        doubleSmoothed = smoothed.slice();
        this.doubleSmoothedBandValues.set(analyzer.nodeId, doubleSmoothed);
      }
      for (let i = 0; i < smoothed.length; i++) {
        const s = smoothing[i] ?? 0.8;
        doubleSmoothed[i] = s * smoothed[i] + (1 - s) * (doubleSmoothed[i] ?? 0);
      }

      // Push band / band0, band1, ... (double-smoothed) to match live FrequencyAnalyzer naming
      const bandParamName = (i: number) => (doubleSmoothed.length === 1 ? 'band' : `band${i}`);
      for (let i = 0; i < doubleSmoothed.length; i++) {
        uniformUpdates.push({
          nodeId: analyzer.nodeId,
          paramName: bandParamName(i),
          value: doubleSmoothed[i] ?? 0,
        });
      }

      const remapParamName = (i: number) => (bandRemap.length === 1 ? 'remap' : `remap${i}`);
      for (let i = 0; i < bandRemap.length; i++) {
        const bandValue = doubleSmoothed[i] ?? 0;
        const { inMin, inMax, outMin, outMax } = bandRemap[i];
        const range = inMax - inMin;
        const normalized = range !== 0 ? (bandValue - inMin) / range : 0;
        const clamped = Math.max(0, Math.min(1, normalized));
        const remapped = outMin + clamped * (outMax - outMin);
        uniformUpdates.push({
          nodeId: analyzer.nodeId,
          paramName: remapParamName(i),
          value: remapped,
        });
      }
    }

    // Remapper outputs (remap-{id}.out): each remapper takes its band's raw value and remaps
    const bandRawValues = new Map<string, number>();
    for (const analyzer of config.analyzerConfigs) {
      const raw = this.doubleSmoothedBandValues.get(analyzer.nodeId)?.[0] ?? 0;
      bandRawValues.set(analyzer.nodeId, raw);
    }
    for (const remap of config.remapperConfigs) {
      const bandRaw = bandRawValues.get(remap.bandId) ?? 0;
      const { inMin, inMax, outMin, outMax } = remap;
      const range = inMax - inMin;
      const normalized = range !== 0 ? (bandRaw - inMin) / range : 0;
      const clamped = Math.max(0, Math.min(1, normalized));
      const remapped = outMin + clamped * (outMax - outMin);
      uniformUpdates.push({
        nodeId: `remap-${remap.id}`,
        paramName: 'out',
        value: remapped,
      });
    }

    return { channelSamples, uniformUpdates, timelineTime: t };
  }
}

// --- Factory: build provider from audioSetup (WP 15B) ---

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
  frameRate: number
): OfflineAudioProvider {
  const bandsForPrimary = audioSetup.bands.filter((b) => b.sourceFileId === primaryFileId);

  const analyzerConfigs: AnalyzerConfig[] = bandsForPrimary.map((band) => {
    const fb = band.frequencyBands[0];
    const frequencyBands: Array<{ minHz: number; maxHz: number }> = fb
      ? [{ minHz: Number(fb[0]), maxHz: Number(fb[1]) }]
      : [{ minHz: 20, maxHz: 20000 }];

    const smoothing = band.smoothing ?? 0.8;
    const fftSize = band.fftSize ?? 4096;

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
      smoothing: [smoothing],
      fftSize,
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

  return new OfflineAudioProvider(buffer, {
    sampleRate,
    frameRate,
    primaryFileId,
    analyzerConfigs,
    remapperConfigs,
  });
}

/**
 * AudioManager - Web Audio API Integration
 * 
 * Orchestrates audio file loading, playback, and frequency analysis.
 * Provides real-time audio data to shader uniforms.
 * 
 * Audio is driven by audioSetup only (files, bands, remappers).
 * 
 * This class uses composition with specialized components:
 * - AudioContextManager: Context lifecycle management
 * - AudioLoader: File/URL loading and decoding
 * - AudioPlaybackController: Playback control
 * - FrequencyAnalyzer: Frequency analysis
 */

import type { NodeGraph } from '../data-model/types';
import type { AudioSetup } from '../data-model/audioSetupTypes';
import { getVirtualNodeLiveValue as getVirtualNodeLiveValueImpl, getPanelBandLiveValues as getPanelBandLiveValuesImpl } from './audio/audioLiveValues';
import { findOrphanedNodes } from './audio/orphanCleanup';
import { syncPanelAnalyzers } from './audio/panelAnalyzerSync';
import type { ErrorHandler } from '../utils/errorHandling';
import type { Disposable } from '../utils/Disposable';
import { AudioContextManager } from './audio/AudioContextManager';
import { AudioLoader } from './audio/AudioLoader';
import { AudioPlaybackController, type AudioNodeState } from './audio/AudioPlaybackController';
import { FrequencyAnalyzer, type FrequencyBand, type AnalyzerNodeState } from './audio/FrequencyAnalyzer';
import { collectAudioUniformUpdates } from './audio/audioUniformUpdates';
import { audioAnalysisStatusStore } from '../lib/stores/audioAnalysisStatusStore';
import { AudioAnalysisCurveSampler } from './audio-analysis/AudioAnalysisCurveSampler';
import type {
  AudioAnalysisWorkerBandResult,
  AudioAnalysisWorkerCanceled,
  AudioAnalysisWorkerError,
  AudioAnalysisWorkerProgress,
  AudioAnalysisWorkerResult,
} from './audio-analysis/audioAnalysisWorkerTypes';
import {
  bandAnalysisDigest,
  bandIdsWithAnalysisChange,
  classifyAudioSetupChange,
  fileIdsWithBandsFromSetup,
  type AudioInvalidationTier,
} from './audio-analysis/audioAnalysisInvalidation';
import {
  isRemapperTopologyOnlyStructuralChange,
  reshapeCurveCacheTopology,
} from './audio-analysis/audioAnalysisStructuralPatch';
import {
  extractBandSmoothedSeriesFromCache,
  patchBandAndRemapChannelsFromBandSeries,
  patchRemapperChannelsFromBandCache,
} from './audio-analysis/audioAnalysisRemapperPatch';
import type { AudioAnalysisCurveCache } from './audio-analysis/AudioAnalysisCurveSampler';
import { buildOfflineAudioAnalysisConfigs } from '../video-export/OfflineAudioProvider';
import { normalizeUrlForAudioDedupe } from '../utils/normalizeUrlForAudioDedupe';

// Re-export types for backward compatibility
export type { FrequencyBand, AudioNodeState, AnalyzerNodeState };

export class AudioManager implements Disposable {
  private contextManager: AudioContextManager;
  private loader: AudioLoader;
  private playbackController: AudioPlaybackController;
  private frequencyAnalyzer: FrequencyAnalyzer;
  
  private cleanupInterval: number | null = null; // Periodic cleanup interval ID

  /** Coalesce overlapping `loadAudioFile` calls (same node + same source); avoids redundant fetch/decode/UI sync. */
  private loadAudioFileInflightByKey = new Map<string, Promise<void>>();
  
  /** Current audio setup from panel (for analyzer sync and uniform updates) */
  private audioSetup: AudioSetup | null = null;

  /** Stable identity for overlapping load detection (URLs normalized; Files by name/size/mtime). */
  private static loadAudioFileDedupeKey(nodeId: string, file: File | string): string {
    if (file instanceof File) {
      return `${nodeId}\0file:${file.name}\0${String(file.size)}\0${String(file.lastModified ?? 0)}`;
    }
    return `${nodeId}\0url:${normalizeUrlForAudioDedupe(file)}`;
  }

  private curveSamplersByFileId: Map<string, AudioAnalysisCurveSampler> = new Map();
  /** Per-band smoothed series (index 0) retained after worker build for Tier A remapper patch. */
  private bandSmoothedSeriesByFileId: Map<string, Map<string, Float32Array>> = new Map();
  /** Last setup that produced ready curve samplers (for per-file invalidation classification). */
  private lastOfflineAudioSetup: AudioSetup | null = null;
  private offlineBuildGeneration: number = 0;
  /** RAF id when a debounced offline rebuild is scheduled (coalesces rapid setAudioSetup / load bursts). */
  private offlineRebuildRafId: number | null = null;
  /** Fingerprint passed to startWorkerBuildForFiles until it finishes or is superseded. */
  private offlineRebuildTargetFingerprint: string | null = null;
  /** Last fingerprint that successfully produced curve samplers for all required files. */
  private offlineAnalysisFingerprintReady: string | null = null;
  private analysisWorker: Worker | null = null;
  /** Serializes offline worker builds so `worker.onmessage` and `pending` map are never contested by overlapping flights. */
  private audioWorkerBuildChain: Promise<void> = Promise.resolve();
  private activeWorkerBuildKeys: string[] = [];
  /** Tier B: retained curve cache while sampler cleared for live fallback during band rebuild. */
  private tierBPatchCacheByFileId: Map<string, AudioAnalysisCurveCache> = new Map();
  private tierBDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private tierBBuildingToastTimer: ReturnType<typeof setTimeout> | null = null;
  private tierBPendingBandIdsByFileId: Map<string, string[]> = new Map();
  private tierBPendingFingerprint: string | null = null;
  private tierCDDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private tierCDBuildingToastTimer: ReturnType<typeof setTimeout> | null = null;
  private tierCDPendingFileIds: string[] = [];
  private tierCDPendingFingerprint: string | null = null;
  private static readonly TIER_B_DEBOUNCE_MS = 120;
  private static readonly TIER_B_TOAST_DELAY_MS = 200;
  private static readonly TIER_CD_DEBOUNCE_MS = 120;
  
  private previousUniformValues: Map<string, number> = new Map();
  private readonly VALUE_CHANGE_THRESHOLD = 0.001; // Only update if change > 0.1%
  
  constructor(errorHandler?: ErrorHandler) {
    
    this.contextManager = new AudioContextManager(errorHandler);
    this.loader = new AudioLoader(this.contextManager, errorHandler);
    this.playbackController = new AudioPlaybackController(this.contextManager, errorHandler);
    this.frequencyAnalyzer = new FrequencyAnalyzer(this.contextManager, errorHandler);
  }
  
  /**
   * Initialize AudioContext (must be called from user interaction)
   * Note: Does not automatically resume - call resume() after user interaction
   */
  async initialize(): Promise<void> {
    await this.contextManager.initialize();
  }
  
  /**
   * Resume AudioContext (must be called after user interaction)
   */
  async resume(): Promise<void> {
    await this.contextManager.resume();
  }
  
  /**
   * Set audio setup from panel. Syncs analyzers: creates one per band when source file is loaded,
   * removes analyzers for bands no longer in setup.
   */
  setAudioSetup(audioSetup: AudioSetup | null): void {
    this.audioSetup = audioSetup ?? null;
    syncPanelAnalyzers(audioSetup, this.frequencyAnalyzer, this.playbackController);
    this.scheduleOfflineProvidersRebuild();
  }

  /**
   * Load audio file for a node (from File object or URL string)
   */
  async loadAudioFile(nodeId: string, file: File | string, options?: { reportLoadFailure?: boolean }): Promise<void> {
    const key = AudioManager.loadAudioFileDedupeKey(nodeId, file);
    const inflight = this.loadAudioFileInflightByKey.get(key);
    if (inflight) {
      return inflight;
    }

    const promise = this.runLoadAudioFile(nodeId, file, options).finally(() => {
      if (this.loadAudioFileInflightByKey.get(key) === promise) {
        this.loadAudioFileInflightByKey.delete(key);
      }
    });
    this.loadAudioFileInflightByKey.set(key, promise);
    return promise;
  }

  private async runLoadAudioFile(
    nodeId: string,
    file: File | string,
    options?: { reportLoadFailure?: boolean }
  ): Promise<void> {
    // Stop existing playback before loading new file
    this.stopAudio(nodeId);

    // Load and decode audio file
    const audioBuffer = await this.loader.loadAudioFile(nodeId, file, options);

    // Get audio context and create nodes
    const audioContext = this.contextManager.getContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 4096; // Good resolution for frequency analysis
    // Phase 2: prefer deterministic file-backed analysis curves; avoid opaque analyser smoothing.
    analyser.smoothingTimeConstant = 0;

    const gain = audioContext.createGain();
    gain.gain.value = 1.0;

    // Create audio node state
    this.playbackController.createAudioNodeState(nodeId, audioBuffer, analyser, gain);
    // Panel analyzers are usually (re)synced via setAudioSetup, but uploads can finish after the last sync.
    // Recreate FFT analyzers as soon as a source has an analyser so virtual-node/live spawn paths stay fed.
    syncPanelAnalyzers(this.audioSetup, this.frequencyAnalyzer, this.playbackController);
    this.scheduleOfflineProvidersRebuild();
  }
  
  /**
   * Play audio for a node.
   * Automatically resumes AudioContext if suspended (requires user interaction).
   * @param options - loop (default true); onEnded when loop is false (e.g. playlist advance)
   */
  async playAudio(
    nodeId: string,
    offset: number = 0,
    options?: { loop?: boolean; onEnded?: () => void }
  ): Promise<void> {
    await this.playbackController.playAudio(nodeId, offset, options);
  }
  
  /**
   * Stop audio playback
   */
  stopAudio(nodeId: string): void {
    this.playbackController.stopAudio(nodeId);
    // Clear previous values when audio stops
    this.clearPreviousValues(nodeId);
  }
  
  /**
   * Pause audio playback
   */
  pauseAudio(nodeId: string): void {
    this.playbackController.pauseAudio(nodeId);
    // Clear previous values when audio pauses
    this.clearPreviousValues(nodeId);
  }

  /**
   * Pause all audio nodes (preserves currentTime for resume).
   */
  pauseAllAudio(): void {
    const audioNodeStates = this.playbackController.getAllAudioNodeStates();
    for (const nodeId of audioNodeStates.keys()) {
      this.pauseAudio(nodeId);
    }
  }
  
  /**
   * Create analyzer node
   */
  createAnalyzer(
    nodeId: string,
    audioFileNodeId: string,
    frequencyBands: FrequencyBand[],
    smoothingHalfLifeSeconds: number[],
    attackHalfLifeSeconds: Array<number | undefined> | undefined,
    releaseHalfLifeSeconds: Array<number | undefined> | undefined,
    fftSize: number = 4096
  ): void {
    const audioState = this.playbackController.getAudioNodeState(audioFileNodeId);
    if (!audioState) {
      throw new Error(`Audio file node ${audioFileNodeId} not found or not initialized`);
    }
    
    this.frequencyAnalyzer.createAnalyzer(
      nodeId,
      audioFileNodeId,
      frequencyBands,
      undefined,
      smoothingHalfLifeSeconds,
      attackHalfLifeSeconds,
      releaseHalfLifeSeconds,
      fftSize,
      audioState
    );
  }
  
  /**
   * Update all audio uniforms (called each frame)
   * Only updates uniforms when values actually change (optimized)
   * @param forcePushAll - When true, push every uniform (e.g. for a new shader instance); ignores change threshold.
   */
  updateUniforms(
    setUniform: (nodeId: string, paramName: string, value: number) => void,
    setUniforms: (updates: Array<{ nodeId: string, paramName: string, value: number }>) => void,
    graph?: {
      nodes: Array<{ id: string; type: string; parameters: Record<string, unknown> }>;
      connections: Array<{ sourceNodeId: string; targetNodeId: string; targetPort?: string }>;
    } | null,
    forcePushAll?: boolean
  ): void {
    // Phase 2 live: if we have file-backed offline providers, prefer them over analyser-driven updates
    // so audio reactivity is stable across monitor refresh and matches export semantics.
    const offlineUniforms = this.curveSamplersByFileId.size > 0 ? this.curveSamplersByFileId : undefined;
    const updates = collectAudioUniformUpdates(
      this.playbackController,
      this.frequencyAnalyzer,
      this.audioSetup,
      this.previousUniformValues,
      this.VALUE_CHANGE_THRESHOLD,
      graph ?? null,
      forcePushAll ?? false,
      offlineUniforms
    );
    // Update status chip state opportunistically.
    const setup = this.audioSetup;
    if (setup) {
      const fileIdsWithBands = fileIdsWithBandsFromSetup(setup);
      const audioNodeStates = this.playbackController.getAllAudioNodeStates();
      const loadedWithBands = [...fileIdsWithBands].filter((id) => audioNodeStates.get(id)?.audioBuffer != null);
      if (loadedWithBands.length > 0) {
        const allReady = loadedWithBands.every((id) => this.curveSamplersByFileId.has(id));
        if (allReady) {
          audioAnalysisStatusStore.set({ state: 'ready' });
        } else {
          audioAnalysisStatusStore.update((s) =>
            s.state === 'building' ? s : { state: 'fallback', label: 'Live preview until analysis finishes' }
          );
        }
      }
    }
    if (updates.length > 0) {
      if (updates.length === 1) {
        setUniform(updates[0].nodeId, updates[0].paramName, updates[0].value);
      } else {
        setUniforms(updates);
      }
    }
  }

  private scheduleOfflineProvidersRebuild(): void {
    if (typeof window === 'undefined') {
      this.runOfflineProvidersRebuild();
      return;
    }
    if (this.offlineRebuildRafId != null) return;
    this.offlineRebuildRafId = window.requestAnimationFrame(() => {
      this.offlineRebuildRafId = null;
      this.runOfflineProvidersRebuild();
    });
  }

  /** Bands + remappers + loaded buffer fingerprints — skipped rebuild when unchanged and curves already built. */
  private computeOfflineAnalysisFingerprintForSetup(
    setup: AudioSetup,
    audioNodeStates: Map<string, { audioBuffer: AudioBuffer | null }>,
    fileIdsWithBands: Iterable<string>
  ): string {
    const bandDigest = JSON.stringify({ bands: setup.bands, remappers: setup.remappers ?? [] });
    const ids = [...fileIdsWithBands].sort();
    const fileParts = ids.map((fileId) => {
      const buf = audioNodeStates.get(fileId)?.audioBuffer ?? null;
      if (!buf) return `${fileId}:missing`;
      return `${fileId}:${buf.sampleRate}:${buf.duration}:${buf.length}:${buf.numberOfChannels}`;
    });
    return `${bandDigest}|${fileParts.join(';')}`;
  }

  private runOfflineProvidersRebuild(): void {
    const setup = this.audioSetup;
    if (!setup) {
      this.cancelPendingOfflineRebuildSchedule();
      this.curveSamplersByFileId.clear();
      this.bandSmoothedSeriesByFileId.clear();
      this.lastOfflineAudioSetup = null;
      this.offlineAnalysisFingerprintReady = null;
      this.offlineRebuildTargetFingerprint = null;
      audioAnalysisStatusStore.set({ state: 'idle' });
      return;
    }

    // Build providers only for file-backed sources that are loaded and referenced by bands.
    const fileIdsWithBands = fileIdsWithBandsFromSetup(setup);
    if (fileIdsWithBands.size === 0) {
      this.cancelPendingOfflineRebuildSchedule();
      this.curveSamplersByFileId.clear();
      this.bandSmoothedSeriesByFileId.clear();
      this.lastOfflineAudioSetup = null;
      this.offlineAnalysisFingerprintReady = null;
      this.offlineRebuildTargetFingerprint = null;
      audioAnalysisStatusStore.set({ state: 'idle' });
      return;
    }
    const audioNodeStates = this.playbackController.getAllAudioNodeStates();
    const loadedIds = [...fileIdsWithBands].filter((id) => audioNodeStates.get(id)?.audioBuffer != null);
    const fingerprint = this.computeOfflineAnalysisFingerprintForSetup(setup, audioNodeStates, fileIdsWithBands);

    if (loadedIds.length === 0) {
      this.curveSamplersByFileId.clear();
      this.bandSmoothedSeriesByFileId.clear();
      this.lastOfflineAudioSetup = null;
      this.offlineAnalysisFingerprintReady = null;
      this.offlineRebuildTargetFingerprint = null;
      audioAnalysisStatusStore.set({ state: 'idle' });
      return;
    }

    if (this.tryTierARemapperPatch(setup, loadedIds, audioNodeStates, fingerprint)) {
      return;
    }

    if (this.tryScheduleTierBBandRebuild(setup, loadedIds, audioNodeStates, fingerprint)) {
      return;
    }

    if (this.tryTierCRemapperTopologyPatch(setup, loadedIds, audioNodeStates, fingerprint)) {
      return;
    }

    if (this.tryScheduleTierCDFileRebuild(setup, loadedIds, audioNodeStates, fingerprint)) {
      return;
    }

    this.pruneStaleFileCaches(loadedIds);

    // Curves already match this setup + buffers — do not clear samplers or restart the worker.
    if (
      fingerprint === this.offlineAnalysisFingerprintReady &&
      loadedIds.every((id) => this.curveSamplersByFileId.has(id)) &&
      this.curveSamplersByFileId.size === loadedIds.length
    ) {
      return;
    }
    // A build for this exact fingerprint is already in flight (prevents hundreds of overlapping PCM copies).
    if (fingerprint === this.offlineRebuildTargetFingerprint) {
      return;
    }

    this.cancelTierBDebounce();
    this.clearTierBBuildingToastTimer();
    this.cancelTierCDDebounce();
    this.clearTierCDBuildingToastTimer();
    this.tierBPatchCacheByFileId.clear();
    this.tierBPendingBandIdsByFileId.clear();
    this.tierBPendingFingerprint = null;
    this.tierCDPendingFileIds = [];
    this.tierCDPendingFingerprint = null;

    const filesNeedingBuild = loadedIds.filter(
      (id) => !this.curveSamplersByFileId.has(id) || fingerprint !== this.offlineAnalysisFingerprintReady
    );
    if (filesNeedingBuild.length === 0) {
      return;
    }

    this.scheduleFullFileBuilds(filesNeedingBuild, fingerprint);
  }

  private pruneStaleFileCaches(loadedIds: string[]): void {
    const loaded = new Set(loadedIds);
    for (const fileId of this.curveSamplersByFileId.keys()) {
      if (!loaded.has(fileId)) {
        this.curveSamplersByFileId.delete(fileId);
        this.bandSmoothedSeriesByFileId.delete(fileId);
        this.tierBPatchCacheByFileId.delete(fileId);
      }
    }
  }

  private scheduleFullFileBuilds(fileIds: string[], fingerprint: string): void {
    if (fileIds.length === 0) return;

    this.cancelTierBDebounce();
    this.clearTierBBuildingToastTimer();
    this.cancelTierCDDebounce();
    this.clearTierCDBuildingToastTimer();
    this.tierBPatchCacheByFileId.clear();
    this.tierBPendingBandIdsByFileId.clear();
    this.tierBPendingFingerprint = null;
    this.tierCDPendingFileIds = [];
    this.tierCDPendingFingerprint = null;

    const buildGen = ++this.offlineBuildGeneration;
    for (const fileId of fileIds) {
      this.curveSamplersByFileId.delete(fileId);
      this.bandSmoothedSeriesByFileId.delete(fileId);
      this.tierBPatchCacheByFileId.delete(fileId);
    }
    this.offlineAnalysisFingerprintReady = null;
    this.offlineRebuildTargetFingerprint = fingerprint;
    audioAnalysisStatusStore.set({ state: 'building', progress01: 0, label: 'Getting audio ready' });

    const genAtQueue = buildGen;
    const fingerprintAtQueue = fingerprint;
    const fileIdsAtQueue = [...fileIds];
    this.audioWorkerBuildChain = this.audioWorkerBuildChain
      .catch(() => undefined)
      .then(() => this.runWorkerFullBuildForFileIds(genAtQueue, fingerprintAtQueue, fileIdsAtQueue))
      .catch((err) => {
        if (this.offlineBuildGeneration !== genAtQueue) return;
        if (this.offlineRebuildTargetFingerprint === fingerprintAtQueue) {
          this.offlineRebuildTargetFingerprint = null;
        }
        audioAnalysisStatusStore.set({ state: 'failed', label: err instanceof Error ? err.message : String(err) });
      });
  }

  private cancelPendingOfflineRebuildSchedule(): void {
    if (this.offlineRebuildRafId != null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.offlineRebuildRafId);
      this.offlineRebuildRafId = null;
    }
  }

  private async runWorkerFullBuildForFileIds(
    buildGen: number,
    targetFingerprint: string,
    fileIds: string[],
    options?: { deferReadyCommit?: boolean; allowProgress?: () => boolean }
  ): Promise<void> {
    if (fileIds.length === 0) return;

    if (this.analysisWorker == null) {
      const { default: WorkerConstructor } = await import('./audio-analysis/audioAnalysisWorker.ts?worker');
      this.analysisWorker = new WorkerConstructor();
    }

    const worker = this.analysisWorker;

    // Cancel any in-flight worker builds from previous generations.
    for (const key of this.activeWorkerBuildKeys) {
      const [buildId, fileId] = key.split('::');
      if (buildId && fileId) worker.postMessage({ type: 'cancel', buildId, fileId });
    }
    this.activeWorkerBuildKeys = [];
    const totalFiles = Math.max(1, fileIds.length);
    const fileIndexById = new Map<string, number>(fileIds.map((id, i) => [id, i]));

    // Resolve gates per file build so we can sequence cleanly.
    const pending = new Map<string, { resolve: () => void; reject: (e: Error) => void; lastProgress01: number }>();
    const removeActiveKey = (key: string) => {
      const idx = this.activeWorkerBuildKeys.indexOf(key);
      if (idx >= 0) this.activeWorkerBuildKeys.splice(idx, 1);
    };

    const failAllPending = (err: Error) => {
      for (const [key, p] of pending) {
        p.reject(err);
        removeActiveKey(key);
      }
      pending.clear();
    };

    worker.onmessage = (
      ev: MessageEvent<
        | AudioAnalysisWorkerProgress
        | AudioAnalysisWorkerResult
        | AudioAnalysisWorkerBandResult
        | AudioAnalysisWorkerError
        | AudioAnalysisWorkerCanceled
      >
    ) => {
      const msg = ev.data;
      const isCurrentGen = this.offlineBuildGeneration === buildGen;

      if (msg.type === 'progress') {
        if (!isCurrentGen) return;
        if (options?.allowProgress && !options.allowProgress()) return;
        const key = `${msg.buildId}::${msg.fileId}`;
        const p = pending.get(key);
        if (!p) return;
        p.lastProgress01 = msg.progress01;
        const fileIndex = fileIndexById.get(msg.fileId) ?? 0;
        const overall = (Math.max(0, fileIndex) + msg.progress01) / totalFiles;
        audioAnalysisStatusStore.set({ state: 'building', progress01: overall, label: 'Getting audio ready' });
        return;
      }

      if (msg.type === 'error') {
        const key = `${msg.buildId}::${msg.fileId}`;
        const p = pending.get(key);
        if (!p) return;
        p.reject(new Error(msg.message));
        pending.delete(key);
        removeActiveKey(key);
        return;
      }

      if (msg.type === 'canceled') {
        const key = `${msg.buildId}::${msg.fileId}`;
        const p = pending.get(key);
        if (!p) return;
        p.resolve();
        pending.delete(key);
        removeActiveKey(key);
        return;
      }

      if (msg.type === 'result') {
        const key = `${msg.buildId}::${msg.fileId}`;
        const p = pending.get(key);
        if (!p) return;
        if (isCurrentGen) {
          this.curveSamplersByFileId.set(msg.fileId, new AudioAnalysisCurveSampler(msg.cache));
          this.bandSmoothedSeriesByFileId.set(
            msg.fileId,
            extractBandSmoothedSeriesFromCache(msg.cache)
          );
          this.tierBPatchCacheByFileId.delete(msg.fileId);
        }
        p.resolve();
        pending.delete(key);
        removeActiveKey(key);
      }

      if (msg.type === 'bandResult') {
        const key = `${msg.buildId}::${msg.fileId}`;
        const p = pending.get(key);
        if (!p) return;
        if (isCurrentGen) {
          this.commitTierBBandResult(msg);
        }
        p.resolve();
        pending.delete(key);
        removeActiveKey(key);
      }
    };

    // Surface worker-level errors (syntax errors, OOM, etc.) as failed status and unblock awaits.
    worker.onerror = (e: ErrorEvent) => {
      const err = e?.message ? new Error(e.message) : new Error('Audio analysis worker error');
      // Always unblock the current sequence so we don't hang. Only show failed UI for the active generation.
      failAllPending(err);
      if (this.offlineBuildGeneration === buildGen) {
        if (this.offlineRebuildTargetFingerprint === targetFingerprint) {
          this.offlineRebuildTargetFingerprint = null;
        }
        audioAnalysisStatusStore.set({ state: 'failed', label: err.message });
      }
    };

    // Build each file sequentially (keeps memory bounded).
    for (let idx = 0; idx < fileIds.length; idx++) {
      const fileId = fileIds[idx]!;
      if (this.offlineBuildGeneration !== buildGen) return;

      const state = this.playbackController.getAudioNodeState(fileId);
      const buffer = state?.audioBuffer;
      if (!buffer) continue;

      const buildId = `analysis-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const key = `${buildId}::${fileId}`;
      this.activeWorkerBuildKeys.push(key);

      const gate = new Promise<void>((resolve, reject) => {
        pending.set(key, { resolve, reject, lastProgress01: 0 });
      });

      // Copy PCM so we can transfer without detaching AudioBuffer's underlying storage.
      const pcmChannels: Float32Array[] = [];
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const src = buffer.getChannelData(ch);
        const copy = new Float32Array(src.length);
        copy.set(src);
        pcmChannels.push(copy);
      }

      const transferables = pcmChannels.map((a) => a.buffer);
      const hopHz = 120;
      const frameRateForDuration = 120;
      const maxFrames = Math.ceil(buffer.duration * frameRateForDuration) + 2;
      const { analyzerConfigs, remapperConfigs } = buildOfflineAudioAnalysisConfigs(this.audioSetup!, fileId);

      worker.postMessage(
        {
          type: 'build',
          buildId,
          fileId,
          sampleRate: buffer.sampleRate,
          startTimeSeconds: 0,
          hopHz,
          frameRateForDuration,
          maxFrames,
          pcmChannels,
          analyzerConfigs,
          remapperConfigs,
        },
        transferables
      );

      await gate;
    }

    if (this.offlineBuildGeneration !== buildGen) return;

    if (!options?.deferReadyCommit) {
      this.offlineAnalysisFingerprintReady = targetFingerprint;
      this.lastOfflineAudioSetup = this.audioSetup;
      if (this.offlineRebuildTargetFingerprint === targetFingerprint) {
        this.offlineRebuildTargetFingerprint = null;
      }
      audioAnalysisStatusStore.set({ state: 'ready' });
    }
    this.activeWorkerBuildKeys = [];
  }

  /**
   * Tier C: remapper add/remove with stable bands — reshape channel layout on main thread (no worker).
   */
  private tryTierCRemapperTopologyPatch(
    setup: AudioSetup,
    loadedIds: string[],
    audioNodeStates: Map<string, { audioBuffer: AudioBuffer | null }>,
    fingerprint: string
  ): boolean {
    const prevSetup = this.lastOfflineAudioSetup;
    if (!prevSetup) return false;

    const tierRank: Record<AudioInvalidationTier, number> = {
      none: 0,
      remapper: 1,
      band: 2,
      structural: 3,
      file: 4,
    };

    for (const fileId of loadedIds) {
      const tier = classifyAudioSetupChange(prevSetup, setup, fileId, {
        prev: audioNodeStates.get(fileId)?.audioBuffer ?? null,
        next: audioNodeStates.get(fileId)?.audioBuffer ?? null,
      });
      if (tier === 'none') continue;
      if (tierRank[tier] < tierRank.structural) return false;
      if (
        tier === 'structural' &&
        !isRemapperTopologyOnlyStructuralChange(prevSetup, setup, fileId, {
          prev: audioNodeStates.get(fileId)?.audioBuffer ?? null,
          next: audioNodeStates.get(fileId)?.audioBuffer ?? null,
        })
      ) {
        return false;
      }
      if (tier === 'file') return false;
    }

    let patchedAny = false;
    for (const fileId of loadedIds) {
      const buffer = audioNodeStates.get(fileId)?.audioBuffer ?? null;
      if (
        !isRemapperTopologyOnlyStructuralChange(prevSetup, setup, fileId, {
          prev: buffer,
          next: buffer,
        })
      ) {
        continue;
      }

      const sampler = this.curveSamplersByFileId.get(fileId);
      const bandSeries = this.bandSmoothedSeriesByFileId.get(fileId);
      if (!sampler || !bandSeries || bandSeries.size === 0) continue;

      const nextCache = reshapeCurveCacheTopology(sampler.getCurveCache(), setup, fileId, bandSeries);
      this.curveSamplersByFileId.set(fileId, new AudioAnalysisCurveSampler(nextCache));
      patchedAny = true;
    }

    if (!patchedAny) return false;

    this.lastOfflineAudioSetup = setup;
    this.offlineAnalysisFingerprintReady = fingerprint;
    audioAnalysisStatusStore.set({ state: 'ready' });
    return true;
  }

  private cancelTierCDDebounce(): void {
    if (this.tierCDDebounceTimer != null) {
      clearTimeout(this.tierCDDebounceTimer);
      this.tierCDDebounceTimer = null;
    }
  }

  private clearTierCDBuildingToastTimer(): void {
    if (this.tierCDBuildingToastTimer != null) {
      clearTimeout(this.tierCDBuildingToastTimer);
      this.tierCDBuildingToastTimer = null;
    }
  }

  /**
   * Tier C/D: structural band topology or decoded buffer changes — per-file full worker rebuild.
   */
  private tryScheduleTierCDFileRebuild(
    setup: AudioSetup,
    loadedIds: string[],
    audioNodeStates: Map<string, { audioBuffer: AudioBuffer | null }>,
    fingerprint: string
  ): boolean {
    const prevSetup = this.lastOfflineAudioSetup;
    if (!prevSetup) return false;

    const tierRank: Record<AudioInvalidationTier, number> = {
      none: 0,
      remapper: 1,
      band: 2,
      structural: 3,
      file: 4,
    };

    const filesToRebuild: string[] = [];

    for (const fileId of loadedIds) {
      const tier = classifyAudioSetupChange(prevSetup, setup, fileId, {
        prev: audioNodeStates.get(fileId)?.audioBuffer ?? null,
        next: audioNodeStates.get(fileId)?.audioBuffer ?? null,
      });
      if (tierRank[tier] < tierRank.structural) continue;
      if (
        tier === 'structural' &&
        isRemapperTopologyOnlyStructuralChange(prevSetup, setup, fileId, {
          prev: audioNodeStates.get(fileId)?.audioBuffer ?? null,
          next: audioNodeStates.get(fileId)?.audioBuffer ?? null,
        })
      ) {
        continue;
      }
      filesToRebuild.push(fileId);
    }

    if (filesToRebuild.length === 0) return false;

    this.cancelTierBDebounce();
    this.clearTierBBuildingToastTimer();
    this.cancelTierCDDebounce();
    this.clearTierCDBuildingToastTimer();
    this.tierBPatchCacheByFileId.clear();
    this.tierBPendingBandIdsByFileId.clear();
    this.tierBPendingFingerprint = null;

    const buildGen = ++this.offlineBuildGeneration;
    for (const fileId of filesToRebuild) {
      this.curveSamplersByFileId.delete(fileId);
      this.bandSmoothedSeriesByFileId.delete(fileId);
      this.tierBPatchCacheByFileId.delete(fileId);
    }

    this.tierCDPendingFileIds = filesToRebuild;
    this.tierCDPendingFingerprint = fingerprint;
    this.offlineRebuildTargetFingerprint = fingerprint;

    audioAnalysisStatusStore.update((s) =>
      s.state === 'building' ? s : { state: 'fallback', label: 'Live preview until analysis finishes' }
    );

    this.tierCDDebounceTimer = setTimeout(() => {
      this.tierCDDebounceTimer = null;
      const genAtQueue = buildGen;
      const fingerprintAtQueue = fingerprint;
      const fileIdsAtQueue = [...this.tierCDPendingFileIds];

      this.audioWorkerBuildChain = this.audioWorkerBuildChain
        .catch(() => undefined)
        .then(() => this.runTierCDFileBuilds(genAtQueue, fingerprintAtQueue, fileIdsAtQueue))
        .catch((err) => {
          if (this.offlineBuildGeneration !== genAtQueue) return;
          if (this.offlineRebuildTargetFingerprint === fingerprintAtQueue) {
            this.offlineRebuildTargetFingerprint = null;
          }
          this.clearTierCDBuildingToastTimer();
          audioAnalysisStatusStore.set({ state: 'failed', label: err instanceof Error ? err.message : String(err) });
        });
    }, AudioManager.TIER_CD_DEBOUNCE_MS);

    return true;
  }

  private async runTierCDFileBuilds(
    buildGen: number,
    targetFingerprint: string,
    fileIds: string[]
  ): Promise<void> {
    if (this.offlineBuildGeneration !== buildGen) return;

    let toastShown = false;
    this.tierCDBuildingToastTimer = setTimeout(() => {
      if (this.offlineBuildGeneration !== buildGen) return;
      toastShown = true;
      audioAnalysisStatusStore.set({ state: 'building', progress01: 0, label: 'Getting audio ready' });
    }, AudioManager.TIER_B_TOAST_DELAY_MS);

    await this.runWorkerFullBuildForFileIds(buildGen, targetFingerprint, fileIds, {
      deferReadyCommit: true,
      allowProgress: () => toastShown,
    });

    this.clearTierCDBuildingToastTimer();

    if (this.offlineBuildGeneration !== buildGen) return;
    if (this.tierCDPendingFingerprint != null && this.tierCDPendingFingerprint !== targetFingerprint) return;

    this.lastOfflineAudioSetup = this.audioSetup;
    this.offlineAnalysisFingerprintReady = targetFingerprint;
    if (this.offlineRebuildTargetFingerprint === targetFingerprint) {
      this.offlineRebuildTargetFingerprint = null;
    }
    this.tierCDPendingFileIds = [];
    this.tierCDPendingFingerprint = null;
    audioAnalysisStatusStore.set({ state: 'ready' });
  }
  
  /**
   * Tier A: remapper-only edits patch published curves on the main thread (no worker, no building toast).
   * Returns true when handled; false to fall through to full rebuild or early-ready paths.
   */
  private tryTierARemapperPatch(
    setup: AudioSetup,
    loadedIds: string[],
    audioNodeStates: Map<string, { audioBuffer: AudioBuffer | null }>,
    fingerprint: string
  ): boolean {
    const prevSetup = this.lastOfflineAudioSetup;
    if (!prevSetup) return false;

    const tierRank: Record<AudioInvalidationTier, number> = {
      none: 0,
      remapper: 1,
      band: 2,
      structural: 3,
      file: 4,
    };
    let worstTier: AudioInvalidationTier = 'none';
    const tierByFileId = new Map<string, AudioInvalidationTier>();

    for (const fileId of loadedIds) {
      const tier = classifyAudioSetupChange(prevSetup, setup, fileId, {
        prev: audioNodeStates.get(fileId)?.audioBuffer ?? null,
        next: audioNodeStates.get(fileId)?.audioBuffer ?? null,
      });
      tierByFileId.set(fileId, tier);
      if (tierRank[tier] > tierRank[worstTier]) worstTier = tier;
    }

    if (worstTier === 'none') return false;
    if (tierRank[worstTier] > tierRank.remapper) return false;

    let patchedAny = false;
    for (const fileId of loadedIds) {
      if (tierByFileId.get(fileId) !== 'remapper') continue;

      const sampler = this.curveSamplersByFileId.get(fileId);
      const bandSeries = this.bandSmoothedSeriesByFileId.get(fileId);
      if (!sampler || !bandSeries || bandSeries.size === 0) continue;

      const { remapperConfigs } = buildOfflineAudioAnalysisConfigs(setup, fileId);
      patchRemapperChannelsFromBandCache(sampler.getCurveCache(), bandSeries, remapperConfigs);
      patchedAny = true;
    }

    if (!patchedAny) return false;

    this.lastOfflineAudioSetup = setup;
    this.offlineAnalysisFingerprintReady = fingerprint;
    audioAnalysisStatusStore.set({ state: 'ready' });
    return true;
  }

  private cancelTierBDebounce(): void {
    if (this.tierBDebounceTimer != null) {
      clearTimeout(this.tierBDebounceTimer);
      this.tierBDebounceTimer = null;
    }
  }

  private clearTierBBuildingToastTimer(): void {
    if (this.tierBBuildingToastTimer != null) {
      clearTimeout(this.tierBBuildingToastTimer);
      this.tierBBuildingToastTimer = null;
    }
  }

  /**
   * Tier B: band-analysis edits queue a debounced subset worker rebuild per file.
   * Returns true when scheduled; false to fall through to full rebuild.
   */
  private tryScheduleTierBBandRebuild(
    setup: AudioSetup,
    loadedIds: string[],
    audioNodeStates: Map<string, { audioBuffer: AudioBuffer | null }>,
    fingerprint: string
  ): boolean {
    const prevSetup = this.lastOfflineAudioSetup;
    if (!prevSetup) return false;

    const tierRank: Record<AudioInvalidationTier, number> = {
      none: 0,
      remapper: 1,
      band: 2,
      structural: 3,
      file: 4,
    };

    const bandIdsByFileId = new Map<string, string[]>();

    for (const fileId of loadedIds) {
      const tier = classifyAudioSetupChange(prevSetup, setup, fileId, {
        prev: audioNodeStates.get(fileId)?.audioBuffer ?? null,
        next: audioNodeStates.get(fileId)?.audioBuffer ?? null,
      });
      if (tier === 'none') continue;
      if (tierRank[tier] > tierRank.band) return false;

      const changedBandIds = bandIdsWithAnalysisChange(prevSetup, setup, fileId);
      if (changedBandIds.length === 0) return false;

      const sampler = this.curveSamplersByFileId.get(fileId);
      const bandSeries = this.bandSmoothedSeriesByFileId.get(fileId);
      if (!sampler && !this.tierBPatchCacheByFileId.has(fileId)) return false;
      if (!bandSeries || bandSeries.size === 0) return false;

      bandIdsByFileId.set(fileId, changedBandIds);
    }

    if (bandIdsByFileId.size === 0) return false;

    this.cancelTierBDebounce();
    this.clearTierBBuildingToastTimer();
    const buildGen = ++this.offlineBuildGeneration;

    for (const fileId of bandIdsByFileId.keys()) {
      const sampler = this.curveSamplersByFileId.get(fileId);
      if (sampler) {
        this.tierBPatchCacheByFileId.set(fileId, sampler.getCurveCache());
        this.curveSamplersByFileId.delete(fileId);
      }
    }

    this.tierBPendingBandIdsByFileId = bandIdsByFileId;
    this.tierBPendingFingerprint = fingerprint;
    this.offlineRebuildTargetFingerprint = fingerprint;

    audioAnalysisStatusStore.update((s) =>
      s.state === 'building' ? s : { state: 'fallback', label: 'Live preview until analysis finishes' }
    );

    this.tierBDebounceTimer = setTimeout(() => {
      this.tierBDebounceTimer = null;
      const genAtQueue = buildGen;
      const fingerprintAtQueue = fingerprint;
      const bandsByFile = new Map(this.tierBPendingBandIdsByFileId);

      this.audioWorkerBuildChain = this.audioWorkerBuildChain
        .catch(() => undefined)
        .then(() => this.runTierBBuilds(genAtQueue, fingerprintAtQueue, bandsByFile))
        .catch((err) => {
          if (this.offlineBuildGeneration !== genAtQueue) return;
          if (this.offlineRebuildTargetFingerprint === fingerprintAtQueue) {
            this.offlineRebuildTargetFingerprint = null;
          }
          this.clearTierBBuildingToastTimer();
          audioAnalysisStatusStore.set({ state: 'failed', label: err instanceof Error ? err.message : String(err) });
        });
    }, AudioManager.TIER_B_DEBOUNCE_MS);

    return true;
  }

  private commitTierBBandResult(msg: AudioAnalysisWorkerBandResult): void {
    const cache = this.tierBPatchCacheByFileId.get(msg.fileId);
    if (!cache) return;

    const setup = this.audioSetup;
    if (!setup) return;

    const { analyzerConfigs, remapperConfigs } = buildOfflineAudioAnalysisConfigs(setup, msg.fileId);
    const subsetConfigs = analyzerConfigs.filter((a) => msg.bandIds.includes(a.nodeId));
    if (subsetConfigs.length === 0) return;

    let bandSeries = this.bandSmoothedSeriesByFileId.get(msg.fileId);
    if (!bandSeries) {
      bandSeries = new Map();
      this.bandSmoothedSeriesByFileId.set(msg.fileId, bandSeries);
    }

    for (let i = 0; i < msg.bandIds.length; i++) {
      const bandId = msg.bandIds[i]!;
      const series = msg.series[i];
      if (series) bandSeries.set(bandId, series);
    }

    patchBandAndRemapChannelsFromBandSeries(cache, bandSeries, subsetConfigs);
    patchRemapperChannelsFromBandCache(cache, bandSeries, remapperConfigs);

    this.curveSamplersByFileId.set(msg.fileId, new AudioAnalysisCurveSampler(cache));
    this.tierBPatchCacheByFileId.delete(msg.fileId);
  }

  private async runTierBBuilds(
    buildGen: number,
    targetFingerprint: string,
    bandIdsByFileId: Map<string, string[]>
  ): Promise<void> {
    if (this.offlineBuildGeneration !== buildGen) return;

    if (this.analysisWorker == null) {
      const { default: WorkerConstructor } = await import('./audio-analysis/audioAnalysisWorker.ts?worker');
      this.analysisWorker = new WorkerConstructor();
    }

    const worker = this.analysisWorker;
    let toastShown = false;
    this.tierBBuildingToastTimer = setTimeout(() => {
      if (this.offlineBuildGeneration !== buildGen) return;
      toastShown = true;
      audioAnalysisStatusStore.set({ state: 'building', progress01: 0, label: 'Getting audio ready' });
    }, AudioManager.TIER_B_TOAST_DELAY_MS);

    for (const key of this.activeWorkerBuildKeys) {
      const [buildId, fileId] = key.split('::');
      if (buildId && fileId) worker.postMessage({ type: 'cancel', buildId, fileId });
    }
    this.activeWorkerBuildKeys = [];

    const pending = new Map<string, { resolve: () => void; reject: (e: Error) => void }>();
    const removeActiveKey = (key: string) => {
      const idx = this.activeWorkerBuildKeys.indexOf(key);
      if (idx >= 0) this.activeWorkerBuildKeys.splice(idx, 1);
    };

    worker.onmessage = (
      ev: MessageEvent<
        | AudioAnalysisWorkerProgress
        | AudioAnalysisWorkerResult
        | AudioAnalysisWorkerBandResult
        | AudioAnalysisWorkerError
        | AudioAnalysisWorkerCanceled
      >
    ) => {
      const msg = ev.data;
      const isCurrentGen = this.offlineBuildGeneration === buildGen;

      if (msg.type === 'progress') {
        if (!isCurrentGen || !toastShown) return;
        const overall = msg.progress01;
        audioAnalysisStatusStore.set({ state: 'building', progress01: overall, label: 'Getting audio ready' });
        return;
      }

      if (msg.type === 'error') {
        const key = `${msg.buildId}::${msg.fileId}`;
        const p = pending.get(key);
        if (!p) return;
        p.reject(new Error(msg.message));
        pending.delete(key);
        removeActiveKey(key);
        return;
      }

      if (msg.type === 'canceled') {
        const key = `${msg.buildId}::${msg.fileId}`;
        const p = pending.get(key);
        if (!p) return;
        p.resolve();
        pending.delete(key);
        removeActiveKey(key);
        return;
      }

      if (msg.type === 'bandResult') {
        const key = `${msg.buildId}::${msg.fileId}`;
        const p = pending.get(key);
        if (!p) return;
        if (isCurrentGen) this.commitTierBBandResult(msg);
        p.resolve();
        pending.delete(key);
        removeActiveKey(key);
      }
    };

    const fileIds = [...bandIdsByFileId.keys()];

    for (let idx = 0; idx < fileIds.length; idx++) {
      if (this.offlineBuildGeneration !== buildGen) return;

      const fileId = fileIds[idx]!;
      const bandIds = bandIdsByFileId.get(fileId);
      if (!bandIds || bandIds.length === 0) continue;

      const cache = this.tierBPatchCacheByFileId.get(fileId);
      if (!cache) continue;

      const setup = this.audioSetup;
      if (!setup) return;

      const expectedDigest = bandAnalysisDigest(setup, fileId);
      if (this.offlineBuildGeneration !== buildGen) return;

      const state = this.playbackController.getAudioNodeState(fileId);
      const buffer = state?.audioBuffer;
      if (!buffer) continue;

      const buildId = `tierb-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const key = `${buildId}::${fileId}`;
      this.activeWorkerBuildKeys.push(key);

      const gate = new Promise<void>((resolve, reject) => {
        pending.set(key, { resolve, reject });
      });

      const pcmChannels: Float32Array[] = [];
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const src = buffer.getChannelData(ch);
        const copy = new Float32Array(src.length);
        copy.set(src);
        pcmChannels.push(copy);
      }

      const { analyzerConfigs } = buildOfflineAudioAnalysisConfigs(setup, fileId);
      const subsetConfigs = analyzerConfigs.filter((a) => bandIds.includes(a.nodeId));
      const hopHz = 120;
      const frameRateForDuration = 120;
      const maxFrames = Math.ceil(buffer.duration * frameRateForDuration) + 2;

      worker.postMessage(
        {
          type: 'buildBands',
          buildId,
          fileId,
          sampleRate: buffer.sampleRate,
          startTimeSeconds: cache.startTimeSeconds,
          hopHz,
          frameRateForDuration,
          maxFrames,
          pcmChannels,
          analyzerConfigs: subsetConfigs,
        },
        pcmChannels.map((a) => a.buffer)
      );

      await gate;

      if (this.offlineBuildGeneration !== buildGen) return;
      if (bandAnalysisDigest(setup, fileId) !== expectedDigest) return;
    }

    this.clearTierBBuildingToastTimer();

    if (this.offlineBuildGeneration !== buildGen) return;
    if (this.tierBPendingFingerprint != null && this.tierBPendingFingerprint !== targetFingerprint) return;

    this.lastOfflineAudioSetup = this.audioSetup;
    this.offlineAnalysisFingerprintReady = targetFingerprint;
    if (this.offlineRebuildTargetFingerprint === targetFingerprint) {
      this.offlineRebuildTargetFingerprint = null;
    }
    this.tierBPendingBandIdsByFileId.clear();
    this.tierBPendingFingerprint = null;
    audioAnalysisStatusStore.set({ state: 'ready' });
    this.activeWorkerBuildKeys = [];
  }
  
  /**
   * Get audio node state
   */
  getAudioNodeState(nodeId: string): AudioNodeState | undefined {
    return this.playbackController.getAudioNodeState(nodeId);
  }
  
  /**
   * Get analyzer node state
   */
  getAnalyzerNodeState(nodeId: string): AnalyzerNodeState | undefined {
    return this.frequencyAnalyzer.getAnalyzerNodeState(nodeId);
  }

  /**
   * Get spectrum data for a panel band (for FrequencyRangeEditor).
   * Refreshes frequency data from the analyser and returns it.
   */
  getAnalyzerSpectrumData(bandId: string): { frequencyData: Uint8Array; fftSize: number; sampleRate: number } | null {
    const band = this.audioSetup?.bands.find((b) => b.id === bandId);
    if (!band) return null;
    const audioState = this.playbackController.getAudioNodeState(band.sourceFileId);
    if (!audioState?.analyserNode || !audioState.frequencyData) return null;
    const freqData = audioState.frequencyData as Uint8Array<ArrayBuffer>;
    audioState.analyserNode.getByteFrequencyData(freqData);
    const analyzerState = this.frequencyAnalyzer.getAnalyzerNodeState(bandId);
    // Return a copy so Svelte reactivity detects updates (in-place mutation doesn't trigger re-renders)
    return {
      frequencyData: new Uint8Array(freqData),
      fftSize: analyzerState?.fftSize ?? band.fftSize ?? 2048,
      sampleRate: this.contextManager.getSampleRate()
    };
  }

  /**
   * Get live incoming (raw band) and outgoing (remapped) values for a panel band or remapper.
   * Used for RemapRangeEditor needles.
   */
  getPanelBandLiveValues(
    bandId: string,
    remap: { inMin: number; inMax: number; outMin: number; outMax: number }
  ): { incoming: number | null; outgoing: number | null } {
    return getPanelBandLiveValuesImpl(
      bandId,
      remap,
      (id) => this.frequencyAnalyzer.getAnalyzerNodeState(id)
    );
  }

  /**
   * Get live value for a virtual node (audio signal).
   * Used when a parameter is connected to a virtual node.
   */
  getVirtualNodeLiveValue(virtualNodeId: string): number | null {
    return getVirtualNodeLiveValueImpl(
      virtualNodeId,
      this.audioSetup,
      (id) => this.frequencyAnalyzer.getAnalyzerNodeState(id)
    );
  }

  /**
   * Get audio context sample rate (for spectrum bin mapping).
   */
  getSampleRate(): number {
    return this.contextManager.getSampleRate();
  }
  
  /**
   * Play all audio nodes
   */
  async playAllAudio(offset: number = 0): Promise<void> {
    await this.playbackController.playAllAudio(offset);
  }
  
  /**
   * Stop all audio nodes
   */
  stopAllAudio(): void {
    const audioNodeStates = this.playbackController.getAllAudioNodeStates();
    for (const nodeId of audioNodeStates.keys()) {
      this.stopAudio(nodeId);
    }
  }
  
  /**
   * Get global audio state (from first loaded audio file)
   */
  getGlobalAudioState(primaryNodeId?: string): { isPlaying: boolean; currentTime: number; duration: number } | null {
    return this.playbackController.getGlobalAudioState(primaryNodeId);
  }
  
  /**
   * Seek all audio to a specific time
   */
  async seekAllAudio(time: number): Promise<void> {
    await this.playbackController.seekAllAudio(time);
  }
  
  /**
   * Remove audio node and clean up all resources
   */
  removeAudioNode(nodeId: string): void {
    this.playbackController.removeAudioNode(nodeId);
    // Clear previous values when node is removed
    this.clearPreviousValues(nodeId);
  }
  
  /**
   * Remove analyzer node and clean up all resources
   */
  removeAnalyzerNode(nodeId: string): void {
    this.frequencyAnalyzer.removeAnalyzerNode(nodeId);
    // Clear previous values when analyzer node is removed
    this.clearPreviousValues(nodeId);
  }
  
  /**
   * Clear previous uniform values for a node (call when audio stops or node is removed)
   */
  clearPreviousValues(nodeId: string): void {
    for (const key of this.previousUniformValues.keys()) {
      if (key.startsWith(`${nodeId}.`)) {
        this.previousUniformValues.delete(key);
      }
    }
  }
  
  /**
   * Verify all resources are cleaned up for a node
   */
  verifyCleanup(nodeId: string): boolean {
    const audioState = this.playbackController.getAudioNodeState(nodeId);
    const analyzerState = this.frequencyAnalyzer.getAnalyzerNodeState(nodeId);
    
    if (audioState || analyzerState) {
      console.warn(`[AudioManager] Resources still exist for node ${nodeId} after cleanup`);
      return false;
    }
    
    return true;
  }
  
  /**
   * Get resource statistics
   */
  getResourceStats(): {
    audioNodes: number;
    analyzerNodes: number;
    audioBuffers: number;
  } {
    const audioNodeStates = this.playbackController.getAllAudioNodeStates();
    return {
      audioNodes: audioNodeStates.size,
      analyzerNodes: this.frequencyAnalyzer.getAnalyzerNodeCount(),
      audioBuffers: Array.from(audioNodeStates.values())
        .filter(s => s.audioBuffer !== null).length
    };
  }
  
  /**
   * Start periodic cleanup (check for orphaned resources)
   * Note: The cleanup callback should be provided by the caller (RuntimeManager)
   * to have access to the current graph
   */
  startPeriodicCleanup(cleanupCallback: () => void, intervalMs: number = 30000): void {
    if (this.cleanupInterval) {
      return; // Already running
    }
    
    this.cleanupInterval = window.setInterval(() => {
      cleanupCallback();
    }, intervalMs);
  }
  
  /**
   * Stop periodic cleanup
   */
  stopPeriodicCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
  
  /**
   * Clean up orphaned resources (nodes that no longer exist in graph)
   * @param graph - Node graph (valid IDs from graph.nodes)
   * @param extraValidIds - Additional valid IDs (e.g. panel file IDs from audioSetup.files)
   */
  cleanupOrphanedResources(
    graph?: NodeGraph | null,
    extraValidIds?: Iterable<string>
  ): void {
    const validNodeIds = new Set<string>();
    if (graph) {
      for (const n of graph.nodes) validNodeIds.add(n.id);
    }
    if (extraValidIds) {
      for (const id of extraValidIds) validNodeIds.add(id);
    }
    if (validNodeIds.size === 0) return;
    const { orphanedAudioNodes, orphanedAnalyzerNodes } = findOrphanedNodes(
      validNodeIds,
      () => this.playbackController.getAllAudioNodeStates().keys(),
      () => this.frequencyAnalyzer.getAllAnalyzerNodeIds()
    );
    for (const nodeId of orphanedAudioNodes) {
      console.warn(`[AudioManager] Cleaning up orphaned audio node: ${nodeId}`);
      this.removeAudioNode(nodeId);
    }
    for (const nodeId of orphanedAnalyzerNodes) {
      console.warn(`[AudioManager] Cleaning up orphaned analyzer node: ${nodeId}`);
      this.removeAnalyzerNode(nodeId);
    }
    if (orphanedAudioNodes.length > 0 || orphanedAnalyzerNodes.length > 0) {
      console.warn(`[AudioManager] Cleaned up ${orphanedAudioNodes.length} audio nodes and ${orphanedAnalyzerNodes.length} analyzer nodes`);
    }
  }
  
  /**
   * Cleanup all resources
   */
  destroy(): void {
    // Stop periodic cleanup
    this.stopPeriodicCleanup();
    this.cancelPendingOfflineRebuildSchedule();
    this.cancelTierBDebounce();
    this.clearTierBBuildingToastTimer();
    this.cancelTierCDDebounce();
    this.clearTierCDBuildingToastTimer();
    this.tierBPatchCacheByFileId.clear();
    this.loadAudioFileInflightByKey.clear();

    // Destroy components in reverse order of creation (dependencies before dependents)
    // FrequencyAnalyzer depends on AudioPlaybackController
    // AudioPlaybackController depends on AudioContextManager
    // AudioLoader depends on AudioContextManager
    this.frequencyAnalyzer.destroy();
    this.playbackController.destroy();
    this.loader.destroy();
    this.contextManager.destroy();
  }
}

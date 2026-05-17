import type { AnalyzerConfig } from '../../video-export/OfflineAudioProvider';

export type AudioAnalysisWorkerRequest =
  | {
      type: 'build';
      buildId: string;
      fileId: string;
      sampleRate: number;
      startTimeSeconds: number;
      hopHz: number; // canonical rate (e.g. 120)
      frameRateForDuration: number; // used with maxFrames to compute lastSampleTime
      maxFrames: number;
      pcmChannels: Float32Array[]; // channel data arrays (full track), copied for worker use
      analyzerConfigs: AnalyzerConfig[];
      remapperConfigs: Array<{ id: string; bandId: string; inMin: number; inMax: number; outMin: number; outMax: number }>;
    }
  | {
      /** Tier B: FFT+smoothing for a subset of bands on one file (subset of analyzerConfigs + PCM). */
      type: 'buildBands';
      buildId: string;
      fileId: string;
      sampleRate: number;
      startTimeSeconds: number;
      hopHz: number;
      frameRateForDuration: number;
      maxFrames: number;
      pcmChannels: Float32Array[];
      analyzerConfigs: AnalyzerConfig[];
    }
  | { type: 'cancel'; buildId: string; fileId: string };

export type AudioAnalysisWorkerProgress = {
  type: 'progress';
  buildId: string;
  fileId: string;
  progress01: number;
};

export type AudioAnalysisWorkerCanceled = {
  type: 'canceled';
  buildId: string;
  fileId: string;
};

export type AudioAnalysisWorkerResult = {
  type: 'result';
  buildId: string;
  fileId: string;
  cache: {
    startTimeSeconds: number;
    hopSeconds: number;
    frameCount: number;
    channels: Array<{
      nodeId: string;
      paramName: string;
      min?: number;
      max?: number;
      defaultValue?: number;
    }>;
    values: Float32Array;
  };
};

/** Tier B subset rebuild: smoothed band series (index 0) per band id. */
export type AudioAnalysisWorkerBandResult = {
  type: 'bandResult';
  buildId: string;
  fileId: string;
  bandIds: string[];
  series: Float32Array[];
};

export type AudioAnalysisWorkerError = {
  type: 'error';
  buildId: string;
  fileId: string;
  message: string;
};

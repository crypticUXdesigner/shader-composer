/// <reference lib="webworker" />

import type {
  AudioAnalysisWorkerRequest,
  AudioAnalysisWorkerProgress,
  AudioAnalysisWorkerResult,
  AudioAnalysisWorkerBandResult,
  AudioAnalysisWorkerError,
} from './audioAnalysisWorkerTypes';
import { buildBandSmoothedSeriesSubset, buildFullAnalysisCache } from './audioAnalysisBuildCore';

function postProgress(buildId: string, fileId: string, progress01: number): void {
  const msg: AudioAnalysisWorkerProgress = { type: 'progress', buildId, fileId, progress01 };
  postMessage(msg);
}

function postError(buildId: string, fileId: string, message: string): void {
  const msg: AudioAnalysisWorkerError = { type: 'error', buildId, fileId, message };
  postMessage(msg);
}

function postCanceled(buildId: string, fileId: string): void {
  postMessage({ type: 'canceled', buildId, fileId });
}

const canceled = new Set<string>();
function cancelKey(buildId: string, fileId: string): string {
  return `${buildId}::${fileId}`;
}

function isCanceled(buildId: string, fileId: string): boolean {
  return canceled.has(cancelKey(buildId, fileId));
}

self.onmessage = (ev: MessageEvent<AudioAnalysisWorkerRequest>) => {
  const msg = ev.data;
  if (msg.type === 'cancel') {
    const key = cancelKey(msg.buildId, msg.fileId);
    canceled.add(key);
    setTimeout(() => canceled.delete(key), 60_000);
    return;
  }

  if (msg.type === 'buildBands') {
    const { buildId, fileId, sampleRate, startTimeSeconds, hopHz, frameRateForDuration, maxFrames, pcmChannels, analyzerConfigs } =
      msg;

    (async () => {
      try {
        postProgress(buildId, fileId, 0);
        const seriesByBandId = buildBandSmoothedSeriesSubset(
          {
            pcmChannels,
            sampleRate,
            startTimeSeconds,
            hopHz,
            frameRateForDuration,
            maxFrames,
            analyzerConfigs: [],
            remapperConfigs: [],
            onProgress: (p01) => {
              if (isCanceled(buildId, fileId)) return false;
              postProgress(buildId, fileId, p01);
              return true;
            },
          },
          analyzerConfigs
        );

        if (isCanceled(buildId, fileId)) {
          canceled.delete(cancelKey(buildId, fileId));
          postCanceled(buildId, fileId);
          return;
        }

        const bandIds = Array.from(seriesByBandId.keys());
        const series = bandIds.map((bandId) => seriesByBandId.get(bandId)!);
        const transferables = series.map((s) => s.buffer);

        const result: AudioAnalysisWorkerBandResult = {
          type: 'bandResult',
          buildId,
          fileId,
          bandIds,
          series,
        };
        postMessage(result, transferables);
      } catch (e) {
        postError(buildId, fileId, e instanceof Error ? e.message : String(e));
      }
    })();
    return;
  }

  if (msg.type !== 'build') return;

  const {
    buildId,
    fileId,
    sampleRate,
    startTimeSeconds,
    hopHz,
    frameRateForDuration,
    maxFrames,
    pcmChannels,
    analyzerConfigs,
    remapperConfigs,
  } = msg;

  (async () => {
    try {
      postProgress(buildId, fileId, 0);
      const cache = buildFullAnalysisCache({
        pcmChannels,
        sampleRate,
        startTimeSeconds,
        hopHz,
        frameRateForDuration,
        maxFrames,
        analyzerConfigs,
        remapperConfigs,
        onProgress: (p01) => {
          if (isCanceled(buildId, fileId)) return false;
          postProgress(buildId, fileId, p01);
          return true;
        },
      });

      if (isCanceled(buildId, fileId)) {
        canceled.delete(cancelKey(buildId, fileId));
        postCanceled(buildId, fileId);
        return;
      }

      const result: AudioAnalysisWorkerResult = {
        type: 'result',
        buildId,
        fileId,
        cache,
      };

      postMessage(result, [cache.values.buffer]);
    } catch (e) {
      postError(buildId, fileId, e instanceof Error ? e.message : String(e));
    }
  })();
};

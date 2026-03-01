/**
 * Runtime playback and timeline state.
 * Extracted from RuntimeManager: playlist, primary playback, seek, and timeline state.
 */

import type { NodeGraph } from '../../data-model/types';
import type { AudioSetup } from '../../data-model/audioSetupTypes';
import { getPrimaryFileId } from '../../data-model/audioSetupTypes';
import type { IAudioManager } from '../types';
import type { TimelineState } from '../types';
import type { ErrorHandler } from '../../utils/errorHandling';
import { globalErrorHandler } from '../../utils/errorHandling';
import { SyntheticTransport } from '../timeline/SyntheticTransport';
import { getTracksData, getTrackMp3Url } from '../tracksData';

export type OnPlaylistAdvance = (nextState: { currentIndex: number }) => void;

export interface RuntimePlaybackHandlerDeps {
  audioManager: IAudioManager;
  getCurrentAudioSetup: () => AudioSetup | null;
  getCurrentGraph: () => NodeGraph | null;
  getOnPlaylistAdvance: () => OnPlaylistAdvance | undefined;
  syntheticTransport: SyntheticTransport;
  errorHandler?: ErrorHandler;
}

/**
 * Handles playlist/primary playback, seek, and timeline state for RuntimeManager.
 */
export class RuntimePlaybackHandler {
  private deps: RuntimePlaybackHandlerDeps;

  constructor(deps: RuntimePlaybackHandlerDeps) {
    this.deps = deps;
  }

  getPlayOptions(): { loop: boolean; onEnded?: () => void } {
    const audioSetup = this.deps.getCurrentAudioSetup();
    const primary = audioSetup?.primarySource;
    const ps = audioSetup?.playlistState;
    const loop =
      !primary ||
      primary.type === 'upload' ||
      (primary.type === 'playlist' && (ps?.loopCurrentTrack ?? false));
    const onPlaylistAdvance = this.deps.getOnPlaylistAdvance();
    const onEnded =
      primary?.type === 'playlist' && !(ps?.loopCurrentTrack)
        ? () => {
            const order = ps?.order ?? [];
            if (order.length === 0) return;
            const nextIndex = (ps!.currentIndex + 1) % order.length;
            onPlaylistAdvance?.({ currentIndex: nextIndex });
          }
        : undefined;
    return { loop, onEnded };
  }

  playPrimary(): void {
    const primaryId = getPrimaryFileId(this.deps.getCurrentAudioSetup());
    if (!primaryId) return;
    const nodeState = this.deps.audioManager.getAudioNodeState(primaryId);
    if (!nodeState?.audioBuffer) return;
    const handler = this.deps.errorHandler ?? globalErrorHandler;
    this.deps.audioManager.playAudio(primaryId, 0, this.getPlayOptions()).catch((error) => {
      if (handler) {
        handler.report(
          'audio',
          'error',
          `Failed to play primary audio`,
          { originalError: error instanceof Error ? error : new Error(String(error)), nodeId: primaryId }
        );
      }
    });
  }

  playNext(): void {
    const ps = this.deps.getCurrentAudioSetup()?.playlistState;
    const order = ps?.order ?? [];
    if (order.length === 0) return;
    const nextIndex = (ps!.currentIndex + 1) % order.length;
    this.deps.getOnPlaylistAdvance()?.({ currentIndex: nextIndex });
  }

  playPrevious(): void {
    const primaryId = getPrimaryFileId(this.deps.getCurrentAudioSetup());
    const ps = this.deps.getCurrentAudioSetup()?.playlistState;
    const order = ps?.order ?? [];
    if (order.length === 0) {
      if (primaryId) this.seekGlobalAudio(0);
      return;
    }
    const globalState = this.deps.audioManager.getGlobalAudioState(primaryId ?? undefined);
    const currentTime = globalState?.currentTime ?? 0;
    if (currentTime < 3) {
      this.seekGlobalAudio(0);
      return;
    }
    const prevIndex = ps!.currentIndex - 1;
    const nextIndex = prevIndex < 0 ? order.length - 1 : prevIndex;
    this.deps.getOnPlaylistAdvance()?.({ currentIndex: nextIndex });
  }

  playStart(): void {
    const primary = this.deps.getCurrentAudioSetup()?.primarySource;
    if (primary?.type === 'playlist') {
      this.deps.getOnPlaylistAdvance()?.({ currentIndex: 0 });
      return;
    }
    this.seekGlobalAudio(0);
  }

  seekGlobalAudio(time: number): void {
    const primaryId = getPrimaryFileId(this.deps.getCurrentAudioSetup());
    const globalState = this.deps.audioManager.getGlobalAudioState(primaryId ?? undefined);
    if (globalState) {
      const handler = this.deps.errorHandler ?? globalErrorHandler;
      this.deps.audioManager.seekAllAudio(time).catch(error => {
        if (handler) {
          handler.report(
            'audio',
            'warning',
            'Failed to seek audio',
            {
              originalError: error instanceof Error ? error : new Error(String(error)),
              time
            }
          );
        }
      });
      return;
    }
    const graph = this.deps.getCurrentGraph();
    if (graph) {
      const duration = graph.automation?.durationSeconds ?? 30;
      this.deps.syntheticTransport.setDuration(duration);
      this.deps.syntheticTransport.seek(time);
    }
  }

  getTimelineState(): TimelineState | null {
    const graph = this.deps.getCurrentGraph();
    if (!graph) return null;
    const primaryId = getPrimaryFileId(this.deps.getCurrentAudioSetup());
    const audioState = this.deps.audioManager.getGlobalAudioState(primaryId ?? undefined);
    const bpm = graph.automation?.bpm ?? 120;
    if (audioState) {
      return {
        currentTime: audioState.currentTime,
        duration: audioState.duration,
        bpm,
        hasAudio: true,
        isPlaying: audioState.isPlaying
      };
    }
    const duration = graph.automation?.durationSeconds ?? 30;
    this.deps.syntheticTransport.setDuration(duration);
    const syn = this.deps.syntheticTransport.getState();
    return {
      currentTime: syn.currentTime,
      duration,
      bpm,
      hasAudio: false,
      isPlaying: syn.isPlaying
    };
  }

  getGlobalAudioState(): { isPlaying: boolean; currentTime: number; duration: number } | null {
    const primaryId = getPrimaryFileId(this.deps.getCurrentAudioSetup());
    return this.deps.audioManager.getGlobalAudioState(primaryId ?? undefined);
  }

  /**
   * Toggle global audio playback (primary source or synthetic transport).
   */
  toggleGlobalAudioPlayback(): void {
    const primaryId = getPrimaryFileId(this.deps.getCurrentAudioSetup());
    const hasPrimary = primaryId != null;
    const state = primaryId ? this.deps.audioManager.getAudioNodeState(primaryId) : null;
    const hasBuffer = state?.audioBuffer != null;
    const globalState = this.deps.audioManager.getGlobalAudioState(primaryId ?? undefined);
    const graph = this.deps.getCurrentGraph();

    if (!hasPrimary || !hasBuffer) {
      const duration = graph?.automation?.durationSeconds ?? 30;
      this.deps.syntheticTransport.setDuration(duration);
      const syn = this.deps.syntheticTransport.getState();
      if (syn.isPlaying) {
        this.deps.syntheticTransport.pause();
      } else {
        this.deps.syntheticTransport.play();
      }
      return;
    }

    if (!globalState) {
      this.playPrimary();
      return;
    }

    const handler = this.deps.errorHandler ?? globalErrorHandler;
    if (globalState.isPlaying) {
      this.deps.audioManager.pauseAllAudio();
    } else {
      this.deps.audioManager.playAudio(primaryId, globalState.currentTime, this.getPlayOptions()).catch((error) => {
        if (handler) {
          handler.report(
            'audio',
            'error',
            'Failed to play audio',
            { originalError: error instanceof Error ? error : new Error(String(error)) }
          );
        }
      });
    }
  }

  /**
   * Load primary source and optionally start playback when ready.
   * Called from RuntimeManager.setAudioSetup after state and cleanup are updated.
   */
  async loadPrimaryAndMaybePlay(
    primaryId: string,
    audioSetup: AudioSetup | null,
    autoPlayWhenReady: boolean,
    setAudioSetupOnManager: (setup: AudioSetup | null) => void
  ): Promise<void> {
    if (!primaryId) return;
    const state = this.deps.audioManager.getAudioNodeState(primaryId);
    if (state?.audioBuffer) {
      if (autoPlayWhenReady) this.playPrimary();
      return;
    }

    const primary = audioSetup?.primarySource;
    if (primary?.type === 'playlist') {
      getTracksData()
        .then((data) => {
          const url = getTrackMp3Url(data, primary.trackId);
          if (url) {
            return this.deps.audioManager.loadAudioFile(primaryId, url, { reportLoadFailure: true }).then(() => {
              setAudioSetupOnManager(audioSetup);
              if (autoPlayWhenReady) this.playPrimary();
            });
          }
        })
        .catch(() => {});
      return;
    }
    if (primary?.type === 'upload') {
      const path = primary.file.filePath;
      if (typeof path === 'string' && path.trim() !== '') {
        const resolved = path.startsWith('/') || path.startsWith('http') ? path : '/' + path;
        this.deps.audioManager.loadAudioFile(primaryId, resolved, { reportLoadFailure: false }).then(() => {
          setAudioSetupOnManager(audioSetup);
          if (autoPlayWhenReady) this.playPrimary();
        }).catch(() => {});
      }
      return;
    }
    const file = audioSetup?.files?.[0];
    if (file?.filePath && typeof file.filePath === 'string' && file.filePath.trim() !== '') {
      const resolved = file.filePath.startsWith('/') || file.filePath.startsWith('http') ? file.filePath : '/' + file.filePath;
      this.deps.audioManager.loadAudioFile(file.id, resolved, { reportLoadFailure: false }).then(() => {
        setAudioSetupOnManager(audioSetup);
        if (autoPlayWhenReady) this.playPrimary();
      }).catch(() => {});
    }
  }
}

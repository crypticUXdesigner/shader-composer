/**
 * Single-frame image export orchestrator.
 *
 * Uses the same render path as video export (ExportRenderPath) so "what a frame means"
 * stays aligned with the preview/video pipeline.
 */

import { mount, unmount } from 'svelte';
import type { NodeGraph } from '../data-model/types';
import type { AudioSetup } from '../data-model/audioSetupTypes';
import type { ShaderCompiler } from '../runtime/types';
import { createExportRenderPath } from '../video-export/ExportRenderPath';
import type { FrameAudioState } from '../video-export/OfflineAudioProvider';
import ImageExportDialog from '../lib/components/export/ImageExportDialog.svelte';
import type { ImageExportConfirmPayload } from './types';

export interface ImageExportOrchestratorOptions {
  graph: NodeGraph;
  audioSetup: AudioSetup;
  compiler: ShaderCompiler;
  getTimelineState: () => { currentTime: number; duration?: number } | null;
}

type DialogResult = ImageExportConfirmPayload;

export interface ImageExportPreviewRenderOptions {
  timeSeconds: number;
  targetWidth: number;
  targetHeight: number;
}

export type ImageExportPreviewRenderFn = (
  opts: ImageExportPreviewRenderOptions
) => Promise<HTMLCanvasElement | null>;

interface ShowImageExportDialogOptions {
  initialTimeSeconds: number;
  durationSeconds: number;
  renderPreviewFrame: ImageExportPreviewRenderFn;
}

function showImageExportDialog(opts: ShowImageExportDialogOptions): {
  config: Promise<DialogResult>;
  close: () => void;
} {
  const container = document.createElement('div');
  document.body.appendChild(container);

  let instance: ReturnType<typeof mount> | null = null;
  let settled = false;

  const cleanup = () => {
    if (!container.parentNode) return;
    if (instance) unmount(instance);
    container.remove();
  };

  let resolveConfig!: (cfg: DialogResult) => void;
  let rejectConfig!: (err: Error) => void;
  const config = new Promise<DialogResult>((resolve, reject) => {
    resolveConfig = resolve;
    rejectConfig = reject;
  });

  const handleClose = () => {
    if (settled) return;
    settled = true;
    cleanup();
    rejectConfig(new Error('Cancelled'));
  };

  const handleConfirm = (cfg: DialogResult) => {
    if (settled) return;
    settled = true;
    cleanup();
    resolveConfig(cfg);
  };

  instance = mount(ImageExportDialog, {
    target: container,
    props: {
      visible: true,
      initialTimeSeconds: opts.initialTimeSeconds,
      durationSeconds: opts.durationSeconds,
      renderPreviewFrame: opts.renderPreviewFrame,
      onClose: handleClose,
      onConfirm: handleConfirm,
    },
  });

  return {
    config,
    close() {
      cleanup();
    },
  };
}

function mimeTypeForFormat(format: DialogResult['format']): string {
  if (format === 'png') return 'image/png';
  if (format === 'jpeg') return 'image/jpeg';
  return 'image/webp';
}

function defaultFilename(format: DialogResult['format']): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `shader-export-${y}-${m}-${d}-${h}${min}.${format}`;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.click();
  URL.revokeObjectURL(url);
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: DialogResult['format'],
  quality?: number
): Promise<Blob> {
  const mime = mimeTypeForFormat(format);
  const q = format === 'png' ? undefined : quality;

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to create image blob.'));
          return;
        }
        resolve(blob);
      },
      mime,
      q
    );
  });
}

/**
 * Maximum dimension (px) for the in-dialog preview. The preview is rendered at the chosen
 * export aspect ratio but scaled down to keep updates fast while scrubbing.
 */
const PREVIEW_MAX_DIM = 480;

interface PreviewController {
  renderPreviewFrame: ImageExportPreviewRenderFn;
  dispose: () => void;
}

/**
 * Owns a single low-res ExportRenderPath that is reused across preview renders.
 * The path is rebuilt only when the target preview dimensions change (typically
 * when the user picks a different aspect ratio in the dialog), so scrubbing time
 * is cheap and only updates the time uniform.
 */
function createPreviewController(
  graph: NodeGraph,
  compiler: ShaderCompiler,
  audioSetup: AudioSetup
): PreviewController {
  let cached: {
    width: number;
    height: number;
    path: ReturnType<typeof createExportRenderPath>;
  } | null = null;
  let disposed = false;

  function previewSize(targetWidth: number, targetHeight: number): [number, number] {
    if (!Number.isFinite(targetWidth) || !Number.isFinite(targetHeight) || targetWidth <= 0 || targetHeight <= 0) {
      return [PREVIEW_MAX_DIM, PREVIEW_MAX_DIM];
    }
    const longest = Math.max(targetWidth, targetHeight);
    const scale = longest > PREVIEW_MAX_DIM ? PREVIEW_MAX_DIM / longest : 1;
    const w = Math.max(1, Math.round(targetWidth * scale));
    const h = Math.max(1, Math.round(targetHeight * scale));
    return [w, h];
  }

  function disposeCached() {
    if (cached) {
      try {
        cached.path.dispose();
      } catch {
        // ignore: best-effort cleanup
      }
      cached = null;
    }
  }

  async function renderPreviewFrame(opts: ImageExportPreviewRenderOptions): Promise<HTMLCanvasElement | null> {
    if (disposed) return null;
    const [w, h] = previewSize(opts.targetWidth, opts.targetHeight);

    if (!cached || cached.width !== w || cached.height !== h) {
      disposeCached();
      try {
        const path = createExportRenderPath(graph, compiler, audioSetup, {
          width: w,
          height: h,
          frameRate: 1,
          startTimeSeconds: 0,
        });
        cached = { width: w, height: h, path };
      } catch (err) {
        console.error('[ImageExport] Preview render path failed to build:', err);
        return null;
      }
    }

    const t = Math.max(0, Number.isFinite(opts.timeSeconds) ? opts.timeSeconds : 0);
    const frameState: FrameAudioState = {
      channelSamples: [],
      uniformUpdates: [],
      timelineTime: t,
    };

    try {
      // frameRate=1, startTimeSeconds=0, frameIndex=t makes uTime = t (no need to rebuild for time changes).
      const canvasLike = cached.path.renderFrame(t, frameState);
      return canvasLike as HTMLCanvasElement;
    } catch (err) {
      console.error('[ImageExport] Preview render failed:', err);
      return null;
    }
  }

  return {
    renderPreviewFrame,
    dispose() {
      disposed = true;
      disposeCached();
    },
  };
}

/**
 * Run image export: dialog → render single frame → download.
 * Throws on cancellation or failure; caller is expected to surface errors via app-level handler.
 */
export async function runImageExportFlow(options: ImageExportOrchestratorOptions): Promise<void> {
  const timelineState = options.getTimelineState();
  const initialTimeSeconds = Math.max(0, timelineState?.currentTime ?? 0);
  const durationSeconds = Math.max(0, timelineState?.duration ?? 0);

  const previewController = createPreviewController(options.graph, options.compiler, options.audioSetup);

  try {
    const dialog = showImageExportDialog({
      initialTimeSeconds,
      durationSeconds,
      renderPreviewFrame: previewController.renderPreviewFrame,
    });
    const config = await dialog.config;

    const timeSeconds = config.mode === 'time' ? Math.max(0, config.timeSeconds) : initialTimeSeconds;

    // Use frameRate=1 and startTimeSeconds=timeSeconds to hit the exact time with frameIndex=0.
    const frameRate = 1;
    const frameIndex = 0;

    const renderPath = createExportRenderPath(options.graph, options.compiler, options.audioSetup, {
      width: config.width,
      height: config.height,
      frameRate,
      startTimeSeconds: timeSeconds,
    });

    try {
      const frameState: FrameAudioState = {
        channelSamples: [],
        uniformUpdates: [],
        timelineTime: timeSeconds,
      };
      const canvasLike = renderPath.renderFrame(frameIndex, frameState);
      const canvas = canvasLike as HTMLCanvasElement;
      const blob = await canvasToBlob(canvas, config.format, config.quality);
      downloadBlob(blob, defaultFilename(config.format));
    } finally {
      renderPath.dispose();
      dialog.close();
    }
  } finally {
    previewController.dispose();
  }
}


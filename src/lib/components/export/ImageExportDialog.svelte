<script lang="ts">
  import { Input, Message, ModalDialog, Slider, Tag } from '../ui';
  import type {
    ImageExportConfirmPayload,
    ImageExportFormat,
    ImageExportFrameSelection,
  } from '../../../image-export/types';

  const DEFAULT_WIDTH = 1600;
  const DEFAULT_HEIGHT = 1600;
  const DEFAULT_QUALITY = 1.0;
  const EXPORT_DIMENSION_MAX = 4096;
  /** Matches `.preview-bounds` — used to fit the frame without CSS `aspect-ratio` fighting `width/height: 100%`. */
  const PREVIEW_BOUND_W = 360;
  const PREVIEW_BOUND_H = 240;

  type FrameSelection = ImageExportFrameSelection;

  type ResolutionPreset =
    | '3840x2160'
    | '2560x1440'
    | '1920x1080'
    | '1280x720'
    | '2048x2048'
    | '1600x1600'
    | '1080x1080'
    | 'custom';

  interface Props {
    visible?: boolean;
    initialTimeSeconds?: number;
    durationSeconds?: number;
    renderPreviewFrame?: (opts: {
      timeSeconds: number;
      targetWidth: number;
      targetHeight: number;
    }) => Promise<HTMLCanvasElement | null>;
    onClose?: () => void;
    onConfirm?: (payload: ImageExportConfirmPayload) => void;
  }

  let {
    visible = false,
    initialTimeSeconds = 0,
    durationSeconds = 0,
    renderPreviewFrame,
    onClose,
    onConfirm,
  }: Props = $props();

  let timeSeconds = $state<number | null>(null);
  const effectiveTime = $derived(Math.max(0, timeSeconds ?? initialTimeSeconds ?? 0));
  const effectiveTimeFinite = $derived(Number.isFinite(effectiveTime) ? effectiveTime : 0);

  let resolutionPreset = $state<ResolutionPreset>('1600x1600');
  let customWidth = $state(DEFAULT_WIDTH);
  let customHeight = $state(DEFAULT_HEIGHT);

  let format = $state<ImageExportFormat>('png');
  let quality = $state(DEFAULT_QUALITY);

  let errorMessage = $state('');

  let previewHostEl = $state<HTMLDivElement | null>(null);
  let previewLoading = $state(false);
  let previewError = $state<string | null>(null);
  let previewCanvasMounted = $state<HTMLCanvasElement | null>(null);
  let previewToken = 0;

  const previewWidth = $derived(
    Number.isFinite(customWidth) && customWidth > 0 ? customWidth : DEFAULT_WIDTH,
  );
  const previewHeight = $derived(
    Number.isFinite(customHeight) && customHeight > 0 ? customHeight : DEFAULT_HEIGHT,
  );
  /** Pixel size inside the fixed bounds; preserves exact export aspect ratio (e.g. 1:1, 16:9). */
  const previewFramePx = $derived.by(() => {
    const w = previewWidth;
    const h = previewHeight;
    if (!(w > 0 && h > 0)) {
      return { width: PREVIEW_BOUND_W, height: PREVIEW_BOUND_H };
    }
    const scale = Math.min(PREVIEW_BOUND_W / w, PREVIEW_BOUND_H / h);
    let width = Math.max(1, Math.round(w * scale));
    let height = Math.max(1, Math.round((width * h) / w));
    if (height > PREVIEW_BOUND_H) {
      height = PREVIEW_BOUND_H;
      width = Math.max(1, Math.round((height * w) / h));
    }
    if (width > PREVIEW_BOUND_W) {
      width = PREVIEW_BOUND_W;
      height = Math.max(1, Math.round((width * h) / w));
    }
    return { width, height };
  });

  function formatTimeMs(seconds: number) {
    const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    const minutes = Math.floor(safe / 60);
    const remainingSeconds = safe - minutes * 60;
    const wholeSeconds = Math.floor(remainingSeconds);
    const millis = Math.floor((remainingSeconds - wholeSeconds) * 1000);
    const ss = String(wholeSeconds).padStart(2, '0');
    const mmm = String(millis).padStart(3, '0');
    return `${minutes}:${ss}.${mmm}`;
  }

  function formatSecondsInput(seconds: number) {
    const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    return safe.toFixed(3).replace(/\.?0+$/, '');
  }

  const timeSliderMax = $derived(
    durationSeconds > 0 ? durationSeconds : Math.max(30, effectiveTimeFinite + 1),
  );

  const timeSliderValue = $derived(clampNumber(effectiveTimeFinite, 0, timeSliderMax));
  const timeInputValue = $derived(formatSecondsInput(effectiveTimeFinite));

  const timeHint = $derived(
    durationSeconds > 0
      ? `${formatTimeMs(effectiveTimeFinite)} / ${formatTimeMs(durationSeconds)}`
      : formatTimeMs(effectiveTimeFinite),
  );

  $effect(() => {
    if (!visible) return;
    if (!renderPreviewFrame) return;
    // Important: read reactive inputs synchronously so the effect reruns when they change.
    const targetTimeSeconds = effectiveTimeFinite;
    const targetWidth = previewWidth;
    const targetHeight = previewHeight;

    const currentToken = ++previewToken;
    const pending = window.setTimeout(async () => {
      previewLoading = true;
      previewError = null;

      const safeW = Math.max(1, Math.round(targetWidth));
      const safeH = Math.max(1, Math.round(targetHeight));

      try {
        const canvas = await renderPreviewFrame({
          timeSeconds: targetTimeSeconds,
          targetWidth: safeW,
          targetHeight: safeH,
        });

        if (currentToken !== previewToken) return;

        if (!canvas) {
          previewError = 'Preview unavailable.';
          return;
        }

        if (previewCanvasMounted !== canvas) {
          previewHostEl?.replaceChildren(canvas);
          previewCanvasMounted = canvas;
        }
      } catch {
        if (currentToken !== previewToken) return;
        previewError = 'Preview unavailable.';
      } finally {
        if (currentToken !== previewToken) return;
        previewLoading = false;
      }
    }, 60);

    return () => {
      window.clearTimeout(pending);
    };
  });

  function clampNumber(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
  }

  function presetPixelSize(preset: Exclude<ResolutionPreset, 'custom'>): [number, number] {
    switch (preset) {
      case '3840x2160':
        return [3840, 2160];
      case '2560x1440':
        return [2560, 1440];
      case '1920x1080':
        return [1920, 1080];
      case '1280x720':
        return [1280, 720];
      case '2048x2048':
        return [2048, 2048];
      case '1600x1600':
        return [1600, 1600];
      case '1080x1080':
        return [1080, 1080];
      default: {
        const _exhaustive: never = preset;
        return _exhaustive;
      }
    }
  }

  function setResolutionPreset(preset: ResolutionPreset) {
    resolutionPreset = preset;
    if (preset !== 'custom') {
      const [w, h] = presetPixelSize(preset);
      customWidth = w;
      customHeight = h;
    }
  }

  const showQuality = $derived(format === 'jpeg' || format === 'webp');
  const qualityPercent = $derived(Math.round(clampNumber(quality, 0, 1) * 100));
  const qualityHintText = $derived(
    format === 'png' ? '100% (lossless)' : showQuality ? `${qualityPercent}%` : '—',
  );

  function tryConfirm() {
    errorMessage = '';

    const [width, height] =
      resolutionPreset === 'custom'
        ? [
            clampNumber(customWidth || DEFAULT_WIDTH, 1, EXPORT_DIMENSION_MAX),
            clampNumber(customHeight || DEFAULT_HEIGHT, 1, EXPORT_DIMENSION_MAX),
          ]
        : presetPixelSize(resolutionPreset);

    const effectiveTimeSeconds = effectiveTime;

    if (!Number.isFinite(effectiveTimeSeconds)) {
      errorMessage = 'Time must be a number.';
      return;
    }

    const frameSelection: FrameSelection = {
      mode: 'time',
      timeSeconds: Math.max(0, effectiveTimeSeconds),
    };

    const q = clampNumber(quality || DEFAULT_QUALITY, 0, 1);

    const payload: ImageExportConfirmPayload = showQuality
      ? { ...frameSelection, width, height, format, quality: q }
      : { ...frameSelection, width, height, format };

    onConfirm?.(payload);
    onClose?.();
  }
</script>

<ModalDialog
  open={visible}
  onClose={onClose}
  showHeaderClose={true}
  class="image-export-dialog"
  title="Export image"
  titleId="image-export-dialog-title"
  secondaryLabel="Cancel"
  secondaryVariant="ghost"
  onSecondary={onClose}
  primaryLabel="Export"
  primaryVariant="warning"
  onPrimary={tryConfirm}
  bodyClass="export-panel"
>
  <Message inline variant="info" class="export-info-callout">
    Your image will not contain audio-driven visuals.
  </Message>

  {#if errorMessage}
    <div class="error" role="alert">{errorMessage}</div>
  {/if}

  {#if renderPreviewFrame}
    <div class="settingRow settingRowFullWidth">
      <div class="settingControls previewTimeControls">
        <div class="previewTimeColumn">
          <div class="preview-bounds">
            <div
              class="preview-frame"
              style="width: {previewFramePx.width}px; height: {previewFramePx.height}px;"
            >
              <div
                bind:this={previewHostEl}
                class="preview-host"
                class:is-loading={previewLoading}
                role="img"
                aria-label="Preview of the frame to export"
              ></div>
            </div>
          </div>

          {#if previewError}
            <div class="error preview-error" role="alert">{previewError}</div>
          {/if}

          <div class="timeScrubberRow" role="group" aria-label="Time scrubber">
            <Slider
              min={0}
              max={timeSliderMax}
              step={0.01}
              value={timeSliderValue}
              aria-label="Time (seconds)"
              oninput={(e: Event) => {
                const el = e.currentTarget as HTMLInputElement;
                timeSeconds = el.valueAsNumber;
              }}
            />
          </div>

          <div class="timeInputRow" role="group" aria-label="Time input">
            <Input
              size="sm"
              type="number"
              value={timeInputValue}
              oninput={(e: Event) => {
                const v = (e.target as HTMLInputElement).value;
                timeSeconds = v === '' ? null : parseFloat(v);
              }}
              min={0}
              step={0.01}
              aria-label="Time (seconds)"
              class="input-narrow"
            />
            <div class="time-hint" aria-live="polite">{timeHint}</div>
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if !renderPreviewFrame}
    <div class="settingRow">
      <div class="settingLabel" id="image-export-time-label">
        Time
        <div class="time-hint" aria-live="polite">{timeHint}</div>
      </div>
      <div class="settingControls">
        <div class="time-row" role="group" aria-labelledby="image-export-time-label">
          <Slider
            min={0}
            max={timeSliderMax}
            step={0.01}
            value={timeSliderValue}
            aria-label="Time (seconds)"
            oninput={(e: Event) => {
              const el = e.currentTarget as HTMLInputElement;
              timeSeconds = el.valueAsNumber;
            }}
          />
          <Input
            size="sm"
            type="number"
            value={timeInputValue}
            oninput={(e: Event) => {
              const v = (e.target as HTMLInputElement).value;
              timeSeconds = v === '' ? null : parseFloat(v);
            }}
            min={0}
            step={0.01}
            aria-label="Time (seconds)"
            class="input-narrow"
          />
        </div>
      </div>
    </div>
  {/if}

  <div class="settingRow">
    <div class="settingLabel" id="image-export-resolution-label">
      Resolution
      <div class="resolution-hint" aria-live="polite">{customWidth}×{customHeight}</div>
    </div>
    <div class="settingControls">
      <div class="tag-container export-pills" role="group" aria-labelledby="image-export-resolution-label">
        <Tag interactive selected={resolutionPreset === '3840x2160'} onclick={() => setResolutionPreset('3840x2160')}>
          4K
        </Tag>
        <Tag interactive selected={resolutionPreset === '2560x1440'} onclick={() => setResolutionPreset('2560x1440')}>
          1440p
        </Tag>
        <Tag interactive selected={resolutionPreset === '1920x1080'} onclick={() => setResolutionPreset('1920x1080')}>
          1080p
        </Tag>
        <Tag interactive selected={resolutionPreset === '1280x720'} onclick={() => setResolutionPreset('1280x720')}>
          720p
        </Tag>
        <Tag interactive selected={resolutionPreset === '2048x2048'} onclick={() => setResolutionPreset('2048x2048')}>
          Square XL
        </Tag>
        <Tag interactive selected={resolutionPreset === '1600x1600'} onclick={() => setResolutionPreset('1600x1600')}>
          Square
        </Tag>
        <Tag interactive selected={resolutionPreset === '1080x1080'} onclick={() => setResolutionPreset('1080x1080')}>
          Square HD
        </Tag>
        <Tag interactive selected={resolutionPreset === 'custom'} onclick={() => setResolutionPreset('custom')}>
          Custom
        </Tag>
      </div>

      {#if resolutionPreset === 'custom'}
        <div class="custom-resolution" role="group" aria-label="Custom resolution">
          <Input
            size="sm"
            type="number"
            value={String(customWidth)}
            oninput={(e: Event) =>
              (customWidth = parseInt((e.target as HTMLInputElement).value, 10) || DEFAULT_WIDTH)}
            placeholder="Width"
            aria-label="Width"
            min={1}
            max={EXPORT_DIMENSION_MAX}
          />
          <Input
            size="sm"
            type="number"
            value={String(customHeight)}
            oninput={(e: Event) =>
              (customHeight = parseInt((e.target as HTMLInputElement).value, 10) || DEFAULT_HEIGHT)}
            placeholder="Height"
            aria-label="Height"
            min={1}
            max={EXPORT_DIMENSION_MAX}
          />
        </div>
      {/if}
    </div>
  </div>

  <div class="settingRow">
    <div class="settingLabel" id="image-export-format-label">Format</div>
    <div class="settingControls">
      <div class="tag-container export-pills" role="group" aria-labelledby="image-export-format-label">
        <Tag interactive selected={format === 'png'} onclick={() => (format = 'png')}>PNG</Tag>
        <Tag interactive selected={format === 'jpeg'} onclick={() => (format = 'jpeg')}>JPEG</Tag>
        <Tag interactive selected={format === 'webp'} onclick={() => (format = 'webp')}>WEBP</Tag>
      </div>
    </div>
  </div>

  <div class="settingRow">
    <div class="settingLabel" id="image-export-quality-label">
      Quality
      <div class="quality-hint" aria-live="polite">{qualityHintText}</div>
    </div>
    <div class="settingControls">
      <div class="quality-row" role="group" aria-labelledby="image-export-quality-label">
        <Slider
          min={0}
          max={1}
          step={0.01}
          value={clampNumber(quality, 0, 1)}
          disabled={!showQuality}
          aria-label="Quality"
          oninput={(e: Event) => {
            const el = e.currentTarget as HTMLInputElement;
            quality = el.valueAsNumber;
          }}
        />
      </div>
    </div>
  </div>
</ModalDialog>

<style>
  /* Modal content - :global required for Modal portal */
  :global(.image-export-dialog.content.frame) {
    :global(.modal-dialog-body.export-panel) {
      padding: 0;
      gap: 0;
    }

    :global(.modal-dialog-body.export-panel .modal-dialog-body-scroll) {
      padding: var(--pd-lg);
      gap: var(--pd-md);
    }

    :global(.export-info-callout) {
      margin-bottom: var(--pd-md);
      padding: var(--pd-sm) var(--pd-md);
    }

    .settingRow {
      display: grid;
      grid-template-columns: minmax(0, 90px) minmax(0, 1fr);
      align-items: start;
      column-gap: var(--pd-lg);
      row-gap: var(--pd-xs);
    }

    .settingRow.settingRowFullWidth {
      grid-template-columns: minmax(0, 1fr);
    }

    :global(.modal-dialog-body.export-panel .modal-dialog-body-scroll) > .settingRow + .settingRow {
      border-top: 1px solid var(--divider);
      padding-top: var(--pd-md);
      margin-top: var(--pd-md);
    }

    .settingLabel {
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--label-color);
      letter-spacing: 0;
      line-height: 1.2;
      padding-top: 2px;
    }

    .settingControls {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: flex-start;
      gap: var(--pd-md);
      min-width: 0;
    }

    .settingControls.previewTimeControls {
      align-items: stretch;
    }

    @media (max-width: 420px) {
      .settingRow {
        grid-template-columns: 1fr;
      }
      .settingLabel {
        padding-top: 0;
      }
    }

    .error {
      font-size: var(--text-sm);
      color: var(--color-red-90);
      padding: var(--pd-sm) var(--pd-md);
      border-radius: var(--radius-sm);
      border: 1px solid color-mix(in srgb, var(--color-red-90) 40%, transparent);
      background: color-mix(in srgb, var(--color-red-80) 25%, transparent);
    }

    :global(.tag-container.export-pills) {
      gap: var(--pd-xs);
    }

    :global(.tag-container.export-pills .tag) {
      letter-spacing: 0;
    }

    .custom-resolution {
      display: flex;
      gap: var(--pd-sm);
      align-items: center;
      box-sizing: border-box;
    }

    .custom-resolution :global(.input) {
      flex: 1;
      min-width: 0;
    }

    .resolution-hint,
    .quality-hint {
      font-size: var(--text-xs);
      color: var(--color-yellow-100);
      font-variant-numeric: tabular-nums;
      margin-top: var(--pd-xs);
    }

    :global(.input-narrow.input) {
      width: min(70px, 100%);
      box-sizing: border-box;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .preview-bounds {
      width: 100%;
      max-width: 360px;
      height: 240px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-gray-30);
      margin: 0 auto;
    }

    .previewTimeColumn {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: var(--pd-md);
    }

    .preview-frame {
      box-sizing: border-box;
      flex: 0 0 auto;
      margin: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-gray-50);
      overflow: hidden;
    }

    .preview-host {
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      width: 100%;
      height: 100%;
    }

    .preview-host :global(canvas) {
      display: block;
      /* Canvas CSS sizing stretches the bitmap; keep intrinsic aspect and only scale down. */
      width: auto;
      height: auto;
      max-width: 100%;
      max-height: 100%;
    }

    .preview-host.is-loading::after {
      content: 'Updating…';
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      font-size: var(--text-xs);
      color: var(--color-gray-80);
      opacity: 0.8;
      pointer-events: none;
    }

    .time-row {
      display: flex;
      align-items: center;
      gap: var(--pd-md);
      width: 100%;
    }

    .timeScrubberRow {
      width: 100%;
    }

    .timeInputRow {
      display: flex;
      align-items: baseline;
      gap: var(--pd-md);
      width: 100%;
    }

    .time-hint {
      font-size: var(--text-xs);
      color: var(--color-yellow-100);
      font-variant-numeric: tabular-nums;
      margin-top: var(--pd-xs);
    }

    .quality-row {
      width: 100%;
      display: flex;
      align-items: center;
      gap: var(--pd-md);
    }
  }
</style>


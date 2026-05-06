<script lang="ts">
  import type { Action } from 'svelte/action';
  import { Button, Input, Message, ModalDialog, RangeSlider, Tag } from '../ui';
  import Toggle from '../node/parameters/Toggle.svelte';
  import { type Readable } from 'svelte/store';

  const DEFAULT_FRAME_RATE = 120;
  const DEFAULT_WIDTH = 1920;
  const DEFAULT_HEIGHT = 1080;
  const DEFAULT_DURATION = 10;
  const DEFAULT_VIDEO_BITRATE_MBPS = 50;
  const DEFAULT_TIME_RANGE_STEP_SECONDS = 0.01;
  const DEFAULT_KEYFRAME_INTERVAL_SECONDS = 2;
  const KEYFRAME_INTERVAL_SECONDS_MIN = 0.5;
  const KEYFRAME_INTERVAL_SECONDS_MAX = 10;

  type ResolutionPreset =
    | '3840x2160'
    | '2560x1440'
    | '1920x1080'
    | '1280x720'
    | '1920x1920'
    | '1080x1080'
    | '1080x1920'
    | '720x1280'
    | 'custom';

  const VIDEO_BITRATE_PRESET_MBPS = [50, 25, 10, 5] as const;
  type BitratePreset = (typeof VIDEO_BITRATE_PRESET_MBPS)[number] | 'custom';

  function mbpsToInitialBitratePreset(mbps: number): BitratePreset {
    for (const v of VIDEO_BITRATE_PRESET_MBPS) {
      if (v === mbps) return v;
    }
    return 'custom';
  }

  export interface VideoExportConfig {
    width: number;
    height: number;
    maxDurationSeconds: number;
    useFullAudio: boolean;
    /** Start time (seconds) relative to the primary track. */
    startSeconds?: number;
    /** End time (seconds) relative to the primary track. */
    endSeconds?: number;
    allowVideoOnly: boolean;
    videoBitrate?: number;
    audioBitrate?: number;
    frameRate: number;
    videoBitrateMode?: 'vbr' | 'cbr';
    keyFrameIntervalSeconds?: number;
    hardwareAcceleration?: 'no-preference' | 'prefer-software' | 'prefer-hardware';
    latencyMode?: 'quality' | 'realtime';
    contentHint?: 'detail' | 'motion' | 'text' | 'none';
  }

  /** When no audio: primaryNodeId, buffer, audioDurationSeconds are omitted. */
  type VideoExportConfirmPayload = VideoExportConfig & {
    primaryNodeId?: string;
    buffer?: AudioBuffer;
    audioDurationSeconds?: number;
  };

  type Step = 'config' | 'progress';
  type ProgressValue = { current: number; total: number };

  interface Props {
    visible?: boolean;
    onClose?: () => void;
    onConfirm?: (config: VideoExportConfirmPayload) => void;
    getPrimaryAudio?: () => { nodeId: string; buffer: AudioBuffer } | null;
    progress?: Readable<ProgressValue>;
    onCancelExport?: () => void;
  }

  let {
    visible = false,
    onClose,
    onConfirm,
    getPrimaryAudio = () => null,
    progress,
    onCancelExport,
  }: Props = $props();

  let step = $state<Step>('config');

  let resolutionPreset = $state<ResolutionPreset>('1920x1080');
  let customWidth = $state(DEFAULT_WIDTH);
  let customHeight = $state(DEFAULT_HEIGHT);
  let duration = $state(DEFAULT_DURATION);
  let useFullAudio = $state(false);
  let allowVideoOnly = $state(false);
  let bitrateMbps = $state(DEFAULT_VIDEO_BITRATE_MBPS);
  let bitratePreset = $state<BitratePreset>(mbpsToInitialBitratePreset(DEFAULT_VIDEO_BITRATE_MBPS));
  let videoBitrateMode = $state<'vbr' | 'cbr'>('vbr');
  let keyFrameIntervalSeconds = $state(DEFAULT_KEYFRAME_INTERVAL_SECONDS);
  let hardwareAcceleration = $state<'no-preference' | 'prefer-software' | 'prefer-hardware'>('prefer-software');
  let latencyMode = $state<'quality' | 'realtime'>('quality');
  let contentHint = $state<'detail' | 'motion' | 'text' | 'none'>('detail');
  let fps = $state(DEFAULT_FRAME_RATE);
  let errorMessage = $state('');

  const primary = $derived(getPrimaryAudio());
  const durationPlaceholder = $derived(primary ? `Audio length: ${primary.buffer.duration.toFixed(1)}s` : 'No audio — export will be video only');

  let rangeStartSeconds = $state(0);
  let rangeEndSeconds = $state(DEFAULT_DURATION);

  let progressValue = $state<ProgressValue>({ current: 0, total: 0 });

  function formatCountdown(totalSeconds: number): string {
    if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '—';
    const s = Math.max(0, Math.round(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      : `${m}:${String(sec).padStart(2, '0')}`;
  }

  type SpeedState = {
    startMs: number | null;
    lastMs: number | null;
    lastFrame: number;
    emaFps: number | null;
  };

  // Keep this non-reactive to avoid effect feedback loops.
  let speed: SpeedState = { startMs: null, lastMs: null, lastFrame: 0, emaFps: null };
  let remainingSeconds = $state<number | null>(null);
  let remainingText = $derived(remainingSeconds == null ? '~:~~' : formatCountdown(remainingSeconds));

  let cancelClicked = $state(false);

  const progressPercent = $derived.by(() => {
    const { current, total } = progressValue;
    if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 0) return 0;
    return Math.max(0, Math.min(1, current / total));
  });

  const dialogTitle = $derived(step === 'config' ? 'Export video' : 'Exporting video…');
  const dialogClass = $derived(
    step === 'config'
      ? 'video-export-dialog video-export-dialog--config'
      : 'video-export-dialog video-export-dialog--progress',
  );
  const dialogBodyClass = $derived(step === 'config' ? 'export-panel' : 'export-progress-panel');

  const primaryAudioDigest = $derived(
    primary ? `${primary.nodeId}:${primary.buffer.duration}` : '',
  );

  const clampExportRangeToPrimary: Action<
    HTMLElement,
    {
      audioDigest: string;
      durationSeconds: number;
      useFullAudio: boolean;
      durationInput: number;
      getStart: () => number;
      getEnd: () => number;
      setStart: (n: number) => void;
      setEnd: (n: number) => void;
    }
  > = (_node, _p) => ({
    update(p) {
      void p.audioDigest;
      const d = p.durationSeconds;
      if (!Number.isFinite(d) || d <= 0) return;
      if (p.useFullAudio) {
        p.setStart(0);
        p.setEnd(d);
        return;
      }
      let rs = Math.max(0, Math.min(d, p.getStart()));
      let re = Math.max(rs, Math.min(d, p.getEnd()));
      if (rs === 0 && re === DEFAULT_DURATION) {
        re = Math.min(d, p.durationInput || DEFAULT_DURATION);
      }
      p.setStart(rs);
      p.setEnd(re);
    },
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
      case '1920x1920':
        return [1920, 1920];
      case '1080x1080':
        return [1080, 1080];
      case '1080x1920':
        return [1080, 1920];
      case '720x1280':
        return [720, 1280];
      default: {
        const _exhaustive: never = preset;
        return _exhaustive;
      }
    }
  }

  function tryConfirm() {
    errorMessage = '';
    const primaryNow = getPrimaryAudio();
    const [width, height] =
      resolutionPreset === 'custom'
        ? [
            Math.max(1, Math.min(4096, customWidth || DEFAULT_WIDTH)),
            Math.max(1, Math.min(4096, customHeight || DEFAULT_HEIGHT)),
          ]
        : presetPixelSize(resolutionPreset);
    const videoBitrate = Math.max(1_000_000, Math.min(100_000_000, Math.round((bitrateMbps || DEFAULT_VIDEO_BITRATE_MBPS) * 1_000_000)));
    const clampedKeyFrameIntervalSeconds = clampNumber(
      keyFrameIntervalSeconds || DEFAULT_KEYFRAME_INTERVAL_SECONDS,
      KEYFRAME_INTERVAL_SECONDS_MIN,
      KEYFRAME_INTERVAL_SECONDS_MAX,
    );

    if (primaryNow) {
      const { nodeId: primaryNodeId, buffer } = primaryNow;
      const clampedStart = useFullAudio ? 0 : Math.max(0, Math.min(buffer.duration, rangeStartSeconds));
      const clampedEnd = useFullAudio
        ? buffer.duration
        : Math.max(clampedStart, Math.min(buffer.duration, rangeEndSeconds));
      const rangeDuration = Math.max(0.01, clampedEnd - clampedStart);
      // With audio loaded, the selected range is the source of truth for export length.
      const maxDurationSeconds = useFullAudio ? buffer.duration : rangeDuration;
      onConfirm?.({
        width,
        height,
        maxDurationSeconds,
        useFullAudio,
        startSeconds: useFullAudio ? 0 : clampedStart,
        endSeconds: useFullAudio ? buffer.duration : clampedEnd,
        allowVideoOnly: false,
        videoBitrate,
        videoBitrateMode,
        audioBitrate: 192_000,
        frameRate: fps,
        keyFrameIntervalSeconds: clampedKeyFrameIntervalSeconds,
        hardwareAcceleration,
        latencyMode,
        contentHint,
        primaryNodeId,
        buffer,
        audioDurationSeconds: buffer.duration,
      });
    } else {
      if (!allowVideoOnly) {
        errorMessage = 'No audio loaded. Load a track first, or turn on "Video only".';
        return;
      }
      const maxDuration = duration || DEFAULT_DURATION;
      onConfirm?.({
        width,
        height,
        maxDurationSeconds: maxDuration,
        useFullAudio: false,
        allowVideoOnly: true,
        videoBitrate,
        videoBitrateMode,
        audioBitrate: 192_000,
        frameRate: fps,
        keyFrameIntervalSeconds: clampedKeyFrameIntervalSeconds,
        hardwareAcceleration,
        latencyMode,
        contentHint,
      });
    }
    cancelClicked = false;
    progressValue = { current: 0, total: 0 };
    speed = { startMs: null, lastMs: null, lastFrame: 0, emaFps: null };
    remainingSeconds = null;
    step = 'progress';
  }

  function setResolutionPreset(preset: ResolutionPreset) {
    resolutionPreset = preset;
    // Only snap inputs for presets; keep existing custom values when switching to 'custom'
    if (preset !== 'custom') {
      const [w, h] = presetPixelSize(preset);
      customWidth = w;
      customHeight = h;
    }
  }

  function setFps(value: number) {
    fps = value;
  }

  function setBitratePreset(preset: BitratePreset) {
    bitratePreset = preset;
    if (preset !== 'custom') {
      bitrateMbps = preset;
    }
  }

  /** User-adjusted range implies a clip, not the full track. */
  function handleExportRangeChange(low: number, high: number) {
    useFullAudio = false;
    rangeStartSeconds = low;
    rangeEndSeconds = high;
  }

  function handleCancelExport() {
    if (cancelClicked) return;
    cancelClicked = true;
    onCancelExport?.();
  }

  $effect(() => {
    if (step !== 'progress') {
      progressValue = { current: 0, total: 0 };
      speed = { startMs: null, lastMs: null, lastFrame: 0, emaFps: null };
      remainingSeconds = null;
      cancelClicked = false;
      return;
    }

    if (!progress) return;
    let lastRemainingUiMs = 0;
    const unsub = progress.subscribe((v) => {
      const now = performance.now();
      if (speed.startMs == null) {
        speed = { startMs: now, lastMs: now, lastFrame: v.current, emaFps: null };
      } else if (v.current > speed.lastFrame && speed.lastMs != null) {
        const dt = (now - speed.lastMs) / 1000;
        const df = v.current - speed.lastFrame;
        if (dt > 0 && df > 0) {
          const instFps = df / dt;
          const alpha = 0.25;
          const nextEma = speed.emaFps == null ? instFps : speed.emaFps * (1 - alpha) + instFps * alpha;
          speed = { ...speed, lastMs: now, lastFrame: v.current, emaFps: nextEma };
        } else {
          speed = { ...speed, lastMs: now, lastFrame: v.current };
        }
      } else {
        speed = { ...speed, lastMs: now, lastFrame: v.current };
      }

      progressValue = v;

      const { current, total } = v;
      const fpsNow = speed.emaFps;
      const canCompute =
        total > 0 && fpsNow != null && fpsNow > 0.001 && current >= 0 && current <= total;
      const nextRemaining = canCompute ? (total - current) / fpsNow : null;
      const doneOrEstimate = !canCompute || current >= total;
      if (doneOrEstimate || now - lastRemainingUiMs >= 1000) {
        lastRemainingUiMs = now;
        remainingSeconds = nextRemaining;
      }
    });
    return unsub;
  });
</script>

<!--
  Layout: header + footer on modal `.frame` surface; single full-width `frame-elevated` card in `.main` (AudioSignalPicker pattern).
-->
{#snippet progressFooter()}
  <div class="video-export-progress-footer">
    <Button variant="warning" size="md" disabled={cancelClicked} onclick={handleCancelExport}>
      {cancelClicked ? 'Cancelling…' : 'Cancel export'}
    </Button>
  </div>
{/snippet}

<ModalDialog
  open={visible}
  onClose={step === 'config' ? onClose : undefined}
  showHeaderClose={step === 'config'}
  class={dialogClass}
  title={dialogTitle}
  titleId="video-export-dialog-title"
  secondaryLabel={step === 'config' ? 'Later' : undefined}
  secondaryVariant="ghost"
  onSecondary={step === 'config' ? onClose : undefined}
  primaryLabel={step === 'config' ? 'Export Video' : undefined}
  primaryVariant="warning"
  onPrimary={step === 'config' ? tryConfirm : undefined}
  bodyClass={dialogBodyClass}
  footer={step === 'progress' ? progressFooter : undefined}
>
  {#if step === 'config'}
    <span
      class="video-export-range-sync"
      aria-hidden="true"
      use:clampExportRangeToPrimary={{
        audioDigest: primaryAudioDigest,
        durationSeconds: primary?.buffer.duration ?? 0,
        useFullAudio,
        durationInput: duration,
        getStart: () => rangeStartSeconds,
        getEnd: () => rangeEndSeconds,
        setStart: (n) => {
          rangeStartSeconds = n;
        },
        setEnd: (n) => {
          rangeEndSeconds = n;
        },
      }}
    ></span>
    {#if errorMessage}
      <div class="error" role="alert">{errorMessage}</div>
    {/if}

    {#if primary && primary.buffer.duration > 0}
      <div class="duration-range">
        <div class="time-range-row">
          <div class="time-range-label">Start</div>
          <div class="time-range-value">{rangeStartSeconds.toFixed(2)}s</div>
          <div class="time-range-spacer"></div>
          <div class="time-range-label">End</div>
          <div class="time-range-value">{rangeEndSeconds.toFixed(2)}s</div>
        </div>
        <RangeSlider
          min={0}
          max={primary.buffer.duration}
          step={DEFAULT_TIME_RANGE_STEP_SECONDS}
          lowValue={rangeStartSeconds}
          highValue={rangeEndSeconds}
          disabled={useFullAudio}
          class="time-range-slider"
          onChange={({ low, high }) => handleExportRangeChange(low, high)}
        />
        <div class="time-range-row secondary">
          <div class="time-range-label">Window</div>
          <div class="time-range-value">{Math.max(0, rangeEndSeconds - rangeStartSeconds).toFixed(2)}s</div>
          <div class="time-range-spacer"></div>
          <div class="time-range-label">Track</div>
          <div class="time-range-value">{primary.buffer.duration.toFixed(2)}s</div>
        </div>
      </div>
    {:else}
      <Input
        type="number"
        value={String(duration)}
        oninput={(e: Event) =>
          (duration = parseFloat((e.target as HTMLInputElement).value) || DEFAULT_DURATION)}
        placeholder={durationPlaceholder}
        min={0.1}
        step={0.1}
        class="input-full"
      />
    {/if}

    <div class="toggle-row-split" role="group" aria-label="Export audio options">
      <div class="toggle-row">
        <Toggle
          labelledBy="video-export-label-full-audio"
          value={useFullAudio ? 1 : 0}
          onChange={(v) => (useFullAudio = v === 1)}
        />
        <span id="video-export-label-full-audio" class="toggle-label">Full export</span>
      </div>
      <div class="toggle-row">
        <Toggle
          labelledBy="video-export-label-video-only"
          value={allowVideoOnly ? 1 : 0}
          onChange={(v) => (allowVideoOnly = v === 1)}
        />
        <span id="video-export-label-video-only" class="toggle-label">Video only</span>
      </div>
    </div>

    <div class="panel-divider" aria-hidden="true"></div>
  {:else}
    <div class="progress-shell" aria-live="polite">
      <div class="progress-meta">
        <div class="progress-frames">
          Frame <span class="mono">{progressValue.current}</span> / <span class="mono">{progressValue.total}</span>
        </div>
        <div class="progress-right">
          <div class="eta-inline">
            <span class="eta-label">ETA</span> <span class="mono">{remainingText}s</span>
          </div>
          <div class="progress-percent">
            <span class="mono">{Math.round(progressPercent * 100)}%</span>
          </div>
        </div>
      </div>

      <div
        class="progress-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progressPercent * 100)}
      >
        <div class="progress-bar-track">
          <div class="progress-bar-fill" style={`--progress-fill:${progressPercent * 100}%`}></div>
        </div>
      </div>
    </div>
    {#snippet importantHeading()}Keep this tab focused{/snippet}
    <Message inline variant="info" heading={importantHeading} class="focus-message" hideIcon={true}>
      Keep this browser tab in focus. If you switch tabs or minimize the window, export can become very slow and audio may go out of sync.
    </Message>
    {/if}

  {#if step === 'config'}
  <div class="settingRow">
      <div class="settingLabel" id="video-export-content-hint-label">Quality</div>
      <div class="settingControls">
        <div class="tag-container export-pills" role="group" aria-labelledby="video-export-content-hint-label">
          <Tag interactive selected={contentHint === 'detail'} onclick={() => (contentHint = 'detail')}>
            Detail
          </Tag>
          <Tag interactive selected={contentHint === 'motion'} onclick={() => (contentHint = 'motion')}>
            Motion
          </Tag>
          <Tag interactive selected={contentHint === 'text'} onclick={() => (contentHint = 'text')}>
            Text
          </Tag>
          <Tag interactive selected={contentHint === 'none'} onclick={() => (contentHint = 'none')}>
            Auto
          </Tag>
        </div>
      </div>
  </div>

    <div class="settingRow">
      <div class="settingLabel" id="video-export-resolution-label">
        Resolution
        <div class="resolution-hint" aria-live="polite">{customWidth}×{customHeight}</div>
      </div>
      <div class="settingControls">
        <div class="tag-container export-pills" role="group" aria-labelledby="video-export-resolution-label">
          <Tag
            interactive
            selected={resolutionPreset === '3840x2160'}
            onclick={() => setResolutionPreset('3840x2160')}
          >
            4K
          </Tag>
          <Tag
            interactive
            selected={resolutionPreset === '2560x1440'}
            onclick={() => setResolutionPreset('2560x1440')}
          >
            1440p
          </Tag>
          <Tag
            interactive
            selected={resolutionPreset === '1920x1080'}
            onclick={() => setResolutionPreset('1920x1080')}
          >
            1080p
          </Tag>
          <Tag interactive selected={resolutionPreset === '1280x720'} onclick={() => setResolutionPreset('1280x720')}>
            720p
          </Tag>
          <Tag
            interactive
            selected={resolutionPreset === '1920x1920'}
            onclick={() => setResolutionPreset('1920x1920')}
          >
            Square HD
          </Tag>
          <Tag
            interactive
            selected={resolutionPreset === '1080x1080'}
            onclick={() => setResolutionPreset('1080x1080')}
          >
            Square
          </Tag>
          <Tag
            interactive
            selected={resolutionPreset === '1080x1920'}
            onclick={() => setResolutionPreset('1080x1920')}
          >
            Vertical HD
          </Tag>
          <Tag interactive selected={resolutionPreset === '720x1280'} onclick={() => setResolutionPreset('720x1280')}>
            Vertical
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
              max={4096}
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
              max={4096}
            />
          </div>
        {/if}
      </div>
    </div>

    <div class="settingRow">
      <div class="settingLabel" id="video-export-fps-label">Frames</div>
      <div class="settingControls">
        <div class="tag-container export-pills" role="group" aria-labelledby="video-export-fps-label">
          <Tag interactive selected={fps === 120} onclick={() => setFps(120)}>120 fps</Tag>
          <Tag interactive selected={fps === 60} onclick={() => setFps(60)}>60 fps</Tag>
          <Tag interactive selected={fps === 50} onclick={() => setFps(50)}>50 fps</Tag>
          <Tag interactive selected={fps === 30} onclick={() => setFps(30)}>30 fps</Tag>
          <Tag interactive selected={fps === 25} onclick={() => setFps(25)}>25 fps</Tag>
          <Tag interactive selected={fps === 24} onclick={() => setFps(24)}>24 fps</Tag>
        </div>
      </div>
    </div>

    <div class="settingRow">
      <div class="settingLabel" id="video-export-video-bitrate-label">Bitrate</div>
      <div class="settingControls">
        <div class="tag-container export-pills" role="group" aria-labelledby="video-export-video-bitrate-label">
          {#each VIDEO_BITRATE_PRESET_MBPS as mbps (mbps)}
            <Tag interactive selected={bitratePreset === mbps} onclick={() => setBitratePreset(mbps)}>
              {mbps} Mbps
            </Tag>
          {/each}
          <Tag interactive selected={bitratePreset === 'custom'} onclick={() => setBitratePreset('custom')}>
            Custom
          </Tag>
        </div>
        {#if bitratePreset === 'custom'}
          <Input
            size="sm"
            type="number"
            value={String(bitrateMbps)}
            oninput={(e: Event) =>
              (bitrateMbps = parseFloat((e.target as HTMLInputElement).value) || DEFAULT_VIDEO_BITRATE_MBPS)}
            placeholder={String(DEFAULT_VIDEO_BITRATE_MBPS)}
            min={1}
            max={100}
            aria-label="Custom video bitrate"
            class="input-narrow"
          />
        {/if}
      </div>
    </div>

    <div class="settingRow">
      <div class="settingLabel" id="video-export-video-bitrate-mode-label">Mode</div>
      <div class="settingControls">
        <div class="tag-container export-pills" role="group" aria-labelledby="video-export-video-bitrate-mode-label">
          <Tag interactive selected={videoBitrateMode === 'vbr'} onclick={() => (videoBitrateMode = 'vbr')}>
            VBR
          </Tag>
          <Tag interactive selected={videoBitrateMode === 'cbr'} onclick={() => (videoBitrateMode = 'cbr')}>
            CBR
          </Tag>
        </div>
      </div>
    </div>

    <div class="settingRow">
      <div class="settingLabel" id="video-export-hardware-acceleration-label">Acceleration</div>
      <div class="settingControls">
        <div class="tag-container export-pills" role="group" aria-labelledby="video-export-hardware-acceleration-label">
          <Tag
            interactive
            selected={hardwareAcceleration === 'prefer-software'}
            onclick={() => (hardwareAcceleration = 'prefer-software')}
          >
            Software
          </Tag>
          <Tag
            interactive
            selected={hardwareAcceleration === 'prefer-hardware'}
            onclick={() => (hardwareAcceleration = 'prefer-hardware')}
          >
            Hardware
          </Tag>
          <Tag
            interactive
            selected={hardwareAcceleration === 'no-preference'}
            onclick={() => (hardwareAcceleration = 'no-preference')}
          >
            Auto
          </Tag>
        </div>
      </div>
    </div>

    <div class="settingRow">
      <div class="settingLabel" id="video-export-latency-mode-label">Priority</div>
      <div class="settingControls">
        <div class="tag-container export-pills" role="group" aria-labelledby="video-export-latency-mode-label">
          <Tag interactive selected={latencyMode === 'quality'} onclick={() => (latencyMode = 'quality')}>
            Quality
          </Tag>
          <Tag interactive selected={latencyMode === 'realtime'} onclick={() => (latencyMode = 'realtime')}>
            Speed
          </Tag>
        </div>
      </div>
    </div>

    <div class="settingRow">
      <div class="settingLabel" id="video-export-keyframe-interval-label">Keyframe</div>
      <div class="settingControls">
        <Input
          size="sm"
          type="number"
          value={String(keyFrameIntervalSeconds)}
          oninput={(e: Event) =>
            (keyFrameIntervalSeconds = clampNumber(
              parseFloat((e.target as HTMLInputElement).value) || DEFAULT_KEYFRAME_INTERVAL_SECONDS,
              KEYFRAME_INTERVAL_SECONDS_MIN,
              KEYFRAME_INTERVAL_SECONDS_MAX,
            ))}
          min={KEYFRAME_INTERVAL_SECONDS_MIN}
          max={KEYFRAME_INTERVAL_SECONDS_MAX}
          step={0.1}
          aria-labelledby="video-export-keyframe-interval-label"
          class="input-narrow"
        />
      </div>
    </div>
  {/if}
</ModalDialog>

<style>
  .video-export-range-sync {
    display: none;
  }

  /* Modal content - :global required for Modal portal */
  /* Shell: panel header → scroll main (one elevated card, full width) → footer on frame bg. */
  :global(.video-export-dialog.content.frame) {
    /* `ModalDialog` owns base layout + padding reset. */

    /* Match list modals: body shell is flush; padding lives on the scroll surface (see ModalDialog body-scroll). */
    :global(.modal-dialog-body.export-panel),
    :global(.modal-dialog-body.export-progress-panel) {
      padding: 0;
      gap: 0;
    }

    :global(.modal-dialog-body.export-panel .modal-dialog-body-scroll),
    :global(.modal-dialog-body.export-progress-panel .modal-dialog-body-scroll) {
      padding: var(--pd-lg);
      gap: var(--pd-md);
    }

    .settingRow {
      display: grid;
      grid-template-columns: minmax(0, 90px) minmax(0, 1fr);
      align-items: start;
      column-gap: var(--pd-lg);
      row-gap: var(--pd-xs);
    }

    /* Dividers between settings rows. */
    :global(.modal-dialog-body.export-panel .modal-dialog-body-scroll) > .settingRow + .settingRow {
      border-top: 1px solid var(--divider);
      padding-top: var(--pd-md);
      margin-top: var(--pd-md);
    }

    .panel-divider {
      width: 100%;
      border-top: 1px solid var(--divider);
      margin: var(--pd-md) 0;
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

    /* On narrow dialog widths, collapse back to stacked label → controls. */
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

    .resolution-hint {
      font-size: var(--text-xs);
      color: var(--color-yellow-100);
      font-variant-numeric: tabular-nums;
      margin-top: var(--pd-xs);
    }

    .toggle-row-split {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: var(--pd-xl);
      width: 100%;
      box-sizing: border-box;
      padding-top: var(--pd-md);
    }

    .toggle-row {
      display: inline-flex;
      align-items: center;
      justify-content: flex-start;
      gap: var(--pd-sm);
      box-sizing: border-box;
      min-width: 0;
    }

    .toggle-label {
      min-width: 0;
      font-size: var(--text-sm);
      font-weight: 500;
      color: color-mix(in srgb, var(--color-gray-130) 90%, var(--color-gray-50));
      user-select: none;
      cursor: pointer;
    }

    .toggle-row :global(.toggle) {
      flex-shrink: 0;
    }

    /* Footer action row is provided by ModalDialog */

    :global(.input-full.input) {
      width: 100%;
      box-sizing: border-box;
    }

    :global(.input-narrow.input) {
      width: min(160px, 100%);
      box-sizing: border-box;
    }

    /* Flat block inside `frame-elevated` — no second inset card */
    .duration-range {
      display: flex;
      flex-direction: column;
      gap: var(--pd-sm);
      margin-bottom: var(--pd-md);
      --time-range-row-color: color-mix(in srgb, var(--color-gray-130) 88%, var(--color-gray-50));
      --time-range-row-muted: color-mix(in srgb, var(--color-gray-120) 85%, var(--color-gray-50));
    }

    .time-range-row {
      display: flex;
      align-items: baseline;
      gap: var(--pd-sm);
      font-size: var(--text-xs);
      color: var(--time-range-row-color);

      &.secondary {
        color: var(--time-range-row-muted);
      }
    }

    .time-range-label {
      min-width: 38px;
      color: inherit;
      font-weight: 600;
    }

    .time-range-value {
      font-variant-numeric: tabular-nums;
      color: inherit;
      font-weight: 500;
    }

    .time-range-spacer {
      flex: 1;
    }

    .duration-range :global(.range-slider.time-range-slider) {
      width: 100%;
      --range-slider-track-height: 60px;
      --range-slider-bg: color-mix(in srgb, var(--color-gray-30) 75%, black);
      --range-slider-track-color: color-mix(in srgb, var(--color-gray-110) 20%, transparent);
      --range-slider-active-color: color-mix(in srgb, var(--color-teal-100) 65%, transparent);
      --range-editor-handle-bg: var(--color-teal-100);
      --range-editor-handle-hover-bg: var(--color-teal-110);
      --range-editor-handle-active-bg: var(--color-teal-120);
    }

    .video-export-progress-footer {
      display: flex;
      justify-content: flex-end;
      width: 100%;
    }

    .progress-shell {
      display: flex;
      flex-direction: column;
      gap: var(--pd-md);
      min-height: 0;
    }

    .progress-meta {
      display: grid;
      grid-template-columns: minmax(0, 1fr) max-content;
      align-items: baseline;
      gap: var(--pd-md);
      min-width: 0;
    }

    .progress-frames {
      font-size: var(--text-sm);
      color: var(--color-gray-90);
      font-weight: 600;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .progress-right {
      display: grid;
      grid-template-columns: minmax(12ch, max-content) 6ch;
      align-items: baseline;
      justify-items: end;
      column-gap: var(--pd-md);
      flex-shrink: 0;
    }

    .progress-percent {
      font-size: var(--text-sm);
      color: var(--color-yellow-110);
      font-weight: 600;
      flex-shrink: 0;
      min-width: 6ch;
      text-align: right;
      white-space: nowrap;
    }

    .mono {
      font-variant-numeric: tabular-nums;
    }

    .progress-bar {
      width: 100%;
    }

    .progress-bar-track {
      width: 100%;
      height: 10px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--color-gray-30) 72%, black);
      overflow: hidden;
      border: 1px solid color-mix(in srgb, var(--color-gray-120) 14%, transparent);
      box-sizing: border-box;
    }

    .progress-bar-fill {
      height: 100%;
      width: var(--progress-fill);
      border-radius: 999px;
      background: linear-gradient(
        90deg,
        color-mix(in srgb, var(--color-teal-100) 85%, white) 0%,
        var(--color-teal-100) 35%,
        color-mix(in srgb, var(--color-teal-120) 85%, black) 100%
      );
      position: relative;
      overflow: hidden;
    }

    .progress-bar-fill::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(110deg, transparent 0%, rgba(255, 255, 255, 0.26) 45%, transparent 70%);
      transform: translateX(-60%);
      animation: progress-shimmer 1.8s ease-in-out infinite;
      mix-blend-mode: overlay;
      opacity: 0.9;
      pointer-events: none;
    }

    @media (prefers-reduced-motion: reduce) {
      .progress-bar-fill::after {
        animation: none;
        opacity: 0;
      }
    }

    @keyframes progress-shimmer {
      0% {
        transform: translateX(-60%);
      }
      100% {
        transform: translateX(60%);
      }
    }

    .eta-inline {
      font-size: var(--text-xs);
      color: var(--color-orange-red-110);
      white-space: nowrap;
      min-width: 12ch;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .eta-label {
      color: var(--print-normal);
      letter-spacing: 0.02em;
      text-transform: uppercase;
      font-weight: 700;
      font-size: 10px;
    }

    :global(.message.focus-message) {
      opacity: 0.9;
    }
  }

  /* Smaller modal for progress step */
  :global(.content.frame.modal-dialog.video-export-dialog--progress) {
    width: min(420px, 94vw);
    min-width: auto;
    height: auto;
  }
  :global(.content.frame.modal-dialog .export-progress-panel .modal-dialog-body-scroll) {
    gap: var(--pd-2xl) !important;
  }
</style>

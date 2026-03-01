<script lang="ts">
  import { Modal, Button, Input, Checkbox } from '../ui';

  const DEFAULT_FRAME_RATE = 120;
  const DEFAULT_WIDTH = 1920;
  const DEFAULT_HEIGHT = 1080;
  const DEFAULT_DURATION = 10;
  const DEFAULT_VIDEO_BITRATE_MBPS = 10;

  type ResolutionPreset = '1920x1080' | '1080x1920' | 'custom';

  export interface VideoExportConfig {
    width: number;
    height: number;
    maxDurationSeconds: number;
    useFullAudio: boolean;
    videoBitrate?: number;
    audioBitrate?: number;
    frameRate: number;
  }

  /** When no audio: primaryNodeId, buffer, audioDurationSeconds are omitted. */
  type VideoExportConfirmPayload = VideoExportConfig & {
    primaryNodeId?: string;
    buffer?: AudioBuffer;
    audioDurationSeconds?: number;
  };

  interface Props {
    visible?: boolean;
    onClose?: () => void;
    onConfirm?: (config: VideoExportConfirmPayload) => void;
    getPrimaryAudio?: () => { nodeId: string; buffer: AudioBuffer } | null;
  }

  let {
    visible = false,
    onClose,
    onConfirm,
    getPrimaryAudio = () => null,
  }: Props = $props();

  let resolutionPreset = $state<ResolutionPreset>('1920x1080');
  let customWidth = $state(DEFAULT_WIDTH);
  let customHeight = $state(DEFAULT_HEIGHT);
  let duration = $state(DEFAULT_DURATION);
  let useFullAudio = $state(false);
  let bitrateMbps = $state(DEFAULT_VIDEO_BITRATE_MBPS);
  let fps = $state(DEFAULT_FRAME_RATE);
  let errorMessage = $state('');

  const primary = $derived(getPrimaryAudio());
  const durationPlaceholder = $derived(primary ? `Audio length: ${primary.buffer.duration.toFixed(1)}s` : 'No audio — export will be video only');

  function tryConfirm() {
    errorMessage = '';
    const primaryNow = getPrimaryAudio();
    const width =
      resolutionPreset === 'custom'
        ? Math.max(1, Math.min(4096, customWidth || DEFAULT_WIDTH))
        : resolutionPreset === '1920x1080'
          ? 1920
          : 1080;
    const height =
      resolutionPreset === 'custom'
        ? Math.max(1, Math.min(4096, customHeight || DEFAULT_HEIGHT))
        : resolutionPreset === '1920x1080'
          ? 1080
          : 1920;
    const maxDuration = duration || DEFAULT_DURATION;
    const videoBitrate = Math.max(1_000_000, Math.min(100_000_000, Math.round((bitrateMbps || DEFAULT_VIDEO_BITRATE_MBPS) * 1_000_000)));

    if (primaryNow) {
      const { nodeId: primaryNodeId, buffer } = primaryNow;
      const maxDurationSeconds = useFullAudio ? buffer.duration : Math.min(maxDuration, buffer.duration);
      onConfirm?.({
        width,
        height,
        maxDurationSeconds,
        useFullAudio,
        videoBitrate,
        audioBitrate: 192_000,
        frameRate: fps,
        primaryNodeId,
        buffer,
        audioDurationSeconds: buffer.duration,
      });
    } else {
      onConfirm?.({
        width,
        height,
        maxDurationSeconds: maxDuration,
        useFullAudio: false,
        videoBitrate,
        audioBitrate: 192_000,
        frameRate: fps,
      });
    }
    onClose?.();
  }

  function setResolutionPreset(preset: ResolutionPreset) {
    resolutionPreset = preset;
    if (preset === '1920x1080') {
      customWidth = 1920;
      customHeight = 1080;
    } else if (preset === '1080x1920') {
      customWidth = 1080;
      customHeight = 1920;
    }
  }

  function setFps(value: number) {
    fps = value;
  }
</script>

<Modal open={visible} onClose={onClose} class="video-export-dialog">
  {#if errorMessage}
    <div class="error">{errorMessage}</div>
  {/if}

  <label class="label">Resolution</label>
  <div class="pill-group">
    <Button
      variant="secondary"
      size="sm"
      class="pill {resolutionPreset === '1920x1080' ? 'is-active' : ''}"
      onclick={() => setResolutionPreset('1920x1080')}
    >
      1920×1080
    </Button>
    <Button
      variant="secondary"
      size="sm"
      class="pill {resolutionPreset === '1080x1920' ? 'is-active' : ''}"
      onclick={() => setResolutionPreset('1080x1920')}
    >
      1080×1920
    </Button>
    <Button
      variant="secondary"
      size="sm"
      class="pill {resolutionPreset === 'custom' ? 'is-active' : ''}"
      onclick={() => setResolutionPreset('custom')}
    >
      Custom
    </Button>
  </div>

  {#if resolutionPreset === 'custom'}
    <div class="custom-resolution">
      <Input
        type="number"
        value={String(customWidth)}
        oninput={(e: Event) => (customWidth = parseInt((e.target as HTMLInputElement).value, 10) || DEFAULT_WIDTH)}
        placeholder="Width"
        aria-label="Width"
        min={1}
        max={4096}
      />
      <Input
        type="number"
        value={String(customHeight)}
        oninput={(e: Event) => (customHeight = parseInt((e.target as HTMLInputElement).value, 10) || DEFAULT_HEIGHT)}
        placeholder="Height"
        aria-label="Height"
        min={1}
        max={4096}
      />
    </div>
  {/if}

  <label class="label">Max duration (seconds)</label>
  <Input
    type="number"
    value={String(duration)}
    oninput={(e: Event) => (duration = parseFloat((e.target as HTMLInputElement).value) || DEFAULT_DURATION)}
    placeholder={durationPlaceholder}
    min={0.1}
    step={0.1}
    class="input-full"
  />

  <div class="checkbox-row">
    <Checkbox bind:checked={useFullAudio} label="Use full audio length" />
  </div>

  <label class="label">Video bitrate (Mbps)</label>
  <Input
    type="number"
    value={String(bitrateMbps)}
    oninput={(e: Event) => (bitrateMbps = parseFloat((e.target as HTMLInputElement).value) || DEFAULT_VIDEO_BITRATE_MBPS)}
    placeholder={String(DEFAULT_VIDEO_BITRATE_MBPS)}
    min={1}
    max={100}
    class="input-full"
  />

  <label class="label">Frame rate</label>
  <div class="pill-group">
    <Button
      variant="secondary"
      size="sm"
      class="pill {fps === 120 ? 'is-active' : ''}"
      onclick={() => setFps(120)}
    >
      120
    </Button>
    <Button
      variant="secondary"
      size="sm"
      class="pill {fps === 60 ? 'is-active' : ''}"
      onclick={() => setFps(60)}
    >
      60
    </Button>
    <Button
      variant="secondary"
      size="sm"
      class="pill {fps === 30 ? 'is-active' : ''}"
      onclick={() => setFps(30)}
    >
      30
    </Button>
  </div>

  <div class="actions">
    <Button variant="secondary" size="md" onclick={onClose}>Cancel</Button>
    <Button variant="primary" size="md" onclick={tryConfirm}>Export</Button>
  </div>
</Modal>

<style>
  /* Modal content - :global required for Modal portal */
  :global(.video-export-dialog) {
    .label {
      display: block;
      margin-bottom: var(--pd-sm);
      margin-top: var(--pd-md);
      font-size: var(--text-sm);
      color: var(--color-gray-90);
    }

    .label:first-of-type {
      margin-top: 0;
    }

    .error {
      margin-bottom: var(--pd-md);
      font-size: var(--text-sm);
      color: var(--color-red-90);
    }

    .pill-group {
      /* Layout */
      display: inline-flex;
      align-items: stretch;
      gap: var(--pd-xs);

      /* Box model */
      padding: var(--pd-2xs);
      border-radius: var(--button-radius);
      margin-bottom: var(--pd-md);

      /* Visual */
      background: var(--secondary-bg);
    }

    .custom-resolution {
      /* Layout */
      display: flex;
      gap: var(--pd-sm);
      align-items: center;

      /* Box model */
      margin-bottom: var(--pd-md);
      box-sizing: border-box;
    }

    .custom-resolution :global(.input) {
      flex: 1;
      min-width: 0;
    }

    .checkbox-row {
      display: flex;
      align-items: center;
      gap: var(--pd-sm);
      margin-bottom: var(--pd-md);
    }

    .actions {
      display: flex;
      gap: var(--pd-sm);
      justify-content: flex-end;
      margin-top: var(--pd-md);
    }
  }
</style>

<script lang="ts">
  import { type Readable } from 'svelte/store';
  import { Button, Message } from '../ui';

  interface Props {
    progress: Readable<{ current: number; total: number }>;
    onCancel?: () => void;
  }

  let { progress, onCancel }: Props = $props();

  let progressValue = $state({ current: 0, total: 0 });

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

  // Important: keep this non-reactive. Making it reactive can create an effect feedback loop
  // (progress.subscribe → update state → effect re-runs → subscribe → ...).
  let speed: SpeedState = { startMs: null, lastMs: null, lastFrame: 0, emaFps: null };
  let remainingSeconds = $state<number | null>(null);
  let remainingText = $derived(remainingSeconds == null ? 'Estimating…' : formatCountdown(remainingSeconds));

  // ETA uses the same clock as progress + EMA updates (subscribe callback), not a separate
  // setInterval whose effect deps could miss `progress` / leave duplicate timers. Throttle
  // writes to ~1 Hz when a numeric ETA exists; always refresh when estimating or finished.
  $effect(() => {
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
      const fps = speed.emaFps;
      const canCompute =
        total > 0 && fps != null && fps > 0.001 && current >= 0 && current <= total;
      const nextRemaining = canCompute ? (total - current) / fps : null;
      const doneOrEstimate = !canCompute || current >= total;
      if (doneOrEstimate || now - lastRemainingUiMs >= 1000) {
        lastRemainingUiMs = now;
        remainingSeconds = nextRemaining;
      }
    });
    return unsub;
  });
</script>

<div class="overlay">
  <div class="modal frame">
    <div class="title">Exporting video…</div>
    <div class="text">Frame {progressValue.current} / {progressValue.total}</div>
    <div class="text secondary">Time remaining: {remainingText}</div>
    {#snippet importantHeading()}Keep this tab focused{/snippet}
    <Message inline variant="info" heading={importantHeading}>
      Keep this browser tab in focus. If you switch tabs or minimize the window, export can become very slow and audio may go out of sync.
    </Message>
    <div class="actions">
      <Button variant="secondary" size="md" onclick={onCancel}>Cancel</Button>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: var(--search-dialog-overlay, rgba(0, 0, 0, 0.5));
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;

    .modal {
      display: flex;
      flex-direction: column;
      gap: var(--pd-lg);
      width: min(90vw, 600px);
      min-width: min(320px, 90vw);
      /* Box model / visual from layer .frame */

      .title {
        font-size: var(--text-lg);
        font-weight: 600;
        color: var(--color-gray-95);
      }

      .text {
        font-size: var(--text-md);
        color: var(--color-gray-80);
      }

      .text.secondary {
        font-size: var(--text-sm);
        color: var(--color-gray-70);
        font-variant-numeric: tabular-nums;
      }

      .actions {
        align-self: flex-end;
      }
    }
  }
</style>

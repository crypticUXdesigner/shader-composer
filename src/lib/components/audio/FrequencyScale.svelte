<script lang="ts">
  /**
   * FrequencyScale - WP 07
   * Log ticks: 20, 100, 250, 1k, 4k, 10k, 20k Hz
   */
  import { hzToNorm, FREQ_SCALE_TICKS } from './frequencyUtils';

  interface Props {
    class?: string;
  }

  let { class: className = '' }: Props = $props();

  const ticks = $derived(
    FREQ_SCALE_TICKS.map(({ hz, label }) => ({
      norm: Math.max(0, Math.min(1, hzToNorm(hz))),
      label,
    }))
  );
</script>

<div class="frequency-scale {className}" role="img" aria-label="Frequency scale">
  <div class="track">
    <div class="line"></div>
    {#each ticks as tick, i}
      <span
        class="tick"
        class:first={i === 0}
        class:last={i === ticks.length - 1}
        style="left: {tick.norm * 100}%"
      >
        {tick.label}
      </span>
    {/each}
  </div>
</div>

<style>
  /* FrequencyScale styles */
  .frequency-scale {
    display: block;
    width: 100%;
    min-height: 18px; /* one-off */
    color: var(--color-teal-gray-80);

    .track {
      position: relative;
      width: 100%;
      min-height: 18px; /* one-off */
      padding-top: 4px; /* one-off */

      .line {
        position: absolute;
        top: 4px; /* one-off */
        left: 0;
        right: 0;
        height: 1px;
        background: currentColor;
        opacity: 0.5; /* Intentional non-disabled: scale line visual weight */
      }

      .tick {
        position: absolute;
        top: 8px; /* one-off */
        font-size: 10px; /* one-off */
        font-weight: 500;
        transform: translateX(-50%);

        &.first {
          transform: translateX(0);
          left: 0 !important;
        }

        &.last {
          transform: translateX(-100%);
          left: 100% !important;
        }
      }
    }
  }
</style>

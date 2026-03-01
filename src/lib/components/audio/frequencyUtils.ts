/**
 * Frequency range utilities - shared by SpectrumStrip, FrequencyScale, FrequencyRangeEditor.
 * Log scale mapping 20–20k Hz for audio frequency display.
 */

export const FREQ_MIN = 20;
export const FREQ_MAX = 20000;

const LOG_FREQ_MIN = Math.log10(FREQ_MIN);
const LOG_FREQ_MAX = Math.log10(FREQ_MAX);
const LOG_FREQ_SPAN = LOG_FREQ_MAX - LOG_FREQ_MIN;

/** Convert Hz to normalized position (0–1) on log scale */
export function hzToNorm(hz: number): number {
  const clamped = Math.max(FREQ_MIN, Math.min(FREQ_MAX, hz));
  return (Math.log10(clamped) - LOG_FREQ_MIN) / LOG_FREQ_SPAN;
}

/** Convert normalized position (0–1) to Hz on log scale */
export function normToHz(norm: number): number {
  const t = Math.max(0, Math.min(1, norm));
  return Math.pow(10, LOG_FREQ_MIN + t * LOG_FREQ_SPAN);
}

/** Ticks for frequency scale in log mode — music-production–friendly Hz values */
export const FREQ_SCALE_TICKS: { hz: number; label: string }[] = [
  { hz: 20, label: '20' },
  { hz: 100, label: '100' },
  { hz: 250, label: '250' },
  { hz: 1000, label: '1k' },
  { hz: 4000, label: '4k' },
  { hz: 10000, label: '10k' },
  { hz: 20000, label: '20k' },
];

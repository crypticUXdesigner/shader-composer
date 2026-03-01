/**
 * Timeline bar-grid snap (WP 06A).
 * Pure function: snap a time (seconds) to the nearest grid line.
 * Grid step in seconds = (gridBars * 60) / bpm (e.g. 4 bars at 120 bpm = 2s).
 */
export function snapToGrid(
  t: number,
  bpm: number,
  gridBars: number
): number {
  if (bpm <= 0 || gridBars <= 0) return t;
  const stepSec = (gridBars * 60) / bpm;
  return Math.round(t / stepSec) * stepSec;
}

/**
 * Snap to grid but do not snap small positive values to 0.
 * Use during drag/resize so the region follows the cursor smoothly near the start
 * instead of sticking to 0 until the user drags past half a bar.
 */
export function snapToGridAvoidZero(
  t: number,
  bpm: number,
  gridBars: number
): number {
  if (bpm <= 0 || gridBars <= 0) return t;
  const snapped = snapToGrid(t, bpm, gridBars);
  if (snapped === 0 && t > 0) return t;
  return snapped;
}

/** Grid size options: snap every 2, 4, 8, or 16 bars. Default 4 bars. */
export const SNAP_GRID_OPTIONS: { value: number; label: string }[] = [
  { value: 2, label: '2' },
  { value: 4, label: '4' },
  { value: 8, label: '8' },
  { value: 16, label: '16' },
];

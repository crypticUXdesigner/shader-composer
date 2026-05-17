import type { PackedArrangementNote } from '../../shaders/arrangement/packArrangementNotesForGlsl';
import { ARRANGEMENT_NOTES_PREVIEW_LOOP_BUDGET } from './types';

/** Per-pixel note loop bound for preview; scales down as the baked note count grows. */
export function resolveArrangementNotesPreviewLoopBudget(bakedNoteCount: number): number {
  if (bakedNoteCount <= 768) return ARRANGEMENT_NOTES_PREVIEW_LOOP_BUDGET;
  if (bakedNoteCount <= 1024) return 384;
  if (bakedNoteCount <= 1280) return 320;
  if (bakedNoteCount <= 1536) return 256;
  return 192;
}

/** Visible timeline span for arrangement-notes (matches shader `windowStart` / width). */
export function arrangementNotesVisibleTimeWindow(
  timelineTime: number,
  windowSeconds: number,
  timelineAnchor: number
): { windowStart: number; windowEnd: number } {
  const winSec = Math.max(windowSeconds, 1e-4);
  const windowStart = timelineAnchor === 1 ? timelineTime : timelineTime - winSec * 0.5;
  return { windowStart, windowEnd: windowStart + winSec };
}

/**
 * Notes are sorted by `startSeconds`. Returns half-open `[start, end)` indices of notes that can
 * intersect the visible window (caller still does per-pixel time overlap).
 */
export function findNoteIndexRangeForWindow(
  notes: readonly PackedArrangementNote[],
  windowStart: number,
  windowEnd: number
): { start: number; end: number } {
  const n = notes.length;
  if (n === 0 || windowEnd <= windowStart) {
    return { start: 0, end: 0 };
  }

  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (notes[mid]!.endSeconds <= windowStart) lo = mid + 1;
    else hi = mid;
  }
  const start = lo;

  lo = start;
  hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (notes[mid]!.startSeconds < windowEnd) lo = mid + 1;
    else hi = mid;
  }

  return { start, end: lo };
}

/**
 * When the visible-window index span exceeds the interactive budget, keep a contiguous slice centered on
 * `timelineTime` so scrubbing still shows notes near the playhead.
 */
export function clampNoteLoopRangeForPreviewBudget(
  notes: readonly PackedArrangementNote[],
  range: { start: number; end: number },
  timelineTime: number,
  maxNotes: number = ARRANGEMENT_NOTES_PREVIEW_LOOP_BUDGET
): { start: number; end: number } {
  const { start, end } = range;
  const count = end - start;
  if (count <= maxNotes || maxNotes <= 0) {
    return { start, end };
  }

  let lo = start;
  let hi = end;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (notes[mid]!.startSeconds < timelineTime) lo = mid + 1;
    else hi = mid;
  }
  let pivot = lo;
  if (pivot >= end) pivot = end - 1;

  const half = maxNotes >> 1;
  let newStart = Math.max(start, pivot - half);
  let newEnd = newStart + maxNotes;
  if (newEnd > end) {
    newEnd = end;
    newStart = Math.max(start, newEnd - maxNotes);
  }
  return { start: newStart, end: newEnd };
}

import { describe, it, expect } from 'vitest';
import {
  arrangementNotesVisibleTimeWindow,
  clampNoteLoopRangeForPreviewBudget,
  findNoteIndexRangeForWindow,
  resolveArrangementNotesPreviewLoopBudget,
} from './arrangementNotesVisibleRange';
import { ARRANGEMENT_NOTES_INTERACTIVE_PACK_LIMIT, ARRANGEMENT_NOTES_PREVIEW_LOOP_BUDGET } from './types';
import type { PackedArrangementNote } from '../../shaders/arrangement/packArrangementNotesForGlsl';

function note(startSeconds: number, durationSeconds: number): PackedArrangementNote {
  return {
    startSeconds,
    endSeconds: startSeconds + durationSeconds,
    pitch: 60,
    velocity: 1,
  };
}

describe('arrangementNotesVisibleRange', () => {
  it('finds half-open index range for a time window on sorted notes', () => {
    const notes = [note(0, 1), note(2, 1), note(4, 1), note(10, 1)];
    expect(findNoteIndexRangeForWindow(notes, 1.5, 5)).toEqual({ start: 1, end: 3 });
    expect(findNoteIndexRangeForWindow(notes, 11, 20)).toEqual({ start: 4, end: 4 });
  });

  it('visible window matches centered anchor (timelineAnchor 0)', () => {
    const { windowStart, windowEnd } = arrangementNotesVisibleTimeWindow(50, 32, 0);
    expect(windowStart).toBeCloseTo(34);
    expect(windowEnd).toBeCloseTo(66);
  });

  it('narrows loop bound for scrub window vs full bake span', () => {
    const notes = Array.from({ length: 1000 }, (_, i) => note(i * 0.3, 0.2));
    const { windowStart, windowEnd } = arrangementNotesVisibleTimeWindow(150, 32, 0);
    const { start, end } = findNoteIndexRangeForWindow(notes, windowStart, windowEnd);
    expect(end - start).toBeLessThan(200);
    expect(end - start).toBeGreaterThan(0);
  });

  it('clamps dense window overlap to preview loop budget centered on timeline', () => {
    const notes = Array.from({ length: 1400 }, () => note(10, 0.5));
    const range = findNoteIndexRangeForWindow(notes, 0, 100);
    expect(range.end - range.start).toBe(1400);

    const budget = resolveArrangementNotesPreviewLoopBudget(notes.length);
    const clamped = clampNoteLoopRangeForPreviewBudget(notes, range, 10, budget);
    expect(clamped.end - clamped.start).toBe(budget);
    expect(clamped.start).toBeGreaterThanOrEqual(range.start);
    expect(clamped.end).toBeLessThanOrEqual(range.end);
  });

  it('resolves a lower per-pixel loop budget as baked note count grows', () => {
    expect(resolveArrangementNotesPreviewLoopBudget(400)).toBe(ARRANGEMENT_NOTES_PREVIEW_LOOP_BUDGET);
    expect(resolveArrangementNotesPreviewLoopBudget(1200)).toBe(320);
    expect(resolveArrangementNotesPreviewLoopBudget(1500)).toBe(256);
    expect(resolveArrangementNotesPreviewLoopBudget(1800)).toBe(192);
  });
});

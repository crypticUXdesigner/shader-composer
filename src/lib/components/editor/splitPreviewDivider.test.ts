import { describe, expect, it } from 'vitest';
import { computeSplitDividerPosition } from './splitPreviewDivider';

describe('computeSplitDividerPosition', () => {
  it('targets 9:16 preview width for full-height pane', () => {
    const contentWidth = 1200;
    const previewHeight = 800;
    const divider = computeSplitDividerPosition(contentWidth, previewHeight);
    const previewWidth = contentWidth * (1 - divider) - 4;
    expect(previewWidth).toBeCloseTo(previewHeight * (9 / 16), 0);
  });

  it('clamps when 9:16 would exceed max preview share', () => {
    const divider = computeSplitDividerPosition(400, 900);
    expect(divider).toBe(0.2);
  });

  it('falls back when dimensions are missing', () => {
    expect(computeSplitDividerPosition(0, 800)).toBe(0.5);
    expect(computeSplitDividerPosition(800, 0)).toBe(0.5);
  });
});

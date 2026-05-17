/** Gap between node editor and preview in split view (matches PreviewContainer). */
export const SPLIT_PREVIEW_GAP_PX = 4;

export const SPLIT_DIVIDER_MIN = 0.2;
export const SPLIT_DIVIDER_MAX = 0.8;

/** Default preview pane width:height in split view. */
export const SPLIT_PREVIEW_ASPECT_WIDTH = 9;
export const SPLIT_PREVIEW_ASPECT_HEIGHT = 16;

/**
 * Fraction of `contentWidth` for the node editor (0..1) so the preview pane
 * is ~`aspectWidth:aspectHeight`, clamped to drag limits.
 */
export function computeSplitDividerPosition(
  contentWidth: number,
  previewHeight: number,
  options?: {
    aspectWidth?: number;
    aspectHeight?: number;
    gapPx?: number;
    min?: number;
    max?: number;
  }
): number {
  const aspectW = options?.aspectWidth ?? SPLIT_PREVIEW_ASPECT_WIDTH;
  const aspectH = options?.aspectHeight ?? SPLIT_PREVIEW_ASPECT_HEIGHT;
  const gapPx = options?.gapPx ?? SPLIT_PREVIEW_GAP_PX;
  const min = options?.min ?? SPLIT_DIVIDER_MIN;
  const max = options?.max ?? SPLIT_DIVIDER_MAX;

  if (contentWidth <= 0 || previewHeight <= 0 || aspectH <= 0) return 0.5;

  const targetPreviewWidth = previewHeight * (aspectW / aspectH);
  const raw = 1 - (targetPreviewWidth + gapPx) / contentWidth;
  return Math.max(min, Math.min(max, raw));
}

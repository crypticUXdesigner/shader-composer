export type ImageExportFormat = 'png' | 'jpeg' | 'webp';

export type ImageExportFrameSelection =
  | { mode: 'playhead' }
  | { mode: 'time'; timeSeconds: number };

export type ImageExportConfirmPayload = ImageExportFrameSelection & {
  width: number;
  height: number;
  format: ImageExportFormat;
  quality?: number;
};


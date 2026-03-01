/**
 * Waveform data types for playlist-waveform 02B.
 * Unified shape for audiograph and buffer-derived waveform.
 */

/** Normalized waveform values (0–1) and metadata for drawing. */
export interface WaveformData {
  /** Normalized values (left channel or mono), same scale for audiograph and buffer-derived. */
  values: number[];
  /** Right channel when stereo (mini timeline draws bars: up = left, down = right). */
  valuesRight?: number[];
  /** Duration in seconds. */
  durationSeconds: number;
  /** Source of the data (for debugging / fallback UI). */
  source: 'audiograph' | 'buffer';
}

/** Resolution for audiograph requests (matches proto enum). */
export type AudiographResolution = 120 | 240 | 480 | 960 | 1920 | 3840;

/** Channels for audiograph (MONO = 1, STEREO = 2). */
export type AudiographChannels = 1 | 2;

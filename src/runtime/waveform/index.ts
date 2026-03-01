/**
 * Waveform data for playlist primary source (02B).
 * Audiograph API client, buffer-derived waveform, and unified WaveformService.
 */

export type { WaveformData, AudiographResolution, AudiographChannels } from './types';
export { AudiographClient, SCRUBBER_RESOLUTION } from './AudiographClient';
export { computeWaveformFromBuffer, DEFAULT_WAVEFORM_LENGTH } from './bufferWaveform';
export type { BufferWaveformResult } from './bufferWaveform';
export { WaveformService, getWaveformSlice } from './WaveformService';
export type { WaveformServiceDeps } from './WaveformService';

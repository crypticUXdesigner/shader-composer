/**
 * Runtime System for Node-Based Shader System
 * 
 * This module exports all runtime components for executing compiled shaders in WebGL.
 * 
 * Main entry point: RuntimeManager - provides public API for UI integration
 */

export { RuntimeManager } from './RuntimeManager';
export { CompilationManager } from './CompilationManager';
export { Renderer } from './Renderer';
export { ShaderInstance } from './ShaderInstance';
export { ShaderCompilationError, UniformNotFoundError, WebGLContextError } from './errors';
export type { CompilationResult, UniformMetadata, ShaderCompiler, TimelineState } from './types';
export { getUniformName, hashGraph } from './utils';
export {
  AudiographClient,
  SCRUBBER_RESOLUTION,
  WaveformService,
  getWaveformSlice,
  computeWaveformFromBuffer,
  DEFAULT_WAVEFORM_LENGTH,
} from './waveform';
export type { WaveformData, WaveformServiceDeps, AudiographResolution, AudiographChannels } from './waveform';

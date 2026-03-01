/**
 * Data Model Module for Node-Based Shader System (v2.0)
 * 
 * This module provides the complete data model implementation for the node-based
 * shader system, including types, validation, serialization, and utilities.
 */

// Types
export type {
  AudioSetup,
  AudioFileEntry,
  AudioBandEntry,
  AudioRemapperEntry,
  AudioSignalId,
  PrimarySource,
  PlaylistState,
} from './audioSetupTypes';
export { getPrimaryFileId } from './audioSetupTypes';
export type {
  ParameterValue,
  NodePosition,
  NodeInstance,
  Connection,
  GraphMetadata,
  GraphViewState,
  NodeGraph,
  SerializedGraphFile,
  ValidationResult,
  AutomationCurveInterpolation,
  AutomationKeyframe,
  AutomationCurve,
  AutomationRegion,
  AutomationLane,
  AutomationState,
} from './types';
export type {
  SignalId,
  SignalValue,
  SignalSourceKind,
  BaseSignalSource,
  AudioSignalSource,
  AutomationSignalSource,
  LfoSignalSource,
  SignalSource,
  SignalBinding,
  SignalBindingList,
} from './signals';

// Connection helpers (03B: invariant and duplicate keys)
export {
  isPortConnection,
  isParameterConnection,
  getConnectionTargetKey,
} from './connectionUtils';

// Validation
export {
  validateGraph,
  validateUniqueNodeIds,
  validateUniqueConnectionIds,
  validateConnectionNodeReferences,
  validateNoDuplicateConnections,
  type NodeSpecification,
} from './validation';

// Serialization
export {
  serializeGraph,
  deserializeGraph,
  deserializeGraphUnvalidated,
  type DeserializationResult,
} from './serialization';

// Utilities
export {
  generateUUID,
  generateNodeId,
  generateConnectionId,
  generateGraphId,
  getParameterValue,
  coerceParameterValue,
  clampParameterValue,
  getNodeIds,
  getConnectionIds,
  findNode,
  findConnection,
  getConnectionsFromNode,
  getConnectionsToNode,
  getConnectionToPort,
  createEmptyGraph,
  createDefaultViewState,
} from './utils';

// Immutable Updates
export {
  deepCopyGraph,
  addNode,
  removeNode,
  updateNode,
  updateNodePosition,
  updateNodeParameter,
  updateNodeParameterInputMode,
  updateNodeLabel,
  addConnection,
  removeConnection,
  removeConnections,
  updateViewState,
  addNodes,
  addConnections,
  addAutomationLane,
  addAutomationRegion,
  updateAutomationRegion,
  removeAutomationRegion,
  removeAutomationLane,
  setAutomationBpm,
  setAutomationDuration,
  addConnectionWithValidation,
} from './immutableUpdates';
export type {
  AddConnectionWithValidationResult,
  AddConnectionWithValidationOptions,
} from './immutableUpdates';
export {
  addFile as addAudioFile,
  updateFile as updateAudioFile,
  removeFile as removeAudioFile,
  addBand as addAudioBand,
  updateBand as updateAudioBand,
  removeBand as removeAudioBand,
  addRemapper as addAudioRemapper,
  updateRemapper as updateAudioRemapper,
  removeRemapper as removeAudioRemapper,
  setPrimarySource,
  setPlaylistOrder,
  setPlaylistCurrentIndex,
  setLoopCurrentTrack,
  retargetBandsToPrimary,
} from './audioSetupUpdates';

// Virtual nodes for named audio signals (WP 10)
export {
  VIRTUAL_NODE_PREFIX,
  isVirtualNodeId,
  getSignalIdFromVirtualNodeId,
  getVirtualNodeId,
  getNamedSignalsFromAudioSetup,
  getVirtualNodeIdsFromAudioSetup,
} from '../utils/virtualNodes';
export type { NamedSignal } from '../utils/virtualNodes';

// Param port audio state (WP 13)
export {
  getParamPortConnectionState,
  getParamPortLiveValue,
} from '../utils/paramPortAudioState';
export type { ParamPortConnectionState, ParamPortConnectionInfo } from '../utils/paramPortAudioState';

// Noise nodes migration
export {
  migrateNoiseNodes,
  hasLegacyNoiseNodes,
  LEGACY_NOISE_NODE_TYPES,
} from './noiseNodesMigration';

/**
 * Node graph types — re-export hub.
 * Canonical definitions live in data-model/types.ts.
 * Import from here for the `types/` namespace or from `data-model/types` directly.
 */

import type { SerializedGraphFile as SerializedGraphFileType } from '../data-model/types';

export type {
  ParameterValue,
  NodePosition,
  NodeInstance,
  Connection,
  GraphMetadata,
  GraphViewState,
  NodeGraph,
  AutomationState,
  AutomationCurveInterpolation,
  AutomationKeyframe,
  AutomationCurve,
  AutomationRegion,
  AutomationLane,
  SerializedGraphFile,
  ValidationResult,
} from '../data-model/types';

/**
 * File-format wrapper (graph only). For full format including audioSetup, use SerializedGraphFile from data-model.
 */
export type SerializedNodeGraph = Pick<SerializedGraphFileType, 'format' | 'formatVersion' | 'graph'>;

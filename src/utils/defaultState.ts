// Utility for managing default/starting state
// Allows saving the current graph state to become the new starting point
// Uses data-model serialization so every graph has passed validateGraph.

import type { NodeGraph } from '../data-model/types';
import type { AudioSetup } from '../data-model/audioSetupTypes';
import type { NodeSpecification } from '../data-model/validation';
import {
  serializeGraph,
  deserializeGraph,
  type DeserializationResult,
} from '../data-model/serialization';

const DEFAULT_STATE_KEY = 'shader-composer-default-state';

/**
 * Save the current graph (and optional audio setup) as the default starting state.
 * Uses data-model serialization (format 2.0, includes audioSetup when provided).
 */
export function saveDefaultState(
  graph: NodeGraph,
  audioSetup?: AudioSetup
): void {
  try {
    const serialized = serializeGraph(graph, true, audioSetup);
    localStorage.setItem(DEFAULT_STATE_KEY, serialized);
    console.log('[DefaultState] Saved current state as default');
  } catch (error) {
    console.error('[DefaultState] Failed to save default state:', error);
    throw error;
  }
}

/**
 * Load the default starting state from localStorage.
 * Uses data-model deserializeGraph + validateGraph; returns result with graph, audioSetup, errors, warnings.
 * Returns null graph and errors if invalid or missing; caller should set graph/audioSetup only when result.graph is non-null.
 *
 * @param nodeSpecs - Node specifications for validation (e.g. from node system specs)
 */
export function loadDefaultState(
  nodeSpecs: NodeSpecification[] = []
): DeserializationResult {
  try {
    const serialized = localStorage.getItem(DEFAULT_STATE_KEY);
    if (!serialized) {
      return { graph: null, errors: [], warnings: [] };
    }

    const result = deserializeGraph(serialized, nodeSpecs);
    if (result.graph) {
      console.log('[DefaultState] Loaded default state from localStorage');
    } else {
      console.warn(
        '[DefaultState] Failed to deserialize default state:',
        result.errors
      );
      localStorage.removeItem(DEFAULT_STATE_KEY);
    }
    return result;
  } catch (error) {
    console.error('[DefaultState] Failed to load default state:', error);
    localStorage.removeItem(DEFAULT_STATE_KEY);
    const message = error instanceof Error ? error.message : String(error);
    return {
      graph: null,
      errors: [message],
      warnings: [],
    };
  }
}

/**
 * Clear the saved default state
 */
export function clearDefaultState(): void {
  localStorage.removeItem(DEFAULT_STATE_KEY);
  console.log('[DefaultState] Cleared default state');
}

/**
 * Check if a default state exists
 */
export function hasDefaultState(): boolean {
  return localStorage.getItem(DEFAULT_STATE_KEY) !== null;
}

/**
 * Worker message types for compilation worker communication.
 * All payloads are structured-clone compatible (no functions or non-plain data).
 */

import type { NodeGraph } from '../../data-model/types';
import type { AudioSetup } from '../../data-model/audioSetupTypes';
import type { CompilationResult } from '../types';
import type { NodeSpec } from '../../types/nodeSpec';

/** Sent from main thread to worker: init with node specs. */
export interface WorkerInitPayload {
  type: 'init';
  nodeSpecs: Record<string, NodeSpec>;
}

/** Sent from main thread to worker: compile request. */
export interface WorkerCompilePayload {
  type: 'compile';
  id: number;
  graph: NodeGraph;
  audioSetup: AudioSetup | null;
  previousResult: CompilationResult | null;
  affectedNodeIds: string[];
  tryIncremental: boolean;
}

/** Sent from worker to main thread: compilation succeeded. */
export interface WorkerResultMessage {
  type: 'result';
  id: number;
  result: CompilationResult;
}

/** Sent from worker to main thread: compilation failed. */
export interface WorkerErrorMessage {
  type: 'error';
  id: number;
  message: string;
}

/** Sent from worker to main thread: init completed, ready for compile. */
export interface WorkerInitedMessage {
  type: 'inited';
}

/** Union of all messages the worker can send back to the main thread. */
export type WorkerReplyMessage =
  | WorkerResultMessage
  | WorkerErrorMessage
  | WorkerInitedMessage;

/**
 * Returns a deep plain-object copy of the compile payload that is safe for postMessage
 * (structured clone). Strips proxies, DOM refs, and other non-cloneable values that
 * may be attached to graph, audioSetup, or previousResult at runtime.
 */
export function cloneableCompilePayload(
  payload: WorkerCompilePayload
): WorkerCompilePayload {
  return JSON.parse(JSON.stringify(payload)) as WorkerCompilePayload;
}

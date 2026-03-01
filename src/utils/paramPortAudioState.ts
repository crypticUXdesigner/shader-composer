/**
 * ParamPort Audio State — WP 13
 *
 * Resolves connection state (default | graph-connected | audio-connected),
 * signal name for audio-connected params, and live value for peak meter.
 * Parent (NodeBody or param renderer) uses these to pass props to ParamPort/ParameterCell.
 */

import type { NodeGraph } from '../data-model/types';
import type { NodeSpec } from '../types/nodeSpec';
import type { IAudioManager } from '../runtime/types';
import type { AudioSetup } from '../data-model/audioSetupTypes';
import { isVirtualNodeId } from './virtualNodes';
import { getNamedSignalsFromAudioSetup } from './virtualNodes';
import { getParameterInputValue } from './parameterValueCalculator';

export type ParamPortConnectionState = 'default' | 'graph-connected' | 'audio-connected';

export interface ParamPortConnectionInfo {
  state: ParamPortConnectionState;
  signalName: string;
}

/**
 * Resolve connection state and signal name for a parameter port.
 *
 * - No connection → state='default', signalName=''
 * - Connection to real node → state='graph-connected', signalName=''
 * - Connection to virtual node (audio signal) → state='audio-connected', signalName from getNamedSignalsFromAudioSetup
 */
export function getParamPortConnectionState(
  targetNodeId: string,
  targetParameter: string,
  graph: NodeGraph,
  audioSetup: AudioSetup
): ParamPortConnectionInfo {
  const connection = graph.connections.find(
    conn => conn.targetNodeId === targetNodeId && conn.targetParameter === targetParameter
  );

  if (!connection) {
    return { state: 'default', signalName: '' };
  }

  if (isVirtualNodeId(connection.sourceNodeId)) {
    const signals = getNamedSignalsFromAudioSetup(audioSetup);
    const match = signals.find(s => s.virtualNodeId === connection.sourceNodeId);
    return {
      state: 'audio-connected',
      signalName: match?.name ?? '',
    };
  }

  return { state: 'graph-connected', signalName: '' };
}

/**
 * Get live value for a parameter port (0–1 normalized for peak meter).
 * Returns null if not connected or value cannot be resolved.
 *
 * For audio-connected params: uses getParameterInputValue (resolved from virtual node).
 * Normalizes to 0–1 for peak meter display (clamps raw value).
 */
export function getParamPortLiveValue(
  targetNodeId: string,
  targetParameter: string,
  graph: NodeGraph,
  nodeSpecs: Map<string, NodeSpec>,
  audioManager?: IAudioManager
): number | null {
  const value = getParameterInputValue(
    targetNodeId,
    targetParameter,
    graph,
    nodeSpecs,
    audioManager
  );
  if (value === null || typeof value !== 'number' || !isFinite(value)) return null;
  return Math.max(0, Math.min(1, value));
}

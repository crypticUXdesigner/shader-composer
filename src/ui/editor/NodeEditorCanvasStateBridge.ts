/**
 * NodeEditorCanvasStateBridge - Thin delegation over stateSync and interactionState.
 * Extracted from NodeEditorCanvas (03A further refactor) to reduce its size.
 */

import type { CanvasInteractionState } from './CanvasInteractionState';
import type { createCanvasStateSync, ConnectionStateUpdate } from './CanvasStateSync';

export type StateSync = ReturnType<typeof createCanvasStateSync>;

export interface NodeEditorCanvasStateBridge {
  getViewStateInternal(): { panX: number; panY: number; zoom: number };
  getSelectionState(): { selectedNodeIds: Set<string>; selectedConnectionIds: Set<string> };
  getConnectionState(): {
    isConnecting: boolean;
    connectionStartNodeId: string | null;
    connectionStartPort: string | null;
    connectionStartParameter: string | null;
    connectionStartIsOutput: boolean;
    connectionMouseX: number;
    connectionMouseY: number;
    hoveredPort: { nodeId: string; port: string; isOutput: boolean; parameter?: string } | null;
  };
  setConnectionState(state: ConnectionStateUpdate): void;
  getPanState(): ReturnType<CanvasInteractionState['getPanState']>;
  setPanState(state: Parameters<CanvasInteractionState['setPanState']>[0]): void;
  getInteractionState(): ReturnType<CanvasInteractionState['getInteractionState']>;
  setInteractionState(state: Parameters<CanvasInteractionState['setInteractionState']>[0]): void;
  updateMousePosition(x: number, y: number): void;
}

export function createNodeEditorCanvasStateBridge(
  stateSync: StateSync,
  interactionState: CanvasInteractionState
): NodeEditorCanvasStateBridge {
  return {
    getViewStateInternal: () => stateSync.getViewStateInternal(),
    getSelectionState: () => stateSync.getSelectionState(),
    getConnectionState: () => stateSync.getConnectionState(),
    setConnectionState: (state) => stateSync.setConnectionState(state),
    getPanState: () => interactionState.getPanState(),
    setPanState: (state) => interactionState.setPanState(state),
    getInteractionState: () => interactionState.getInteractionState(),
    setInteractionState: (state) => interactionState.setInteractionState(state),
    updateMousePosition: (x, y) => interactionState.updateMousePosition(x, y)
  };
}

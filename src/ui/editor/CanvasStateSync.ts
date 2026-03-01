/**
 * CanvasStateSync - Syncs view, selection, and connection state from managers into canvas state.
 * Extracted from NodeEditorCanvas to reduce its size.
 */

import type { CanvasState } from './NodeEditorCanvas';

export interface ConnectionStateSnapshot {
  isConnecting: boolean;
  connectionStartNodeId: string | null;
  connectionStartPort: string | null;
  connectionStartParameter: string | null;
  connectionStartIsOutput: boolean;
  connectionMouseX: number;
  connectionMouseY: number;
  hoveredPort: { nodeId: string; port: string; isOutput: boolean; parameter?: string } | null;
}

export type ConnectionStateUpdate = Partial<{
  isConnecting: boolean;
  connectionStartNodeId: string | null;
  connectionStartPort: string | null;
  connectionStartParameter: string | null;
  connectionStartIsOutput: boolean;
  connectionStartSnapPosition: { x: number; y: number };
  hoveredPort: { nodeId: string; port: string; isOutput: boolean; parameter?: string } | null;
  connectionMouseX: number;
  connectionMouseY: number;
}>;

export interface CanvasStateSyncDeps {
  viewStateManager: { getState: () => { panX: number; panY: number; zoom: number } };
  selectionManager: { getState: () => { selectedNodeIds: Set<string>; selectedConnectionIds: Set<string> } };
  connectionStateManager: {
    getState: () => ConnectionStateSnapshot & { connectionStartSnapPosition?: { x: number; y: number } };
    setState: (state: ConnectionStateUpdate) => void;
  };
}

/**
 * Creates sync helpers that read from managers and optionally write back into canvas state.
 */
export function createCanvasStateSync(deps: CanvasStateSyncDeps, stateRef: CanvasState): {
  getViewStateInternal: () => { panX: number; panY: number; zoom: number };
  getSelectionState: () => { selectedNodeIds: Set<string>; selectedConnectionIds: Set<string> };
  getConnectionState: () => ConnectionStateSnapshot;
  setConnectionState: (state: ConnectionStateUpdate) => void;
} {
  return {
    getViewStateInternal(): { panX: number; panY: number; zoom: number } {
      const viewState = deps.viewStateManager.getState();
      stateRef.panX = viewState.panX;
      stateRef.panY = viewState.panY;
      stateRef.zoom = viewState.zoom;
      return viewState;
    },

    getSelectionState(): { selectedNodeIds: Set<string>; selectedConnectionIds: Set<string> } {
      const selection = deps.selectionManager.getState();
      stateRef.selectedNodeIds = selection.selectedNodeIds;
      stateRef.selectedConnectionIds = selection.selectedConnectionIds;
      return selection;
    },

    getConnectionState(): ConnectionStateSnapshot {
      const state = deps.connectionStateManager.getState();
      return {
        isConnecting: state.isConnecting,
        connectionStartNodeId: state.connectionStartNodeId,
        connectionStartPort: state.connectionStartPort,
        connectionStartParameter: state.connectionStartParameter,
        connectionStartIsOutput: state.connectionStartIsOutput,
        connectionMouseX: state.connectionMouseX,
        connectionMouseY: state.connectionMouseY,
        hoveredPort: state.hoveredPort
      };
    },

    setConnectionState(state: ConnectionStateUpdate): void {
      deps.connectionStateManager.setState(state);
    }
  };
}

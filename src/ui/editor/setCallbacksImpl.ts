/**
 * setCallbacksImpl - Applies callback assignments and updates mouse handler / overlay refs.
 * Extracted from NodeEditorCanvas to reduce its size.
 */

import type { ParameterValue } from '../../data-model/types';
import type { ParameterInputMode } from '../../types/nodeSpec';

export interface CanvasCallbacks {
  onNodeMoved?: (nodeId: string, x: number, y: number) => void;
  onNodeSelected?: (nodeId: string | null, multiSelect: boolean) => void;
  onConnectionCreated?: (sourceNodeId: string, sourcePort: string, targetNodeId: string, targetPort?: string, targetParameter?: string) => void;
  onConnectionSelected?: (connectionId: string | null, multiSelect: boolean) => void;
  onNodeDeleted?: (nodeId: string) => void;
  onConnectionDeleted?: (connectionId: string) => void;
  onParameterChanged?: (nodeId: string, paramName: string, value: ParameterValue) => void;
  onFileParameterChanged?: (nodeId: string, paramName: string, file: File) => void;
  onFileDialogOpen?: () => void;
  onFileDialogClose?: () => void;
  onParameterInputModeChanged?: (nodeId: string, paramName: string, mode: ParameterInputMode) => void;
  onNodeLabelChanged?: (nodeId: string, label: string | undefined) => void;
  onSpacebarStateChange?: (isPressed: boolean) => void;
  isDialogVisible?: () => boolean;
  onTypeLabelClick?: (portType: string, screenX: number, screenY: number, typeLabelBounds?: { left: number; top: number; right: number; bottom: number; width: number; height: number }) => void;
  onNodeContextMenu?: (screenX: number, screenY: number, nodeId: string, nodeType: string) => void;
  onCopySelected?: () => void;
  onPaste?: () => void;
  onDuplicateSelected?: () => void;
  hasClipboard?: () => boolean;
}

export interface SetCallbacksCanvas {
  onNodeMoved?: CanvasCallbacks['onNodeMoved'];
  onNodeSelected?: CanvasCallbacks['onNodeSelected'];
  onConnectionCreated?: CanvasCallbacks['onConnectionCreated'];
  onConnectionSelected?: CanvasCallbacks['onConnectionSelected'];
  onNodeDeleted?: CanvasCallbacks['onNodeDeleted'];
  onConnectionDeleted?: CanvasCallbacks['onConnectionDeleted'];
  onParameterChanged?: CanvasCallbacks['onParameterChanged'];
  onFileParameterChanged?: CanvasCallbacks['onFileParameterChanged'];
  onFileDialogOpen?: CanvasCallbacks['onFileDialogOpen'];
  onFileDialogClose?: CanvasCallbacks['onFileDialogClose'];
  onParameterInputModeChanged?: CanvasCallbacks['onParameterInputModeChanged'];
  onNodeLabelChanged?: CanvasCallbacks['onNodeLabelChanged'];
  onSpacebarStateChange?: CanvasCallbacks['onSpacebarStateChange'];
  isDialogVisible?: CanvasCallbacks['isDialogVisible'];
  onTypeLabelClick?: CanvasCallbacks['onTypeLabelClick'];
  onNodeContextMenu?: CanvasCallbacks['onNodeContextMenu'];
  onCopySelected?: CanvasCallbacks['onCopySelected'];
  onPaste?: CanvasCallbacks['onPaste'];
  onDuplicateSelected?: CanvasCallbacks['onDuplicateSelected'];
  hasClipboard?: CanvasCallbacks['hasClipboard'];
  mouseEventHandler?: { deps?: { onTypeLabelClick?: CanvasCallbacks['onTypeLabelClick']; onNodeSelected?: CanvasCallbacks['onNodeSelected']; onParameterChanged?: CanvasCallbacks['onParameterChanged']; onConnectionCreated?: CanvasCallbacks['onConnectionCreated'] } };
  overlayManager?: { updateDependencies: (deps: Partial<Pick<CanvasCallbacks, 'onFileParameterChanged' | 'onFileDialogOpen' | 'onFileDialogClose' | 'onParameterChanged' | 'onNodeLabelChanged'>>) => void };
}

export function setCallbacksImpl(canvas: SetCallbacksCanvas, callbacks: CanvasCallbacks): void {
  canvas.onNodeMoved = callbacks.onNodeMoved;
  canvas.onNodeSelected = callbacks.onNodeSelected;
  canvas.onConnectionCreated = callbacks.onConnectionCreated;
  canvas.onConnectionSelected = callbacks.onConnectionSelected;
  canvas.onNodeDeleted = callbacks.onNodeDeleted;
  canvas.onConnectionDeleted = callbacks.onConnectionDeleted;
  canvas.onParameterChanged = callbacks.onParameterChanged;
  canvas.onFileParameterChanged = callbacks.onFileParameterChanged;
  canvas.onFileDialogOpen = callbacks.onFileDialogOpen;
  canvas.onFileDialogClose = callbacks.onFileDialogClose;
  canvas.onParameterInputModeChanged = callbacks.onParameterInputModeChanged;
  canvas.onNodeLabelChanged = callbacks.onNodeLabelChanged;
  canvas.onSpacebarStateChange = callbacks.onSpacebarStateChange;
  canvas.isDialogVisible = callbacks.isDialogVisible;
  canvas.onTypeLabelClick = callbacks.onTypeLabelClick;
  canvas.onNodeContextMenu = callbacks.onNodeContextMenu;
  canvas.onCopySelected = callbacks.onCopySelected;
  canvas.onPaste = callbacks.onPaste;
  canvas.onDuplicateSelected = callbacks.onDuplicateSelected;
  canvas.hasClipboard = callbacks.hasClipboard;

  if (canvas.mouseEventHandler?.deps) {
    const deps = canvas.mouseEventHandler.deps;
    deps.onTypeLabelClick = canvas.onTypeLabelClick;
    deps.onNodeSelected = canvas.onNodeSelected;
    deps.onParameterChanged = canvas.onParameterChanged;
    deps.onConnectionCreated = canvas.onConnectionCreated;
  }

  if (canvas.overlayManager) {
    canvas.overlayManager.updateDependencies({
      onFileParameterChanged: canvas.onFileParameterChanged,
      onFileDialogOpen: canvas.onFileDialogOpen,
      onFileDialogClose: canvas.onFileDialogClose,
      onParameterChanged: canvas.onParameterChanged,
      onNodeLabelChanged: canvas.onNodeLabelChanged
    });
  }
}

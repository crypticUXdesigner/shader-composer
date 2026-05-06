/**
 * Types shared by NodeEditorCanvasWrapper and DOM node layer.
 */

import type { NodeGraph, NodeInstance, ParameterValue } from '../../../data-model/types';
import type { ToolType } from '../../../types/editor';
import type { IAudioManager } from '../../../runtime/types';
import type { NodeRenderMetrics } from '../../../ui/editor';

export interface NodeEditorCanvasWrapperCallbacks {
  onGraphChanged?: (graph: NodeGraph) => void;
  onConnectionRemoved?: (connectionId: string) => void;
  onNodeContextMenu?: (screenX: number, screenY: number, nodeId: string, nodeType: string) => void;
  onToggleFullscreen?: () => void;
  onParameterChanged?: (
    nodeId: string,
    paramName: string,
    value: ParameterValue,
    graph?: NodeGraph
  ) => void | Promise<unknown>;
  onFileParameterChanged?: (nodeId: string, paramName: string, file: File) => void | Promise<unknown>;
  onFileDialogOpen?: () => void;
  onFileDialogClose?: () => void;
  onSelectionChanged?: (selectedNodeIds: string[]) => void;
  /** When true, canvas skips Delete/Backspace so timeline can delete selected regions. */
  isDialogVisible?: () => boolean;
  onUndo?: () => void | Promise<void>;
  onRedo?: () => void | Promise<void>;
}

export interface NodeEditorCanvasWrapperAPI {
  requestRender(): void;
  fitToView(): void;
  /** Center viewport on node and select it. */
  focusNode(nodeId: string, options?: { zoom?: number; targetScreenYFrac?: number }): void;
  /** Handle wheel for zoom. Call when wheel fires anywhere in the canvas area (including over DOM nodes). */
  handleWheel(e: WheelEvent): void;
  /** Forward mousedown when hand tool blocks DOM nodes (e.g. overlay). */
  forwardMouseDown?(e: MouseEvent): void;
  /** Check if click is on a connection. Used to forward connection clicks from DOM layer to canvas. */
  hitTestConnection?(screenX: number, screenY: number): string | null;
  setZoom(zoom: number, centerX?: number, centerY?: number): void;
  getViewState(): { zoom: number; panX: number; panY: number; selectedNodeIds: string[] };
  setActiveTool(tool: ToolType): void;
  setAudioManager(audioManager: IAudioManager | undefined): void;
  getAudioManager(): IAudioManager | undefined;
  setSpacebarStateChangeCallback(callback: ((isPressed: boolean) => void) | undefined): void;
  screenToCanvas(screenX: number, screenY: number): { x: number; y: number };
  getCanvasCenterInScreen(): { x: number; y: number };
  render(): void;
  addNode(nodeType: string, x: number, y: number): NodeInstance | null;
  /** Metrics for a node, used by DOM node layer (dragging/culling). */
  getNodeMetrics(nodeId: string): NodeRenderMetrics | undefined;
  /** Check if a node is visible in viewport (for DOM layer culling). */
  isNodeVisible?(node: import('../../../data-model/types').NodeInstance, metrics: NodeRenderMetrics): boolean;
  /** Start connection drag from a port (DOM nodes capture pointer events, so canvas needs this to initiate drag). pointerId enables document pointer capture so release is received. */
  startConnectionFromPort?(screenX: number, screenY: number, pointerId?: number): void;
  /** Skip the next reactive `setGraph` from the graph prop (call before replacing the graph for undo/redo). */
  beginGraphHistoryRestore(): void;
  /** Apply restored snapshot to canvas pan/zoom/selection from `graph.viewState`. */
  completeGraphHistoryRestore(graph: NodeGraph): void;
}

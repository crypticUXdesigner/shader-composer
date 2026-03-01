/**
 * NodeEditorCanvasWrapper types - Svelte 5 Migration WP 04C
 * WP 14A: Extended with DOM node layer support (calculateSmartGuides, setSmartGuides, getNodeMetrics)
 */

import type { NodeGraph, NodeInstance, ParameterValue } from '../../../data-model/types';
import type { ToolType } from '../../../types/editor';
import type { IAudioManager } from '../../../runtime/types';
import type { NodeRenderMetrics } from '../../../ui/editor';

export interface SmartGuidesResult {
  snappedX: number;
  snappedY: number;
  guides: {
    vertical: Array<{ x: number; startY: number; endY: number }>;
    horizontal: Array<{ y: number; startX: number; endX: number }>;
  };
}

export interface NodeEditorCanvasWrapperCallbacks {
  onGraphChanged?: (graph: NodeGraph) => void;
  onConnectionRemoved?: (connectionId: string) => void;
  onNodeContextMenu?: (screenX: number, screenY: number, nodeId: string, nodeType: string) => void;
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
}

export interface NodeEditorCanvasWrapperAPI {
  requestRender(): void;
  fitToView(): void;
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
  setSpacebarStateChangeCallback(callback: (isPressed: boolean) => void): void;
  screenToCanvas(screenX: number, screenY: number): { x: number; y: number };
  getCanvasCenterInScreen(): { x: number; y: number };
  render(): void;
  addNode(nodeType: string, x: number, y: number): NodeInstance | null;
  /** WP 14A: For DOM node drag - get metrics for a node */
  getNodeMetrics(nodeId: string): NodeRenderMetrics | undefined;
  /** Check if a node is visible in viewport (for DOM layer culling). */
  isNodeVisible?(node: import('../../../data-model/types').NodeInstance, metrics: NodeRenderMetrics): boolean;
  /** WP 14A: For DOM node drag - calculate smart guides and snap position */
  calculateSmartGuides(node: NodeInstance, proposedX: number, proposedY: number): SmartGuidesResult;
  /** WP 14A: For DOM node drag - set guides to display */
  setSmartGuides(guides: SmartGuidesResult['guides']): void;
  /** WP 14A: For DOM node drag - clear guides when drag ends */
  clearSmartGuides(): void;
  /** Start connection drag from a port (DOM nodes capture pointer events, so canvas needs this to initiate drag). pointerId enables document pointer capture so release is received. */
  startConnectionFromPort?(screenX: number, screenY: number, pointerId?: number): void;
}

/**
 * EventHandlerDeps - Builds dependency objects for MouseEventHandler and WheelEventHandler.
 * Extracted from NodeEditorCanvas to reduce its size.
 */

import type { HandlerContext } from '../interactions/HandlerContext';
import type { InteractionEvent, InteractionEventTarget } from '../interactions/InteractionHandler';
import { InteractionType } from '../interactions/InteractionTypes';

/** Minimal shape needed to create an InteractionEvent from a native event. */
export interface CreateInteractionEventSource {
  canvas: HTMLCanvasElement;
  screenToCanvas(screenX: number, screenY: number): { x: number; y: number };
}

/**
 * Convert native mouse/wheel event to InteractionEvent. Extracted from NodeEditorCanvas.
 */
export function createInteractionEventFromSource(
  source: CreateInteractionEventSource,
  type: InteractionType,
  e: MouseEvent | WheelEvent,
  target: InteractionEventTarget = null
): InteractionEvent {
  const rect = source.canvas.getBoundingClientRect();
  const screenX = 'clientX' in e ? e.clientX : rect.left + rect.width / 2;
  const screenY = 'clientY' in e ? e.clientY : rect.top + rect.height / 2;
  return {
    type,
    target,
    position: source.screenToCanvas(screenX, screenY),
    screenPosition: { x: screenX, y: screenY },
    modifiers: {
      shift: e.shiftKey,
      ctrl: e.ctrlKey,
      alt: e.altKey,
      meta: e.metaKey
    },
    button: 'button' in e ? e.button : undefined,
    deltaY: 'deltaY' in e ? e.deltaY : undefined,
    originalEvent: e
  };
}
import type { NodeInstance } from '../../data-model/types';
import type {
  MouseEventHandlerDependencies
} from './canvas/handlers/MouseEventHandler';
import type {
  WheelEventHandlerDependencies
} from './canvas/handlers/WheelEventHandler';

/** Shape required from canvas to build mouse handler deps. */
export interface MouseEventHandlerDepsSource {
  readonly interactionManager: MouseEventHandlerDependencies['interactionManager'];
  readonly uiElementManager: MouseEventHandlerDependencies['uiElementManager'];
  readonly hitTestManager: MouseEventHandlerDependencies['hitTestManager'];
  readonly edgeScrollManager: MouseEventHandlerDependencies['edgeScrollManager'];
  readonly selectionManager: MouseEventHandlerDependencies['selectionManager'];
  readonly viewStateManager: MouseEventHandlerDependencies['viewStateManager'];
  readonly graph: MouseEventHandlerDependencies['graph'];
  readonly nodeSpecs: MouseEventHandlerDependencies['nodeSpecs'];
  readonly nodeMetrics: MouseEventHandlerDependencies['nodeMetrics'];
  readonly nodeRenderer: MouseEventHandlerDependencies['nodeRenderer'];
  readonly renderState: MouseEventHandlerDependencies['renderState'];
  readonly connectionLayerRenderer: MouseEventHandlerDependencies['connectionLayerRenderer'];
  readonly parameterConnectionLayerRenderer: MouseEventHandlerDependencies['parameterConnectionLayerRenderer'];
  readonly activeTool: MouseEventHandlerDependencies['activeTool'];
  readonly isSpacePressed: boolean;
  readonly canvas: HTMLCanvasElement;
  readonly onNodeDeleted: MouseEventHandlerDependencies['onNodeDeleted'];
  readonly onTypeLabelClick: MouseEventHandlerDependencies['onTypeLabelClick'];
  readonly onParameterInputModeChanged: MouseEventHandlerDependencies['onParameterInputModeChanged'];
  readonly onParameterChanged: MouseEventHandlerDependencies['onParameterChanged'];
  readonly onConnectionCreated: MouseEventHandlerDependencies['onConnectionCreated'];
  /** When set, used at invoke time so handlers see the current callback (callbacks are set after context is built). */
  getOnConnectionCreated?: () => MouseEventHandlerDependencies['onConnectionCreated'];
  readonly onNodeMoved: MouseEventHandlerDependencies['onNodeMoved'];
  readonly onNodeSelected: MouseEventHandlerDependencies['onNodeSelected'];
  attachDocumentListeners(): void;
  detachDocumentListeners(): void;
  createInteractionEvent(type: InteractionType, e: MouseEvent | WheelEvent, target?: InteractionEventTarget): InteractionEvent;
  handleFileParameterClick(nodeId: string, paramName: string, screenX: number, screenY: number): void;
  handleEnumParameterClick(nodeId: string, paramName: string, screenX: number, screenY: number): void;
  handleColorPickerClick(nodeId: string, screenX: number, screenY: number): void;
  handleSignalPickerClick(screenX: number, screenY: number, targetNodeId: string, targetParameter: string): void;
  calculateSmartGuides(draggingNode: NodeInstance, proposedX: number, proposedY: number): MouseEventHandlerDependencies['calculateSmartGuides'] extends (...args: unknown[]) => infer R ? R : never;
  getViewStateInternal(): { panX: number; panY: number; zoom: number };
  getSelectionState(): { selectedNodeIds: Set<string>; selectedConnectionIds: Set<string> };
  screenToCanvas(screenX: number, screenY: number): { x: number; y: number };
  getConnectionState(): MouseEventHandlerDependencies['getConnectionState'] extends () => infer R ? R : never;
  setConnectionState(state: Parameters<MouseEventHandlerDependencies['setConnectionState']>[0]): void;
  getPanState(): MouseEventHandlerDependencies['getPanState'] extends () => infer R ? R : never;
  setPanState(state: Parameters<MouseEventHandlerDependencies['setPanState']>[0]): void;
  getInteractionState(): MouseEventHandlerDependencies['getInteractionState'] extends () => infer R ? R : never;
  setInteractionState(state: Parameters<MouseEventHandlerDependencies['setInteractionState']>[0]): void;
  setSmartGuides(guides: Parameters<MouseEventHandlerDependencies['setSmartGuides']>[0]): void;
  updateMousePosition(x: number, y: number): void;
}

/** Shape required from canvas to build wheel handler deps. */
export interface WheelEventHandlerDepsSource {
  readonly interactionManager: WheelEventHandlerDependencies['interactionManager'];
  readonly viewStateManager: WheelEventHandlerDependencies['viewStateManager'];
  readonly renderState: WheelEventHandlerDependencies['renderState'];
  readonly canvas: HTMLCanvasElement;
  createInteractionEvent(type: InteractionType, e: WheelEvent, target?: InteractionEventTarget): InteractionEvent;
  getViewStateInternal(): { panX: number; panY: number; zoom: number };
}

export function buildMouseEventHandlerDeps(
  source: MouseEventHandlerDepsSource,
  handlerContext: HandlerContext
): MouseEventHandlerDependencies {
  return {
    handlerContext,
    interactionManager: source.interactionManager,
    uiElementManager: source.uiElementManager,
    hitTestManager: source.hitTestManager,
    edgeScrollManager: source.edgeScrollManager,
    selectionManager: source.selectionManager,
    viewStateManager: source.viewStateManager,
    graph: source.graph,
    getGraph: () => source.graph,
    nodeSpecs: source.nodeSpecs,
    nodeMetrics: source.nodeMetrics,
    nodeRenderer: source.nodeRenderer,
    renderState: source.renderState,
    connectionLayerRenderer: source.connectionLayerRenderer,
    parameterConnectionLayerRenderer: source.parameterConnectionLayerRenderer,
    activeTool: source.activeTool,
    getActiveTool: () => source.activeTool,
    isSpacePressed: source.isSpacePressed,
    getIsSpacePressed: () => source.isSpacePressed,
    canvas: source.canvas,
    onNodeDeleted: source.onNodeDeleted,
    onTypeLabelClick: source.onTypeLabelClick,
    onParameterInputModeChanged: source.onParameterInputModeChanged,
    onParameterChanged: source.onParameterChanged,
    onConnectionCreated: source.onConnectionCreated,
    getOnConnectionCreated: source.getOnConnectionCreated ? () => source.getOnConnectionCreated!.call(source) : undefined,
    onNodeMoved: source.onNodeMoved,
    onNodeSelected: source.onNodeSelected,
    attachDocumentListeners: () => source.attachDocumentListeners(),
    detachDocumentListeners: () => source.detachDocumentListeners(),
    createInteractionEvent: (type, e, target) => source.createInteractionEvent(type, e, target),
    handleFileParameterClick: (nodeId, paramName, screenX, screenY) => source.handleFileParameterClick(nodeId, paramName, screenX, screenY),
    handleEnumParameterClick: (nodeId, paramName, screenX, screenY) => source.handleEnumParameterClick(nodeId, paramName, screenX, screenY),
    handleColorPickerClick: (nodeId, screenX, screenY) => source.handleColorPickerClick(nodeId, screenX, screenY),
    handleSignalPickerClick: (screenX, screenY, targetNodeId, targetParameter) => source.handleSignalPickerClick(screenX, screenY, targetNodeId, targetParameter),
    calculateSmartGuides: (draggingNode, proposedX, proposedY) => source.calculateSmartGuides(draggingNode, proposedX, proposedY),
    getViewStateInternal: () => source.getViewStateInternal(),
    getSelectionState: () => source.getSelectionState(),
    screenToCanvas: (screenX, screenY) => source.screenToCanvas(screenX, screenY),
    getConnectionState: () => source.getConnectionState(),
    setConnectionState: (state) => source.setConnectionState(state),
    getPanState: () => source.getPanState(),
    setPanState: (state) => source.setPanState(state),
    getInteractionState: () => source.getInteractionState(),
    setInteractionState: (state) => source.setInteractionState(state),
    setSmartGuides: (guides) => source.setSmartGuides(guides),
    updateMousePosition: (x, y) => source.updateMousePosition(x, y)
  };
}

export function buildWheelEventHandlerDeps(
  source: WheelEventHandlerDepsSource,
  handlerContext: HandlerContext
): WheelEventHandlerDependencies {
  return {
    handlerContext,
    interactionManager: source.interactionManager,
    viewStateManager: source.viewStateManager,
    renderState: source.renderState,
    canvas: source.canvas,
    createInteractionEvent: (type, e, target) => source.createInteractionEvent(type, e, target),
    getViewStateInternal: () => source.getViewStateInternal()
  };
}

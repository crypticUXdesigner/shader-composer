/**
 * Reactive Graph Store - Svelte 5 Migration WP 02B
 *
 * Single source of truth for node graph and related UI state.
 * Uses Svelte 5 runes ($state, $derived) for reactivity.
 * Components import graphStore and read properties; changes propagate reactively.
 */

import type { NodeGraph, Connection, GraphViewState, ParameterValue } from '../../data-model/types';
import type { AudioSetup } from '../../data-model/audioSetupTypes';
import {
  createEmptyGraph,
  createDefaultViewState,
} from '../../data-model/utils';
import {
  updateNodePosition,
  updateNodeParameter,
  updateNodeParameterInputMode,
  updateNodeLabel,
  addNode,
  removeNode,
  addConnection,
  removeConnection,
  updateViewState,
} from '../../data-model/immutableUpdates';
import type { NodeInstance } from '../../data-model/types';
import type { ParameterInputMode } from '../../types/nodeSpec';
import type { ToolType } from '../../types/editor';

export type { ToolType };

export interface TimelineState {
  currentTime: number;
  isPlaying: boolean;
  duration: number;
}

const defaultViewState = createDefaultViewState();

// --- Reactive state ---

let graph = $state<NodeGraph>(createEmptyGraph('Untitled'));
let audioSetup = $state<AudioSetup>({
  files: [],
  bands: [],
  remappers: [],
});
let timelineState = $state<TimelineState>({
  currentTime: 0,
  isPlaying: false,
  duration: 0,
});
let activeTool = $state<ToolType>('cursor');
let isSpacebarPressed = $state(false);

/** Optional listener invoked whenever the graph is mutated (for undo integration). Set by App. */
let graphChangedListener: ((g: NodeGraph) => void) | null = null;

// --- Derived ---

const viewState = $derived<GraphViewState>(graph.viewState ?? defaultViewState);

// --- Actions ---

function setGraphAction(newGraph: NodeGraph): void {
  graph = newGraph;
  graphChangedListener?.(graph);
}

function setAudioSetupAction(newSetup: AudioSetup): void {
  audioSetup = newSetup;
}

function updateNodePositionAction(
  nodeId: string,
  position: { x: number; y: number }
): void {
  graph = updateNodePosition(graph, nodeId, position);
  graphChangedListener?.(graph);
}

function updateNodeParameterAction(
  nodeId: string,
  paramName: string,
  value: ParameterValue
): void {
  graph = updateNodeParameter(graph, nodeId, paramName, value);
  graphChangedListener?.(graph);
}

function updateNodeParameterInputModeAction(
  nodeId: string,
  paramName: string,
  mode: ParameterInputMode
): void {
  graph = updateNodeParameterInputMode(graph, nodeId, paramName, mode);
  graphChangedListener?.(graph);
}

function updateNodeLabelAction(nodeId: string, label: string | undefined): void {
  graph = updateNodeLabel(graph, nodeId, label);
  graphChangedListener?.(graph);
}

function addNodeAction(node: NodeInstance): void {
  graph = addNode(graph, node);
  graphChangedListener?.(graph);
}

function removeNodeAction(nodeId: string): void {
  graph = removeNode(graph, nodeId);
  graphChangedListener?.(graph);
}

function addConnectionAction(connection: Connection): void {
  graph = addConnection(graph, connection);
  graphChangedListener?.(graph);
}

function removeConnectionAction(connectionId: string): void {
  graph = removeConnection(graph, connectionId);
  graphChangedListener?.(graph);
}

function updateViewStateAction(partial: Partial<GraphViewState>): void {
  graph = updateViewState(graph, partial);
  graphChangedListener?.(graph);
}

function setTimelineStateAction(partial: Partial<TimelineState>): void {
  timelineState = { ...timelineState, ...partial };
}

function setActiveToolAction(tool: ToolType): void {
  activeTool = tool;
}

function setSpacebarPressedAction(pressed: boolean): void {
  isSpacebarPressed = pressed;
}

/**
 * Sets the listener invoked whenever the graph is mutated via the store.
 * Used by the app to push undo state in one place. Pass null to clear.
 */
function setGraphChangedListener(fn: ((g: NodeGraph) => void) | null): void {
  graphChangedListener = fn;
}

/**
 * Returns current graph. Use in $effect for reactive reads:
 * $effect(() => { const g = getGraph(); ... })
 */
export function getGraph(): NodeGraph {
  return graph;
}

// --- Public store API ---

export const graphStore = {
  get graph(): NodeGraph {
    return graph;
  },
  get audioSetup(): AudioSetup {
    return audioSetup;
  },
  get viewState(): GraphViewState {
    return viewState;
  },
  get timelineState(): TimelineState {
    return timelineState;
  },
  get activeTool(): ToolType {
    return activeTool;
  },
  get isSpacebarPressed(): boolean {
    return isSpacebarPressed;
  },
  setGraph: setGraphAction,
  setAudioSetup: setAudioSetupAction,
  updateNodePosition: updateNodePositionAction,
  updateNodeParameter: updateNodeParameterAction,
  updateNodeParameterInputMode: updateNodeParameterInputModeAction,
  updateNodeLabel: updateNodeLabelAction,
  addNode: addNodeAction,
  removeNode: removeNodeAction,
  addConnection: addConnectionAction,
  removeConnection: removeConnectionAction,
  updateViewState: updateViewStateAction,
  setTimelineState: setTimelineStateAction,
  setActiveTool: setActiveToolAction,
  setSpacebarPressed: setSpacebarPressedAction,
  setGraphChangedListener,
};

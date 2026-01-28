/**
 * Immutable Graph Update Utilities
 * 
 * This module provides immutable update functions for node graphs.
 * All functions return new graph instances rather than mutating existing ones.
 * This enables reliable change detection and efficient undo/redo.
 * 
 * Uses structural sharing where possible for efficiency - only changed parts
 * of the graph are copied, unchanged parts are reused.
 */

import type {
  NodeGraph,
  NodeInstance,
  Connection,
  GraphViewState,
  ParameterValue,
} from './types';
import type { ParameterInputMode } from '../types/nodeSpec';

/**
 * Creates a deep copy of a node instance.
 * Uses structural sharing for nested objects that haven't changed.
 */
function copyNode(node: NodeInstance): NodeInstance {
  return {
    ...node,
    position: { ...node.position },
    parameters: { ...node.parameters },
    parameterInputModes: node.parameterInputModes ? { ...node.parameterInputModes } : undefined,
  };
}

/**
 * Creates a deep copy of a connection.
 */
function copyConnection(connection: Connection): Connection {
  return { ...connection };
}

/**
 * Creates a deep copy of a graph.
 * Uses structural sharing - only copies arrays, reuses node/connection objects
 * (which are then copied when modified).
 */
export function deepCopyGraph(graph: NodeGraph): NodeGraph {
  return {
    ...graph,
    nodes: graph.nodes.map(copyNode),
    connections: graph.connections.map(copyConnection),
    metadata: graph.metadata ? { ...graph.metadata } : undefined,
    viewState: graph.viewState ? { ...graph.viewState } : undefined,
  };
}

/**
 * Adds a node to the graph, returning a new graph instance.
 * 
 * @param graph - The graph to update
 * @param node - The node to add
 * @returns New graph with the node added
 */
export function addNode(graph: NodeGraph, node: NodeInstance): NodeGraph {
  return {
    ...graph,
    nodes: [...graph.nodes, copyNode(node)],
  };
}

/**
 * Removes a node from the graph, returning a new graph instance.
 * Also removes all connections involving this node.
 * 
 * @param graph - The graph to update
 * @param nodeId - The ID of the node to remove
 * @returns New graph with the node and its connections removed
 */
export function removeNode(graph: NodeGraph, nodeId: string): NodeGraph {
  return {
    ...graph,
    nodes: graph.nodes.filter(n => n.id !== nodeId),
    connections: graph.connections.filter(
      c => c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId
    ),
  };
}

/**
 * Updates a node in the graph, returning a new graph instance.
 * 
 * @param graph - The graph to update
 * @param nodeId - The ID of the node to update
 * @param updater - Function that receives the node and returns an updated node
 * @returns New graph with the node updated
 */
export function updateNode(
  graph: NodeGraph,
  nodeId: string,
  updater: (node: NodeInstance) => NodeInstance
): NodeGraph {
  const nodeIndex = graph.nodes.findIndex(n => n.id === nodeId);
  if (nodeIndex === -1) {
    return graph; // Node not found, return unchanged
  }

  const updatedNode = updater(copyNode(graph.nodes[nodeIndex]));
  
  // Structural sharing: only copy nodes array, reuse connections
  const newNodes = [...graph.nodes];
  newNodes[nodeIndex] = updatedNode;

  return {
    ...graph,
    nodes: newNodes,
  };
}

/**
 * Updates a node's position, returning a new graph instance.
 * 
 * @param graph - The graph to update
 * @param nodeId - The ID of the node to update
 * @param position - The new position
 * @returns New graph with the node position updated
 */
export function updateNodePosition(
  graph: NodeGraph,
  nodeId: string,
  position: { x: number; y: number }
): NodeGraph {
  return updateNode(graph, nodeId, (node) => ({
    ...node,
    position: { ...position },
  }));
}

/**
 * Updates a node's parameter value, returning a new graph instance.
 * 
 * @param graph - The graph to update
 * @param nodeId - The ID of the node to update
 * @param paramName - The parameter name
 * @param value - The new parameter value
 * @returns New graph with the parameter updated
 */
export function updateNodeParameter(
  graph: NodeGraph,
  nodeId: string,
  paramName: string,
  value: ParameterValue
): NodeGraph {
  return updateNode(graph, nodeId, (node) => {
    const newParameters = { ...node.parameters };
    newParameters[paramName] = value;
    return {
      ...node,
      parameters: newParameters,
    };
  });
}

/**
 * Updates a node's parameter input mode, returning a new graph instance.
 * 
 * @param graph - The graph to update
 * @param nodeId - The ID of the node to update
 * @param paramName - The parameter name
 * @param mode - The new input mode
 * @returns New graph with the parameter input mode updated
 */
export function updateNodeParameterInputMode(
  graph: NodeGraph,
  nodeId: string,
  paramName: string,
  mode: ParameterInputMode
): NodeGraph {
  return updateNode(graph, nodeId, (node) => {
    const newModes = { ...(node.parameterInputModes || {}) };
    newModes[paramName] = mode;
    return {
      ...node,
      parameterInputModes: newModes,
    };
  });
}

/**
 * Updates a node's label, returning a new graph instance.
 * 
 * @param graph - The graph to update
 * @param nodeId - The ID of the node to update
 * @param label - The new label (undefined to remove)
 * @returns New graph with the node label updated
 */
export function updateNodeLabel(
  graph: NodeGraph,
  nodeId: string,
  label: string | undefined
): NodeGraph {
  return updateNode(graph, nodeId, (node) => {
    if (label === undefined) {
      const { label: _, ...rest } = node;
      return rest;
    }
    return {
      ...node,
      label,
    };
  });
}

/**
 * Adds a connection to the graph, returning a new graph instance.
 * 
 * @param graph - The graph to update
 * @param connection - The connection to add
 * @returns New graph with the connection added
 */
export function addConnection(graph: NodeGraph, connection: Connection): NodeGraph {
  return {
    ...graph,
    connections: [...graph.connections, copyConnection(connection)],
  };
}

/**
 * Removes a connection from the graph, returning a new graph instance.
 * 
 * @param graph - The graph to update
 * @param connectionId - The ID of the connection to remove
 * @returns New graph with the connection removed
 */
export function removeConnection(graph: NodeGraph, connectionId: string): NodeGraph {
  return {
    ...graph,
    connections: graph.connections.filter(c => c.id !== connectionId),
  };
}

/**
 * Removes connections that match a predicate, returning a new graph instance.
 * Useful for removing connections to/from a specific port or parameter.
 * 
 * @param graph - The graph to update
 * @param predicate - Function that returns true for connections to remove
 * @returns New graph with matching connections removed
 */
export function removeConnections(
  graph: NodeGraph,
  predicate: (connection: Connection) => boolean
): NodeGraph {
  return {
    ...graph,
    connections: graph.connections.filter(c => !predicate(c)),
  };
}

/**
 * Updates the graph's view state, returning a new graph instance.
 * 
 * @param graph - The graph to update
 * @param viewState - The new view state (partial updates supported)
 * @returns New graph with the view state updated
 */
export function updateViewState(
  graph: NodeGraph,
  viewState: Partial<GraphViewState>
): NodeGraph {
  return {
    ...graph,
    viewState: {
      ...(graph.viewState || { zoom: 1.0, panX: 0, panY: 0 }),
      ...viewState,
      selectedNodeIds: viewState.selectedNodeIds !== undefined
        ? [...(viewState.selectedNodeIds || [])]
        : graph.viewState?.selectedNodeIds,
    },
  };
}

/**
 * Adds multiple nodes to the graph, returning a new graph instance.
 * More efficient than calling addNode multiple times.
 * 
 * @param graph - The graph to update
 * @param nodes - The nodes to add
 * @returns New graph with the nodes added
 */
export function addNodes(graph: NodeGraph, nodes: NodeInstance[]): NodeGraph {
  return {
    ...graph,
    nodes: [...graph.nodes, ...nodes.map(copyNode)],
  };
}

/**
 * Adds multiple connections to the graph, returning a new graph instance.
 * More efficient than calling addConnection multiple times.
 * 
 * @param graph - The graph to update
 * @param connections - The connections to add
 * @returns New graph with the connections added
 */
export function addConnections(graph: NodeGraph, connections: Connection[]): NodeGraph {
  return {
    ...graph,
    connections: [...graph.connections, ...connections.map(copyConnection)],
  };
}

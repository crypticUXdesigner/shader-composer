/**
 * Graph Comparison Utilities
 * 
 * Shared utilities for comparing node graphs to detect changes.
 * Used by RuntimeManager and NodeEditorCanvas to determine if graph structure
 * has changed or if only positions/viewState changed.
 */

import type { NodeGraph } from '../data-model/types';
import { parametersEqual, connectionsEqual } from '../runtime/utils/deepEquals';

/**
 * Check if only node positions changed (not structure, connections, or parameters)
 * 
 * IMPORTANT: This method compares graph objects that may be the same reference.
 * If the graph is mutated in place, we need to compare the actual state, not references.
 * 
 * @param oldGraph - Previous graph state (null if first comparison)
 * @param newGraph - Current graph state
 * @returns true if only positions/viewState changed, false if structure/connections/parameters changed
 */
export function isOnlyPositionChange(oldGraph: NodeGraph | null, newGraph: NodeGraph): boolean {
  if (!oldGraph) return false;
  
  // Check if node count changed
  if (oldGraph.nodes.length !== newGraph.nodes.length) return false;
  
  // CRITICAL: Compare connection counts - if they differ, structure definitely changed
  // This check must happen even if oldGraph and newGraph are the same object reference
  // because the connections array may have been mutated
  const oldConnCount = oldGraph.connections?.length || 0;
  const newConnCount = newGraph.connections?.length || 0;
  if (oldConnCount !== newConnCount) {
    return false;
  }
  
  // Check if any nodes were added/removed (by ID)
  const oldNodeIds = new Set(oldGraph.nodes.map(n => n.id));
  const newNodeIds = new Set(newGraph.nodes.map(n => n.id));
  if (oldNodeIds.size !== newNodeIds.size) return false;
  for (const id of oldNodeIds) {
    if (!newNodeIds.has(id)) return false;
  }
  
  // Check if any node types changed
  const oldNodesById = new Map(oldGraph.nodes.map(n => [n.id, n]));
  for (const newNode of newGraph.nodes) {
    const oldNode = oldNodesById.get(newNode.id);
    if (!oldNode || oldNode.type !== newNode.type) return false;
  }
  
  // Check if any parameters changed (excluding positions)
  for (const newNode of newGraph.nodes) {
    const oldNode = oldNodesById.get(newNode.id);
    if (!oldNode) return false;
    
    // Use efficient parameter comparison instead of JSON.stringify
    if (!parametersEqual(oldNode.parameters, newNode.parameters)) {
      return false;
    }
  }
  
  // Check if connections changed
  if (!connectionsEqual(oldGraph.connections, newGraph.connections)) {
    return false;
  }
  
  // If we get here, only positions (or viewState) changed
  return true;
}

/**
 * Check if graph structure changed (nodes, connections, or parameters)
 * This is the inverse of isOnlyPositionChange - returns true if structure changed.
 * 
 * @param oldGraph - Previous graph state (null if first comparison)
 * @param newGraph - Current graph state
 * @returns true if structure changed, false if only positions/viewState changed
 */
export function isGraphStructureChanged(oldGraph: NodeGraph | null, newGraph: NodeGraph): boolean {
  return !isOnlyPositionChange(oldGraph, newGraph);
}

/**
 * Comprehensive graph comparison result
 */
export interface GraphComparisonResult {
  /** True if only positions/viewState changed */
  isOnlyPositionChange: boolean;
  /** True if nodes were added/removed */
  nodesChanged: boolean;
  /** True if connections changed */
  connectionsChanged: boolean;
  /** True if node parameters changed */
  parametersChanged: boolean;
  /** True if node types changed */
  nodeTypesChanged: boolean;
  /** List of added node IDs */
  addedNodeIds: string[];
  /** List of removed node IDs */
  removedNodeIds: string[];
  /** List of changed node IDs (type or parameters changed) */
  changedNodeIds: string[];
}

/**
 * Comprehensive graph comparison
 * 
 * @param oldGraph - Previous graph state (null if first comparison)
 * @param newGraph - Current graph state
 * @returns Detailed comparison result
 */
export function compareGraphs(oldGraph: NodeGraph | null, newGraph: NodeGraph): GraphComparisonResult {
  const result: GraphComparisonResult = {
    isOnlyPositionChange: false,
    nodesChanged: false,
    connectionsChanged: false,
    parametersChanged: false,
    nodeTypesChanged: false,
    addedNodeIds: [],
    removedNodeIds: [],
    changedNodeIds: []
  };

  if (!oldGraph) {
    // First comparison - everything is new
    result.nodesChanged = true;
    result.connectionsChanged = true;
    result.addedNodeIds = newGraph.nodes.map(n => n.id);
    return result;
  }

  // Compare node counts
  if (oldGraph.nodes.length !== newGraph.nodes.length) {
    result.nodesChanged = true;
  }

  // Compare connection counts
  const oldConnCount = oldGraph.connections?.length || 0;
  const newConnCount = newGraph.connections?.length || 0;
  if (oldConnCount !== newConnCount) {
    result.connectionsChanged = true;
  }

  // Compare connections
  if (!connectionsEqual(oldGraph.connections, newGraph.connections)) {
    result.connectionsChanged = true;
  }

  // Compare nodes
  const oldNodeIds = new Set(oldGraph.nodes.map(n => n.id));
  const newNodeIds = new Set(newGraph.nodes.map(n => n.id));
  const oldNodesById = new Map(oldGraph.nodes.map(n => [n.id, n]));

  // Find added nodes
  for (const newNodeId of newNodeIds) {
    if (!oldNodeIds.has(newNodeId)) {
      result.addedNodeIds.push(newNodeId);
      result.nodesChanged = true;
    }
  }

  // Find removed nodes
  for (const oldNodeId of oldNodeIds) {
    if (!newNodeIds.has(oldNodeId)) {
      result.removedNodeIds.push(oldNodeId);
      result.nodesChanged = true;
    }
  }

  // Find changed nodes (type or parameters)
  for (const newNode of newGraph.nodes) {
    const oldNode = oldNodesById.get(newNode.id);
    if (!oldNode) continue; // Already handled as added

    if (oldNode.type !== newNode.type) {
      result.nodeTypesChanged = true;
      result.changedNodeIds.push(newNode.id);
    }

    if (!parametersEqual(oldNode.parameters, newNode.parameters)) {
      result.parametersChanged = true;
      if (!result.changedNodeIds.includes(newNode.id)) {
        result.changedNodeIds.push(newNode.id);
      }
    }
  }

  // Determine if only position changed
  result.isOnlyPositionChange = 
    !result.nodesChanged &&
    !result.connectionsChanged &&
    !result.parametersChanged &&
    !result.nodeTypesChanged;

  return result;
}

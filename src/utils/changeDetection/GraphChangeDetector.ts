/**
 * Graph Change Detector
 * 
 * Unified change detection system for node graphs.
 * Leverages immutable updates for reliable and efficient change detection.
 * 
 * With immutable updates, graphs are always new references when changed.
 * This allows for fast reference equality checks, with structural comparison
 * for detailed change information when needed.
 */

import type { NodeGraph } from '../../data-model/types';
import { parametersEqual, connectionsEqual } from '../../runtime/utils/deepEquals';
import type { ChangeDetectionResult, ChangeDetectionOptions } from './types';
import { ChangeType } from './types';
import { GraphAnalyzer } from '../../shaders/compilation/GraphAnalyzer';

/**
 * Graph Change Detector
 * 
 * Provides unified change detection for node graphs, replacing scattered
 * change detection logic across RuntimeManager, CompilationManager, and NodeEditorCanvas.
 */
export class GraphChangeDetector {
  /**
   * Detect changes between two graph states.
   * 
   * With immutable updates, if oldGraph === newGraph, no changes occurred.
   * Otherwise, performs structural comparison to determine what changed.
   * 
   * @param oldGraph - Previous graph state (null if first comparison)
   * @param newGraph - Current graph state
   * @param options - Change detection options
   * @returns Detailed change detection result
   */
  static detectChanges(
    oldGraph: NodeGraph | null,
    newGraph: NodeGraph,
    options: ChangeDetectionOptions = {}
  ): ChangeDetectionResult {
    const {
      trackAffectedNodes = false,
      includeConnectionIds = true
    } = options;

    // Fast path: same reference means no change (immutable updates guarantee this)
    if (oldGraph === newGraph) {
      return this.createNoChangeResult();
    }

    // First comparison - everything is new
    if (!oldGraph) {
      return this.createInitialChangeResult(newGraph, trackAffectedNodes, includeConnectionIds);
    }

    // Perform structural comparison
    return this.compareGraphs(oldGraph, newGraph, trackAffectedNodes, includeConnectionIds);
  }

  /**
   * Check if only positions/viewState changed (not structure, connections, or parameters).
   * 
   * This is a convenience method that performs optimized comparison for the common
   * case of checking if only positions changed.
   * 
   * @param oldGraph - Previous graph state (null if first comparison)
   * @param newGraph - Current graph state
   * @returns true if only positions/viewState changed
   */
  static isOnlyPositionChange(oldGraph: NodeGraph | null, newGraph: NodeGraph): boolean {
    // Fast path: same reference means no change
    if (oldGraph === newGraph) {
      return false; // No change at all
    }

    if (!oldGraph) {
      return false; // First comparison, structure changed
    }

    // Quick checks for structure changes
    if (oldGraph.nodes.length !== newGraph.nodes.length) {
      return false;
    }

    const oldConnCount = oldGraph.connections?.length || 0;
    const newConnCount = newGraph.connections?.length || 0;
    if (oldConnCount !== newConnCount) {
      return false;
    }

    // Check if any nodes were added/removed (by ID)
    const oldNodeIds = new Set(oldGraph.nodes.map(n => n.id));
    const newNodeIds = new Set(newGraph.nodes.map(n => n.id));
    if (oldNodeIds.size !== newNodeIds.size) {
      return false;
    }
    for (const id of oldNodeIds) {
      if (!newNodeIds.has(id)) {
        return false;
      }
    }

    // Check if any node types changed
    const oldNodesById = new Map(oldGraph.nodes.map(n => [n.id, n]));
    for (const newNode of newGraph.nodes) {
      const oldNode = oldNodesById.get(newNode.id);
      if (!oldNode || oldNode.type !== newNode.type) {
        return false;
      }
    }

    // Check if any parameters changed
    for (const newNode of newGraph.nodes) {
      const oldNode = oldNodesById.get(newNode.id);
      if (!oldNode) {
        return false;
      }
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
   * Check if graph structure changed (nodes, connections, or parameters).
   * 
   * @param oldGraph - Previous graph state (null if first comparison)
   * @param newGraph - Current graph state
   * @returns true if structure changed
   */
  static isStructureChanged(oldGraph: NodeGraph | null, newGraph: NodeGraph): boolean {
    return !this.isOnlyPositionChange(oldGraph, newGraph);
  }

  /**
   * Get changed connection IDs between two graphs.
   * 
   * @param oldGraph - Previous graph state (null if first comparison)
   * @param newGraph - Current graph state
   * @returns Object with added and removed connection IDs
   */
  static getChangedConnections(
    oldGraph: NodeGraph | null,
    newGraph: NodeGraph
  ): { added: string[]; removed: string[] } {
    if (!oldGraph) {
      return {
        added: newGraph.connections.map(c => c.id),
        removed: []
      };
    }

    const oldConnectionIds = new Set(oldGraph.connections.map(c => c.id));
    const newConnectionIds = new Set(newGraph.connections.map(c => c.id));

    const added = Array.from(newConnectionIds).filter(id => !oldConnectionIds.has(id));
    const removed = Array.from(oldConnectionIds).filter(id => !newConnectionIds.has(id));

    return { added, removed };
  }

  /**
   * Create result for no changes detected
   */
  private static createNoChangeResult(): ChangeDetectionResult {
    return {
      changeType: ChangeType.NONE,
      isOnlyPositionChange: false,
      isStructureChanged: false,
      isConnectionsChanged: false,
      isParametersChanged: false,
      isNodeTypesChanged: false,
      addedNodeIds: [],
      removedNodeIds: [],
      changedNodeIds: [],
      affectedNodeIds: new Set(),
      addedConnectionIds: [],
      removedConnectionIds: []
    };
  }

  /**
   * Create result for initial graph (first comparison)
   */
  private static createInitialChangeResult(
    graph: NodeGraph,
    trackAffectedNodes: boolean,
    includeConnectionIds: boolean
  ): ChangeDetectionResult {
    const affectedNodeIds = trackAffectedNodes
      ? new Set(graph.nodes.map(n => n.id))
      : new Set<string>();

    return {
      changeType: ChangeType.STRUCTURE,
      isOnlyPositionChange: false,
      isStructureChanged: true,
      isConnectionsChanged: true,
      isParametersChanged: false,
      isNodeTypesChanged: false,
      addedNodeIds: graph.nodes.map(n => n.id),
      removedNodeIds: [],
      changedNodeIds: [],
      affectedNodeIds,
      addedConnectionIds: includeConnectionIds ? graph.connections.map(c => c.id) : [],
      removedConnectionIds: []
    };
  }

  /**
   * Compare two graphs and detect all changes
   */
  private static compareGraphs(
    oldGraph: NodeGraph,
    newGraph: NodeGraph,
    trackAffectedNodes: boolean,
    includeConnectionIds: boolean
  ): ChangeDetectionResult {
    const result: ChangeDetectionResult = {
      changeType: ChangeType.NONE,
      isOnlyPositionChange: false,
      isStructureChanged: false,
      isConnectionsChanged: false,
      isParametersChanged: false,
      isNodeTypesChanged: false,
      addedNodeIds: [],
      removedNodeIds: [],
      changedNodeIds: [],
      affectedNodeIds: new Set(),
      addedConnectionIds: [],
      removedConnectionIds: []
    };

    // Compare node counts
    const nodesChanged = oldGraph.nodes.length !== newGraph.nodes.length;

    // Compare connection counts
    const oldConnCount = oldGraph.connections?.length || 0;
    const newConnCount = newGraph.connections?.length || 0;
    const connectionCountChanged = oldConnCount !== newConnCount;

    // Compare connections structurally
    const connectionsStructurallyChanged = !connectionsEqual(
      oldGraph.connections,
      newGraph.connections
    );

    result.isConnectionsChanged = connectionCountChanged || connectionsStructurallyChanged;

    // Get connection IDs if requested
    if (includeConnectionIds && result.isConnectionsChanged) {
      const connectionChanges = this.getChangedConnections(oldGraph, newGraph);
      result.addedConnectionIds = connectionChanges.added;
      result.removedConnectionIds = connectionChanges.removed;
    }

    // Compare nodes
    const oldNodeIds = new Set(oldGraph.nodes.map(n => n.id));
    const newNodeIds = new Set(newGraph.nodes.map(n => n.id));
    const oldNodesById = new Map(oldGraph.nodes.map(n => [n.id, n]));

    // Find added nodes
    for (const newNodeId of newNodeIds) {
      if (!oldNodeIds.has(newNodeId)) {
        result.addedNodeIds.push(newNodeId);
        result.isStructureChanged = true;
      }
    }

    // Find removed nodes
    for (const oldNodeId of oldNodeIds) {
      if (!newNodeIds.has(oldNodeId)) {
        result.removedNodeIds.push(oldNodeId);
        result.isStructureChanged = true;
      }
    }

    // Find changed nodes (type or parameters)
    for (const newNode of newGraph.nodes) {
      const oldNode = oldNodesById.get(newNode.id);
      if (!oldNode) continue; // Already handled as added

      let nodeChanged = false;

      if (oldNode.type !== newNode.type) {
        result.isNodeTypesChanged = true;
        nodeChanged = true;
      }

      if (!parametersEqual(oldNode.parameters, newNode.parameters)) {
        result.isParametersChanged = true;
        nodeChanged = true;
      }

      if (nodeChanged && !result.changedNodeIds.includes(newNode.id)) {
        result.changedNodeIds.push(newNode.id);
      }
    }

    // Determine structure changed
    result.isStructureChanged = result.isStructureChanged || nodesChanged;

    // Determine if only position changed
    result.isOnlyPositionChange =
      !result.isStructureChanged &&
      !result.isConnectionsChanged &&
      !result.isParametersChanged &&
      !result.isNodeTypesChanged;

    // Determine primary change type
    const changeTypes: ChangeType[] = [];
    if (result.isStructureChanged) changeTypes.push(ChangeType.STRUCTURE);
    if (result.isConnectionsChanged) changeTypes.push(ChangeType.CONNECTIONS);
    if (result.isParametersChanged) changeTypes.push(ChangeType.PARAMETERS);
    if (result.isNodeTypesChanged) changeTypes.push(ChangeType.NODE_TYPES);

    if (changeTypes.length === 0) {
      result.changeType = ChangeType.POSITION_ONLY;
    } else if (changeTypes.length === 1) {
      result.changeType = changeTypes[0];
    } else {
      result.changeType = ChangeType.MIXED;
    }

    // Track affected nodes if requested
    if (trackAffectedNodes) {
      if (
        result.isStructureChanged ||
        result.isConnectionsChanged ||
        result.isParametersChanged ||
        result.isNodeTypesChanged
      ) {
        // Use dependency tracking to find only truly affected nodes
        const changedNodeIds = new Set<string>();
        
        // Add changed nodes (type or parameters changed)
        result.changedNodeIds.forEach(id => changedNodeIds.add(id));
        
        // Add added nodes (new nodes need compilation)
        result.addedNodeIds.forEach(id => changedNodeIds.add(id));
        
        // For removed nodes, we need to recompile nodes that depended on them
        // But since they're removed, we'll mark all nodes as potentially affected
        // if connections changed (conservative approach for safety)
        if (result.isConnectionsChanged || result.removedNodeIds.length > 0) {
          // When connections change or nodes are removed, use dependency tracking
          // to find affected nodes more precisely
          const graphAnalyzer = new GraphAnalyzer();
          
          // Find nodes affected by changed/added nodes
          if (changedNodeIds.size > 0) {
            const affected = graphAnalyzer.findAffectedNodes(newGraph, changedNodeIds);
            affected.forEach(id => result.affectedNodeIds.add(id));
          }
          
          // For removed nodes, find nodes that depended on them using the old graph
          if (result.removedNodeIds.length > 0) {
            // Use old graph to find what depended on removed nodes
            const oldGraphAnalyzer = new GraphAnalyzer();
            // const removedNodeSet = new Set(result.removedNodeIds); // Unused but kept for potential future use
            const oldDependents = oldGraphAnalyzer.buildDependentsGraph(oldGraph);
            
            // Find all nodes in new graph that depended on removed nodes
            for (const removedId of result.removedNodeIds) {
              const dependents = oldDependents.get(removedId);
              if (dependents) {
                for (const dependentId of dependents) {
                  // Only add if the dependent still exists in the new graph
                  if (newNodeIds.has(dependentId)) {
                    result.affectedNodeIds.add(dependentId);
                  }
                }
              }
            }
            
            // Also mark removed nodes themselves as affected (for cleanup)
            // But they're not in new graph, so we don't need to add them
          } else if (result.isConnectionsChanged && changedNodeIds.size === 0) {
            // Connections changed but no nodes changed - use dependency tracking
            // to find nodes affected by connection changes
            // For safety, mark all nodes as affected when connections change significantly
            newGraph.nodes.forEach(n => result.affectedNodeIds.add(n.id));
          }
          
          // Find nodes affected by changed/added nodes (if any)
          if (changedNodeIds.size > 0) {
            const affected = graphAnalyzer.findAffectedNodes(newGraph, changedNodeIds);
            affected.forEach(id => result.affectedNodeIds.add(id));
          }
        } else if (changedNodeIds.size > 0) {
          // Only parameters/types changed - use dependency tracking
          const graphAnalyzer = new GraphAnalyzer();
          const affected = graphAnalyzer.findAffectedNodes(newGraph, changedNodeIds);
          affected.forEach(id => result.affectedNodeIds.add(id));
        }
      }
    }

    return result;
  }
}

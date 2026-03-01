import type { NodeGraph } from '../../data-model/types';

/**
 * Analyzes graph structure and calculates execution order
 */
export class GraphAnalyzer {
  /**
   * Build dependency graph
   */
  private buildDependencyGraph(graph: NodeGraph): Map<string, string[]> {
    const dependencies = new Map<string, string[]>();

    // Initialize all nodes with empty dependencies
    for (const node of graph.nodes) {
      dependencies.set(node.id, []);
    }

    // Add dependencies from connections (both regular port connections and parameter connections)
    for (const conn of graph.connections) {
      const deps = dependencies.get(conn.targetNodeId) || [];
      if (!deps.includes(conn.sourceNodeId)) {
        deps.push(conn.sourceNodeId);
      }
      dependencies.set(conn.targetNodeId, deps);
    }

    return dependencies;
  }

  /**
   * Build reverse dependency graph (dependents graph).
   * Maps each node to all nodes that depend on it (downstream dependents).
   */
  buildDependentsGraph(graph: NodeGraph): Map<string, Set<string>> {
    const dependents = new Map<string, Set<string>>();

    // Initialize all nodes with empty dependents
    for (const node of graph.nodes) {
      dependents.set(node.id, new Set());
    }

    // Build reverse dependencies from connections
    for (const conn of graph.connections) {
      const deps = dependents.get(conn.sourceNodeId);
      if (deps) {
        deps.add(conn.targetNodeId);
      }
    }

    return dependents;
  }

  /**
   * Find all downstream dependents of a set of nodes.
   * Returns a set of node IDs that depend on (directly or transitively) the given nodes.
   * 
   * @param graph - The node graph
   * @param changedNodeIds - Set of node IDs that changed
   * @returns Set of all affected node IDs (changed nodes + their dependents)
   */
  findAffectedNodes(graph: NodeGraph, changedNodeIds: Set<string>): Set<string> {
    const dependentsGraph = this.buildDependentsGraph(graph);
    const affectedNodes = new Set<string>(changedNodeIds);
    const visited = new Set<string>();

    // BFS to find all transitive dependents
    const queue = Array.from(changedNodeIds);
    
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const dependents = dependentsGraph.get(nodeId);
      if (dependents) {
        for (const dependentId of dependents) {
          if (!affectedNodes.has(dependentId)) {
            affectedNodes.add(dependentId);
            queue.push(dependentId);
          }
        }
      }
    }

    return affectedNodes;
  }

  /**
   * Topological sort using Kahn's algorithm.
   * Virtual nodes (e.g. audio-signal:band-xxx) are not in graph.nodes; dependencies on them
   * are excluded from in-degree so nodes that only depend on virtual nodes can be processed.
   * Isolated nodes (no connections in or out) are placed at the end of the order so that
   * adding an unconnected node does not shift other nodes' indices and change parameter
   * connection resolution (which source "wins" when multiple connect to the same parameter).
   */
  topologicalSort(graph: NodeGraph): string[] {
    const dependencies = this.buildDependencyGraph(graph);
    const inDegree = new Map<string, number>();
    const result: string[] = [];
    const nodeIds = new Set(graph.nodes.map((n) => n.id));

    // Node IDs that appear in any connection (source or target) - "connected" nodes
    const connectedNodeIds = new Set<string>();
    for (const conn of graph.connections) {
      if (nodeIds.has(conn.sourceNodeId)) connectedNodeIds.add(conn.sourceNodeId);
      if (nodeIds.has(conn.targetNodeId)) connectedNodeIds.add(conn.targetNodeId);
    }

    // Two queues: process connected nodes before isolated so isolated nodes end up at the end
    const connectedQueue: string[] = [];
    const isolatedQueue: string[] = [];

    for (const node of graph.nodes) {
      const deps = dependencies.get(node.id) || [];
      const degree = deps.filter((id) => nodeIds.has(id)).length;
      inDegree.set(node.id, degree);
      if (degree === 0) {
        if (connectedNodeIds.has(node.id)) {
          connectedQueue.push(node.id);
        } else {
          isolatedQueue.push(node.id);
        }
      }
    }

    const takeNext = (): string | undefined =>
      connectedQueue.shift() ?? isolatedQueue.shift();

    let nodeId: string | undefined;
    while ((nodeId = takeNext()) !== undefined) {
      result.push(nodeId);

      for (const conn of graph.connections) {
        if (conn.sourceNodeId !== nodeId) continue;
        const targetInDegree = (inDegree.get(conn.targetNodeId) || 0) - 1;
        inDegree.set(conn.targetNodeId, targetInDegree);
        if (targetInDegree === 0) {
          const targetId = conn.targetNodeId;
          if (connectedNodeIds.has(targetId)) {
            connectedQueue.push(targetId);
          } else {
            isolatedQueue.push(targetId);
          }
        }
      }
    }

    if (result.length !== graph.nodes.length) {
      throw new Error('Graph contains cycles');
    }

    return result;
  }
}

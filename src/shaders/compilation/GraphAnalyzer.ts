import type { NodeGraph } from '../../types';

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
   * Topological sort using Kahn's algorithm
   */
  topologicalSort(graph: NodeGraph): string[] {
    const dependencies = this.buildDependencyGraph(graph);
    const inDegree = new Map<string, number>();
    const queue: string[] = [];
    const result: string[] = [];

    // Calculate in-degree for each node
    for (const node of graph.nodes) {
      const degree = dependencies.get(node.id)?.length || 0;
      inDegree.set(node.id, degree);
      if (degree === 0) {
        queue.push(node.id);
      }
    }

    // Process nodes
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      result.push(nodeId);

      // Find all nodes that depend on this node
      for (const conn of graph.connections) {
        if (conn.sourceNodeId === nodeId) {
          const targetInDegree = (inDegree.get(conn.targetNodeId) || 0) - 1;
          inDegree.set(conn.targetNodeId, targetInDegree);
          if (targetInDegree === 0) {
            queue.push(conn.targetNodeId);
          }
        }
      }
    }

    // Check for cycles
    if (result.length !== graph.nodes.length) {
      throw new Error('Graph contains cycles');
    }

    return result;
  }
}

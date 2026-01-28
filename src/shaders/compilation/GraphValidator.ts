import type { NodeGraph, NodeSpec } from '../../types';

/**
 * Validates graph structure
 */
export class GraphValidator {
  constructor(private nodeSpecs: Map<string, NodeSpec>) {}

  /**
   * Validate graph structure
   */
  validateGraph(graph: NodeGraph, errors: string[], _warnings: string[]): void {
    // Check required fields
    if (!graph.id) errors.push('[ERROR] Graph missing id');
    if (!graph.name) errors.push('[ERROR] Graph missing name');
    if (graph.version !== '2.0') {
      errors.push(`[ERROR] Invalid version: ${graph.version} (expected 2.0)`);
    }

    // Check node IDs are unique
    const nodeIds = new Set<string>();
    for (const node of graph.nodes) {
      if (nodeIds.has(node.id)) {
        errors.push(`[ERROR] Duplicate node ID: ${node.id}`);
      }
      nodeIds.add(node.id);

      // Check node type exists
      if (!this.nodeSpecs.has(node.type)) {
        errors.push(`[ERROR] Unknown node type: ${node.type} (node ${node.id})`);
      }
    }

    // Check connection IDs are unique and reference valid nodes
    const connectionIds = new Set<string>();
    // Track target ports to detect duplicate connections to same input
    const targetPorts = new Map<string, string>(); // targetNodeId.targetPort -> connectionId
    
    for (const conn of graph.connections) {
      if (connectionIds.has(conn.id)) {
        errors.push(`[ERROR] Duplicate connection ID: ${conn.id}`);
      }
      connectionIds.add(conn.id);

      if (!nodeIds.has(conn.sourceNodeId)) {
        errors.push(`[ERROR] Connection references non-existent source node: ${conn.sourceNodeId}`);
      }
      if (!nodeIds.has(conn.targetNodeId)) {
        errors.push(`[ERROR] Connection references non-existent target node: ${conn.targetNodeId}`);
      }

      // Check for duplicate connections to same input port or parameter
      const targetKey = conn.targetParameter 
        ? `${conn.targetNodeId}.param:${conn.targetParameter}`
        : `${conn.targetNodeId}.${conn.targetPort}`;
      if (targetPorts.has(targetKey)) {
        const existingConnId = targetPorts.get(targetKey);
        const targetName = conn.targetParameter || conn.targetPort;
        errors.push(
          `[ERROR] Duplicate Connection: ${conn.targetParameter ? 'Parameter' : 'Input port'} '${targetName}' on node '${conn.targetNodeId}' ` +
          `already has a connection (${existingConnId}). Connection ${conn.id} conflicts.`
        );
      } else {
        targetPorts.set(targetKey, conn.id);
      }
    }
  }
}

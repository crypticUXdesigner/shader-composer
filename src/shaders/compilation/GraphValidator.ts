import type { NodeGraph } from '../../data-model/types';
import type { NodeSpec } from '../../types/nodeSpec';
import { getConnectionTargetKey } from '../../data-model/connectionUtils';

/**
 * Validates graph structure
 */
export class GraphValidator {
  constructor(private nodeSpecs: Map<string, NodeSpec>) {}

  /**
   * Validate graph structure.
   * @param validSourceNodeIds - Optional set of valid source node IDs (e.g. virtual audio nodes from audioSetup).
   *   Connections with sourceNodeId in this set are accepted even if not in graph.nodes.
   */
  validateGraph(
    graph: NodeGraph,
    errors: string[],
    _warnings: string[],
    validSourceNodeIds?: Set<string>
  ): void {
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
    const targetKeyToConnId = new Map<string, string>();

    for (const conn of graph.connections) {
      if (connectionIds.has(conn.id)) {
        errors.push(`[ERROR] Duplicate connection ID: ${conn.id}`);
      }
      connectionIds.add(conn.id);

      const sourceValid =
        nodeIds.has(conn.sourceNodeId) ||
        (validSourceNodeIds?.has(conn.sourceNodeId) ?? false);
      if (!sourceValid) {
        errors.push(`[ERROR] Connection references non-existent source node: ${conn.sourceNodeId}`);
      }
      if (!nodeIds.has(conn.targetNodeId)) {
        errors.push(`[ERROR] Connection references non-existent target node: ${conn.targetNodeId}`);
      }

      // Invariant: exactly one of targetPort or targetParameter
      const hasPort = conn.targetPort != null && conn.targetPort !== '';
      const hasParam = conn.targetParameter != null && conn.targetParameter !== '';
      if (hasPort && hasParam) {
        errors.push(`[ERROR] Connection ${conn.id}: exactly one of targetPort or targetParameter required (both set)`);
      } else if (!hasPort && !hasParam) {
        errors.push(`[ERROR] Connection ${conn.id}: exactly one of targetPort or targetParameter required (neither set)`);
      }

      const targetKey = getConnectionTargetKey(conn);
      if (targetKey && targetKeyToConnId.has(targetKey)) {
        const existingConnId = targetKeyToConnId.get(targetKey)!;
        const targetName = conn.targetParameter ?? conn.targetPort ?? '?';
        errors.push(
          `[ERROR] Duplicate connection to '${targetName}' on node '${conn.targetNodeId}' (existing: ${existingConnId}, conflict: ${conn.id})`
        );
      } else if (targetKey) {
        targetKeyToConnId.set(targetKey, conn.id);
      }
    }
  }
}

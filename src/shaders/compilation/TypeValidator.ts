import type { NodeGraph, NodeSpec } from '../../types';

/**
 * Validates type compatibility for connections
 */
export class TypeValidator {
  constructor(private nodeSpecs: Map<string, NodeSpec>) {}

  /**
   * Check if two types are compatible (exact match or promotion)
   */
  private areTypesCompatible(source: string, target: string): boolean {
    if (source === target) return true;

    // Check promotion rules
    const promotions: Record<string, string[]> = {
      'float': ['vec2', 'vec3', 'vec4'],
      'vec2': ['vec3', 'vec4'],
      'vec3': ['vec4']
    };

    return promotions[source]?.includes(target) || false;
  }

  /**
   * Validate type compatibility for all connections
   */
  validateTypes(graph: NodeGraph): string[] {
    const errors: string[] = [];

    for (const conn of graph.connections) {
      const sourceNode = graph.nodes.find(n => n.id === conn.sourceNodeId);
      const targetNode = graph.nodes.find(n => n.id === conn.targetNodeId);

      if (!sourceNode || !targetNode) continue;

      const sourceSpec = this.nodeSpecs.get(sourceNode.type);
      const targetSpec = this.nodeSpecs.get(targetNode.type);

      if (!sourceSpec || !targetSpec) continue;

      const sourceOutput = sourceSpec.outputs.find(o => o.name === conn.sourcePort);

      if (!sourceOutput) {
        errors.push(
          `[ERROR] Invalid source port: ${conn.sourcePort} on node ${sourceNode.type} (${sourceNode.id})`
        );
        continue;
      }

      // Handle parameter connections
      if (conn.targetParameter) {
        const paramSpec = targetSpec.parameters[conn.targetParameter];
        if (!paramSpec) {
          errors.push(
            `[ERROR] Invalid target parameter: ${conn.targetParameter} on node ${targetNode.type} (${targetNode.id})`
          );
          continue;
        }
        
        // Check type compatibility for parameter connections (float only)
        if (paramSpec.type !== 'float') {
          errors.push(
            `[ERROR] Parameter connection type mismatch: Parameter '${conn.targetParameter}' on node ${targetNode.type} ` +
            `is of type '${paramSpec.type}', but only float parameters can have input connections.`
          );
          continue;
        }
        
        // Check source type compatibility (must be float, int, or vec type)
        if (sourceOutput.type !== 'float' && sourceOutput.type !== 'int' && 
            sourceOutput.type !== 'vec2' && sourceOutput.type !== 'vec3' && sourceOutput.type !== 'vec4') {
          errors.push(
            `[ERROR] Type Mismatch: Cannot connect ${sourceOutput.type} to parameter '${conn.targetParameter}' ` +
            `(${sourceNode.type}.${conn.sourcePort} → ${targetNode.type}.${conn.targetParameter})`
          );
        }
      } else {
        // Regular port connection
        const targetInput = targetSpec.inputs.find(i => i.name === conn.targetPort);

        if (!targetInput) {
          errors.push(
            `[ERROR] Invalid target port: ${conn.targetPort} on node ${targetNode.type} (${targetNode.id})`
          );
          continue;
        }

        if (!this.areTypesCompatible(sourceOutput.type, targetInput.type)) {
          errors.push(
            `[ERROR] Type Mismatch: Cannot connect ${sourceOutput.type} to ${targetInput.type} ` +
            `(${sourceNode.type}.${conn.sourcePort} → ${targetNode.type}.${conn.targetPort})`
          );
        }
      }
    }

    return errors;
  }
}

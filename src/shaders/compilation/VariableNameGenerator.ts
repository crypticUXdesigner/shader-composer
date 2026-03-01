import type { NodeGraph } from '../../data-model/types';
import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Generates variable names for node outputs
 */
export class VariableNameGenerator {
  constructor(private nodeSpecs: Map<string, NodeSpec>) {}

  /**
   * Generate variable names for all node outputs
   */
  generateVariableNames(graph: NodeGraph): Map<string, Map<string, string>> {
    const variableNames = new Map<string, Map<string, string>>();

    for (const node of graph.nodes) {
      const nodeSpec = this.nodeSpecs.get(node.type);
      if (!nodeSpec) continue;

      const nodeVars = new Map<string, string>();
      
      // Standard outputs for all node types
      for (const output of nodeSpec.outputs) {
        const varName = this.generateVariableName(node.id, output.name);
        nodeVars.set(output.name, varName);
      }
      
      variableNames.set(node.id, nodeVars);
    }

    return variableNames;
  }

  /**
   * Generate a variable name for a node output
   */
  generateVariableName(nodeId: string, portName: string): string {
    const sanitizedId = nodeId.replace(/[^a-zA-Z0-9]/g, '_');
    const sanitizedPort = portName.replace(/[^a-zA-Z0-9]/g, '_');
    return `node_${sanitizedId}_${sanitizedPort}`;
  }

  /**
   * Generate a variable name for an array parameter
   */
  generateArrayVariableName(nodeId: string, paramName: string): string {
    const sanitizedId = nodeId.replace(/[^a-zA-Z0-9]/g, '_');
    const sanitizedParam = paramName.replace(/[^a-zA-Z0-9]/g, '_');
    return `array_${sanitizedId}_${sanitizedParam}`;
  }
}

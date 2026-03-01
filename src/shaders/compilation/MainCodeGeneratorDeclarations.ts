import type { NodeGraph } from '../../data-model/types';
import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Get initial value for an output variable (used when declaring at global scope).
 */
export function getOutputInitialValue(type: string, _nodeType: string): string {
  if (type === 'float') return '0.0';
  if (type === 'vec2') return 'vec2(0.0)';
  if (type === 'vec3') return 'vec3(0.0)';
  if (type === 'vec4') return 'vec4(0.0)';
  return '0.0';
}

/**
 * Build variable declarations and validate that all referenced variables are declared.
 * Used by MainCodeGenerator.generateMainCode.
 */
export function buildVariableDeclarations(
  graph: NodeGraph,
  nodeSpecs: Map<string, NodeSpec>,
  variableNames: Map<string, Map<string, string>>,
  getOutputInitialValueFn: (type: string, nodeType: string) => string
): { variableDeclarations: string[]; declaredVars: Set<string> } {
  const variableDeclarations: string[] = [];
  const declaredVars = new Set<string>();

  for (const node of graph.nodes) {
    const nodeSpec = nodeSpecs.get(node.type);
    if (!nodeSpec) continue;

    const outputVars = variableNames.get(node.id);
    if (!outputVars || outputVars.size === 0) {
      if (nodeSpec.outputs && nodeSpec.outputs.length > 0) {
        console.warn(
          `[NodeShaderCompiler] Node ${node.type} (${node.id}) has outputs in spec but no variables generated`
        );
      }
      continue;
    }

    for (const output of nodeSpec.outputs) {
      const varName = outputVars.get(output.name);
      if (varName) {
        const initValue = getOutputInitialValueFn(output.type, nodeSpec.id);
        variableDeclarations.push(`${output.type} ${varName} = ${initValue};`);
        declaredVars.add(varName);
      } else {
        console.warn(
          `[NodeShaderCompiler] Variable name not found for ${node.type} (${node.id}).${output.name}`
        );
      }
    }
  }

  // Validate that all variables referenced in connections are declared
  for (const conn of graph.connections) {
    const sourceNode = graph.nodes.find(n => n.id === conn.sourceNodeId);
    const sourceSpec = sourceNode ? nodeSpecs.get(sourceNode.type) : null;
    const sourcePortName = conn.sourcePort ?? sourceSpec?.outputs?.[0]?.name;
    const sourceVarName = sourcePortName
      ? variableNames.get(conn.sourceNodeId)?.get(sourcePortName)
      : undefined;
    if (sourceVarName && !declaredVars.has(sourceVarName)) {
      console.error(
        `[NodeShaderCompiler] Variable ${sourceVarName} is referenced but not declared. ` +
          `Source node: ${sourceNode?.type || 'unknown'} (${conn.sourceNodeId}).${sourcePortName}`
      );
      if (sourceNode && sourceSpec?.outputs?.length) {
        const output = sourceSpec.outputs.find(o => o.name === sourcePortName) ?? sourceSpec.outputs[0];
        const initValue = getOutputInitialValueFn(output.type, sourceSpec.id);
        variableDeclarations.push(`${output.type} ${sourceVarName} = ${initValue};`);
        declaredVars.add(sourceVarName);
        console.warn(
          `[NodeShaderCompiler] Force-declared missing variable ${sourceVarName} for ${sourceNode.type} (${conn.sourceNodeId})`
        );
      }
    }
  }

  return { variableDeclarations, declaredVars };
}

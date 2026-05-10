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
  if (type === 'int') return '0';
  if (type === 'bool') return 'false';
  return '0.0';
}

/**
 * Build variable declarations and validate that all referenced variables are declared.
 * Used by MainCodeGenerator.generateMainCode.
 *
 * `activeNodeIds`, when provided, restricts declarations to nodes that will actually emit
 * code. This is used by the per-node Power feature to ensure bypassed nodes contribute no GPU
 * code at all (no dead variable declarations for nodes dropped from the execution order).
 */
export function buildVariableDeclarations(
  graph: NodeGraph,
  nodeSpecs: Map<string, NodeSpec>,
  variableNames: Map<string, Map<string, string>>,
  getOutputInitialValueFn: (type: string, nodeType: string) => string,
  effectiveNodeSpecsById?: Map<string, NodeSpec>,
  activeNodeIds?: ReadonlySet<string>
): { variableDeclarations: string[]; declaredVars: Set<string> } {
  const variableDeclarations: string[] = [];
  const declaredVars = new Set<string>();

  for (const node of graph.nodes) {
    if (activeNodeIds && !activeNodeIds.has(node.id)) continue;
    const nodeSpec = effectiveNodeSpecsById?.get(node.id) ?? nodeSpecs.get(node.type);
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
    const sourceSpec = sourceNode
      ? (effectiveNodeSpecsById?.get(sourceNode.id) ?? nodeSpecs.get(sourceNode.type))
      : null;
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

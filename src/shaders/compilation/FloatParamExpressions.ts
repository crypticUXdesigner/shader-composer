import type { NodeGraph } from '../../data-model/types';
import type { NodeSpec } from '../../types/nodeSpec';
import { isVirtualNodeId } from '../../utils/virtualNodes';

export type FloatParamExpressionMap = Record<string, string> & {
  __hasInputConnections?: boolean;
};

export function getAutomationExpressionForParam(
  nodeId: string,
  paramName: string,
  graph: NodeGraph,
  paramSpec: NodeSpec['parameters'][string] | undefined
): string | null {
  if (paramSpec?.type !== 'float' || !graph?.automation?.lanes) return null;
  const lane = graph.automation.lanes.find(
    (l) => l.nodeId === nodeId && l.paramName === paramName
  );
  if (!lane) return null;
  return `evalAutomation_${sanitizeAutomationLaneId(lane.id)}(uTimelineTime)`;
}

function sanitizeAutomationLaneId(laneId: string): string {
  let id = laneId.replace(/[^a-zA-Z0-9]/g, '_');
  if (!id) id = 'lane';
  if (/^\d/.test(id)) id = 'a' + id;
  return id;
}

export function buildFloatParamExpressions(
  node: NodeGraph['nodes'][number],
  nodeSpec: NodeSpec,
  graph: NodeGraph,
  uniformNames: Map<string, string>,
  variableNames: Map<string, Map<string, string>>,
  nodeSpecs: Map<string, NodeSpec>,
  generateParameterCombination: (
    configValue: string,
    inputValue: string,
    mode: 'override' | 'add' | 'subtract' | 'multiply',
    paramType: 'float' | 'int'
  ) => string,
  // Reserved for future use; included so callers can share the same helper signature
  // across compilation components that may need regex escaping.
  _escapeRegex: (str: string) => string
): FloatParamExpressionMap {
  const expressions: FloatParamExpressionMap = {} as FloatParamExpressionMap;

  // Build map of parameter input variables (for parameters with input connections)
  const parameterInputVars = new Map<string, string>();

  for (const conn of graph.connections) {
    if (conn.targetNodeId === node.id && conn.targetParameter) {
      const paramSpec = nodeSpec.parameters[conn.targetParameter];
      if (!paramSpec || paramSpec.type !== 'float') continue;

      const sourceNode = graph.nodes.find((n) => n.id === conn.sourceNodeId);

      if (!sourceNode) {
        // Virtual audio node (no NodeInstance in graph): map directly to its uniform.
        if (isVirtualNodeId(conn.sourceNodeId)) {
          const uniformName = uniformNames.get(conn.sourceNodeId);
          if (uniformName) {
            parameterInputVars.set(conn.targetParameter, uniformName);
          }
        }
        continue;
      }

      const sourceSpec = nodeSpecs.get(sourceNode.type);
      if (!sourceSpec) continue;

      const sourceOutput =
        sourceSpec.outputs.find((o) => o.name === conn.sourcePort) ??
        sourceSpec.outputs[0];
      if (!sourceOutput) continue;

      const sourcePortName = sourceOutput.name;

      if (!variableNames.has(conn.sourceNodeId)) continue;

      const sourceVarName = variableNames
        .get(conn.sourceNodeId)
        ?.get(sourcePortName);
      if (!sourceVarName) continue;

      let promotedVar = sourceVarName;
      if (sourceOutput.type === 'int') {
        promotedVar = `float(${sourceVarName})`;
      } else if (sourceOutput.type !== 'float') {
        promotedVar = `${sourceVarName}.x`;
      }
      parameterInputVars.set(conn.targetParameter, promotedVar);
    }
  }

  // CRITICAL VALIDATION: Verify all variable references in parameterInputVars will exist
  const allValidVars = new Set<string>();
  for (const nodeVars of variableNames.values()) {
    for (const varName of nodeVars.values()) {
      allValidVars.add(varName);
    }
  }

  const paramVarNamePattern = /\bnode_[a-zA-Z0-9_]+_[a-zA-Z0-9_]+\b/g;
  for (const [paramName, varRef] of parameterInputVars.entries()) {
    const matches = varRef.match(paramVarNamePattern);
    if (matches) {
      for (const varName of matches) {
        if (!allValidVars.has(varName)) {
          console.error(
            `[NodeShaderCompiler] CRITICAL: Node ${node.id} (${nodeSpec.id}), parameter ${paramName}: ` +
              `Variable ${varName} referenced in expression "${varRef}" will not be declared. ` +
              `Source connection may be invalid or variable name mismatch. Removing invalid reference.`
          );
          parameterInputVars.delete(paramName);
          break;
        }
      }
    }
  }

  let hasInputConnections = false;

  // Build final expressions for float parameters, preserving existing precedence rules
  for (const paramName of Object.keys(nodeSpec.parameters)) {
    const paramSpec = nodeSpec.parameters[paramName];
    if (paramSpec.type !== 'float') {
      continue;
    }

    const paramInputVar = parameterInputVars.get(paramName);
    if (paramInputVar) {
      hasInputConnections = true;
      const inputMode =
        node.parameterInputModes?.[paramName] ||
        paramSpec.inputMode ||
        'override';
      if (inputMode === 'override') {
        expressions[paramName] = paramInputVar;
      } else {
        const automationExpr = getAutomationExpressionForParam(
          node.id,
          paramName,
          graph,
          paramSpec
        );
        const uniformName = uniformNames.get(`${node.id}.${paramName}`);
        const configValue =
          automationExpr ??
          uniformName ??
          String(
            node.parameters[paramName] ??
              paramSpec?.default ??
              '0.0'
          );
        const paramType: 'float' | 'int' = 'float';
        const combinedExpr = generateParameterCombination(
          configValue,
          paramInputVar,
          inputMode,
          paramType
        );
        expressions[paramName] = combinedExpr;
      }
    } else {
      const automationExpr = getAutomationExpressionForParam(
        node.id,
        paramName,
        graph,
        paramSpec
      );
      if (automationExpr) {
        expressions[paramName] = automationExpr;
      } else {
        const uniformName = uniformNames.get(`${node.id}.${paramName}`);
        if (uniformName) {
          expressions[paramName] = uniformName;
        }
      }
    }
  }

  if (hasInputConnections) {
    expressions.__hasInputConnections = true;
  }

  return expressions;
}


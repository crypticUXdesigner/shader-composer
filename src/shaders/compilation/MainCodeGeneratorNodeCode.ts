import type { NodeGraph, NodeInstance } from '../../data-model/types';
import type { NodeSpec } from '../../types/nodeSpec';
import { isVirtualNodeId } from '../../utils/virtualNodes';
import { formatParamLiteralForGlsl, generateOutputVariableName, getInputDefaultValue } from './MainCodeGeneratorUtils';
import { sanitizeAutomationLaneId } from './MainCodeGeneratorOutput';
import { replacePlaceholders, type PlaceholderContext } from './MainCodeGeneratorPlaceholders';

export function generatePromotionCode(
  sourceVar: string,
  sourceType: string,
  targetType: string
): string {
  if (sourceType === targetType) return sourceVar;
  const promotions: Record<string, Record<string, string>> = {
    float: { vec2: `vec2(${sourceVar}, ${sourceVar})`, vec3: `vec3(${sourceVar}, ${sourceVar}, ${sourceVar})`, vec4: `vec4(${sourceVar}, ${sourceVar}, ${sourceVar}, 1.0)` },
    vec2: { vec3: `vec3(${sourceVar}.x, ${sourceVar}.y, 0.0)`, vec4: `vec4(${sourceVar}.x, ${sourceVar}.y, 0.0, 1.0)` },
    vec3: { vec4: `vec4(${sourceVar}.x, ${sourceVar}.y, ${sourceVar}.z, 1.0)` }
  };
  const demotions: Record<string, Record<string, string>> = {
    vec4: { float: `${sourceVar}.r`, vec2: `${sourceVar}.xy`, vec3: `${sourceVar}.rgb` },
    vec3: { float: `${sourceVar}.r`, vec2: `${sourceVar}.xy` },
    vec2: { float: `${sourceVar}.x` }
  };
  const promotion = promotions[sourceType]?.[targetType];
  if (promotion) return promotion;
  const demotion = demotions[sourceType]?.[targetType];
  if (demotion) return demotion;
  throw new Error(`Cannot convert ${sourceType} to ${targetType}`);
}

export function getParameterComponentExpression(
  node: NodeInstance,
  nodeSpec: NodeSpec,
  paramName: string,
  parameterInputVars: Map<string, string>,
  uniformNames: Map<string, string>,
  graph: NodeGraph | undefined
): string {
  const paramSpec = nodeSpec.parameters[paramName];
  if (graph?.automation?.lanes && paramSpec?.type === 'float') {
    const lane = graph.automation.lanes.find((l) => l.nodeId === node.id && l.paramName === paramName);
    if (lane) {
      return `evalAutomation_${sanitizeAutomationLaneId(lane.id)}(uTimelineTime)`;
    }
  }
  const paramInputVar = parameterInputVars.get(paramName);
  if (paramInputVar) return paramInputVar;
  const uniformName = uniformNames.get(`${node.id}.${paramName}`);
  if (uniformName) return uniformName;
  const raw = node.parameters[paramName];
  const value = typeof raw === 'number' && isFinite(raw)
    ? raw
    : (paramSpec && typeof paramSpec.default === 'number' ? paramSpec.default : (paramSpec?.type === 'int' ? 0 : 0.0));
  return formatParamLiteralForGlsl(value, paramSpec);
}

export function getInputFallbackValue(
  node: NodeInstance,
  nodeSpec: NodeSpec,
  input: { name: string; type: string; fallbackParameter?: string }
): string | null {
  const fp = input.fallbackParameter;
  if (!fp || !nodeSpec.parameters) return null;
  const paramNames = fp.split(',').map(s => s.trim()).filter(Boolean);
  if (paramNames.length === 0) return null;

  const getParamValue = (name: string): number => {
    const raw = node.parameters[name];
    if (typeof raw === 'number' && isFinite(raw)) return raw;
    const spec = nodeSpec.parameters[name];
    if (spec && typeof spec.default === 'number') return spec.default;
    return spec?.type === 'int' ? 0 : 0.0;
  };

  if (paramNames.length === 1) {
    const name = paramNames[0];
    if (!nodeSpec.parameters[name]) return null;
    return formatParamLiteralForGlsl(getParamValue(name), nodeSpec.parameters[name]);
  }
  if (paramNames.length === 2 && input.type === 'vec2') {
    const fa = formatParamLiteralForGlsl(getParamValue(paramNames[0]), undefined);
    const fb = formatParamLiteralForGlsl(getParamValue(paramNames[1]), undefined);
    return `vec2(${fa}, ${fb})`;
  }
  if (paramNames.length === 3 && input.type === 'vec3') {
    const fa = formatParamLiteralForGlsl(getParamValue(paramNames[0]), undefined);
    const fb = formatParamLiteralForGlsl(getParamValue(paramNames[1]), undefined);
    const fc = formatParamLiteralForGlsl(getParamValue(paramNames[2]), undefined);
    return `vec3(${fa}, ${fb}, ${fc})`;
  }
  if (paramNames.length === 4 && input.type === 'vec4') {
    const fa = formatParamLiteralForGlsl(getParamValue(paramNames[0]), undefined);
    const fb = formatParamLiteralForGlsl(getParamValue(paramNames[1]), undefined);
    const fc = formatParamLiteralForGlsl(getParamValue(paramNames[2]), undefined);
    const fd = formatParamLiteralForGlsl(getParamValue(paramNames[3]), undefined);
    return `vec4(${fa}, ${fb}, ${fc}, ${fd})`;
  }
  return null;
}

export function substituteInputRefsInExpression(
  expression: string,
  inputVars: Map<string, string>
): string {
  return expression.replace(/\$input\.(\w+)/g, (_, name) => {
    const value = inputVars.get(name);
    return value !== undefined ? value : `$input.${name}`;
  });
}

export type NodeCodeContext = PlaceholderContext & {
  nodeSpecs: Map<string, NodeSpec>;
  getGenericRaymarcherReplacements: (
    node: NodeInstance,
    graph: NodeGraph,
    uniformNames: Map<string, string>,
    functionNameMap: Map<string, Map<string, string>>
  ) => { sdfCall: string; displacementAtP: string };
};

/**
 * Generate code for a single node.
 */
export function generateNodeCode(
  node: NodeInstance,
  nodeSpec: NodeSpec,
  graph: NodeGraph,
  executionOrder: string[],
  variableNames: Map<string, Map<string, string>>,
  uniformNames: Map<string, string>,
  functionNameMap: Map<string, Map<string, string>>,
  ctx: NodeCodeContext
): string {
  const code: string[] = [];
  const inputVars = new Map<string, string>();

  for (const conn of graph.connections) {
    if (conn.targetNodeId !== node.id || !conn.targetPort) continue;
    const targetInput = nodeSpec.inputs.find(i => i.name === conn.targetPort);
    if (!targetInput) continue;

    if (isVirtualNodeId(conn.sourceNodeId) && conn.sourcePort === 'out') {
      const uniformName = uniformNames.get(conn.sourceNodeId);
      if (uniformName) {
        inputVars.set(conn.targetPort, generatePromotionCode(uniformName, 'float', targetInput.type));
      }
      continue;
    }

    const sourceNode = graph.nodes.find(n => n.id === conn.sourceNodeId);
    if (!sourceNode) continue;
    const sourceSpec = ctx.nodeSpecs.get(sourceNode.type);
    if (!sourceSpec) continue;
    const sourceOutput = sourceSpec.outputs.find(o => o.name === conn.sourcePort);
    if (!sourceOutput) continue;

    const sourceVarName = variableNames.get(conn.sourceNodeId)?.get(conn.sourcePort);
    if (sourceVarName) {
      inputVars.set(conn.targetPort, generatePromotionCode(sourceVarName, sourceOutput.type, targetInput.type));
    } else {
      console.warn(
        `[NodeShaderCompiler] Could not find variable for connection: ` +
        `${conn.sourceNodeId}.${conn.sourcePort} -> ${node.id}.${conn.targetPort}`
      );
    }
  }

  const parameterInputVars = new Map<string, string>();
  const paramSourceIndex = new Map<string, number>();
  const targetIndex = executionOrder.indexOf(node.id);
  const effectiveTargetIndex = targetIndex < 0 ? executionOrder.length : targetIndex;

  for (const conn of graph.connections) {
    if (conn.targetNodeId !== node.id || !conn.targetParameter) continue;
    const paramSpec = nodeSpec.parameters[conn.targetParameter];
    if (!paramSpec || paramSpec.type !== 'float') continue;

    if (isVirtualNodeId(conn.sourceNodeId) && conn.sourcePort === 'out') {
      const uniformName = uniformNames.get(conn.sourceNodeId);
      if (uniformName) {
        parameterInputVars.set(conn.targetParameter, uniformName);
        paramSourceIndex.set(conn.targetParameter, -1);
      }
      continue;
    }

    const sourceNode = graph.nodes.find(n => n.id === conn.sourceNodeId);
    if (!sourceNode) continue;
    const sourceSpec = ctx.nodeSpecs.get(sourceNode.type);
    if (!sourceSpec) continue;
    const sourceOutput = sourceSpec.outputs.find(o => o.name === conn.sourcePort) ?? sourceSpec.outputs[0];
    if (!sourceOutput) continue;

    const sourceIndex = executionOrder.indexOf(conn.sourceNodeId);
    if (sourceIndex < 0 || sourceIndex >= effectiveTargetIndex) continue;
    const existingIndex = paramSourceIndex.get(conn.targetParameter) ?? -1;
    if (sourceIndex <= existingIndex) continue;

    const sourcePortName = sourceOutput.name;
    let sourceVarName = variableNames.get(conn.sourceNodeId)?.get(sourcePortName);
    if (!sourceVarName) {
      sourceVarName = generateOutputVariableName(conn.sourceNodeId, sourcePortName);
      console.warn(
        `[NodeShaderCompiler] Variable name not in map for param connection, using fallback: ` +
        `${conn.sourceNodeId}.${sourcePortName} -> ${node.id}.${conn.targetParameter} => ${sourceVarName}`
      );
    }

    let promotedVar = sourceVarName;
    if (sourceOutput.type === 'int') promotedVar = `float(${sourceVarName})`;
    else if (sourceOutput.type !== 'float') promotedVar = `${sourceVarName}.x`;
    parameterInputVars.set(conn.targetParameter, promotedVar);
    paramSourceIndex.set(conn.targetParameter, sourceIndex);
  }

  const skipInputDefaults = nodeSpec.inputs.length === 0;
  if (!skipInputDefaults) {
    for (const input of nodeSpec.inputs) {
      if (inputVars.has(input.name)) continue;
      let defaultValue: string;
      if (input.fallbackExpression) {
        defaultValue = substituteInputRefsInExpression(input.fallbackExpression, inputVars);
      } else if (input.fallbackParameter) {
        const paramNames = input.fallbackParameter.split(',').map(s => s.trim()).filter(Boolean);
        if (paramNames.length === 1) {
          defaultValue = getParameterComponentExpression(node, nodeSpec, paramNames[0], parameterInputVars, uniformNames, graph);
        } else if (paramNames.length === 2 && input.type === 'vec2') {
          const e0 = getParameterComponentExpression(node, nodeSpec, paramNames[0], parameterInputVars, uniformNames, graph);
          const e1 = getParameterComponentExpression(node, nodeSpec, paramNames[1], parameterInputVars, uniformNames, graph);
          defaultValue = `vec2(${e0}, ${e1})`;
        } else if (paramNames.length === 3 && input.type === 'vec3') {
          const e0 = getParameterComponentExpression(node, nodeSpec, paramNames[0], parameterInputVars, uniformNames, graph);
          const e1 = getParameterComponentExpression(node, nodeSpec, paramNames[1], parameterInputVars, uniformNames, graph);
          const e2 = getParameterComponentExpression(node, nodeSpec, paramNames[2], parameterInputVars, uniformNames, graph);
          defaultValue = `vec3(${e0}, ${e1}, ${e2})`;
        } else if (paramNames.length === 4 && input.type === 'vec4') {
          const e0 = getParameterComponentExpression(node, nodeSpec, paramNames[0], parameterInputVars, uniformNames, graph);
          const e1 = getParameterComponentExpression(node, nodeSpec, paramNames[1], parameterInputVars, uniformNames, graph);
          const e2 = getParameterComponentExpression(node, nodeSpec, paramNames[2], parameterInputVars, uniformNames, graph);
          const e3 = getParameterComponentExpression(node, nodeSpec, paramNames[3], parameterInputVars, uniformNames, graph);
          defaultValue = `vec4(${e0}, ${e1}, ${e2}, ${e3})`;
        } else {
          defaultValue = getInputFallbackValue(node, nodeSpec, input) ?? getInputDefaultValue(input.type);
        }
      } else {
        defaultValue = getInputDefaultValue(input.type);
      }
      inputVars.set(input.name, defaultValue);
    }
  }

  const outputVars = variableNames.get(node.id) || new Map();

  for (const [paramName, paramSpec] of Object.entries(nodeSpec.parameters)) {
    if (paramSpec.type === 'array') {
      const arrayValue = node.parameters[paramName] as number[] | undefined;
      if (Array.isArray(arrayValue) && arrayValue.length > 0) {
        const arrayVarName = ctx.generateArrayVariableName(node.id, paramName);
        const arrayValues = arrayValue.map(v => v.toFixed(10)).join(', ');
        code.push(`  const float ${arrayVarName}[${arrayValue.length}] = float[${arrayValue.length}](${arrayValues});`);
      }
    }
  }

  let nodeCode = replacePlaceholders(
    nodeSpec.mainCode,
    node,
    nodeSpec,
    inputVars,
    outputVars,
    uniformNames,
    ctx,
    parameterInputVars,
    graph
  );

  const nodeFunctionNameMap = functionNameMap.get(node.id);
  if (nodeFunctionNameMap) {
    for (const [originalName, nodeSpecificName] of nodeFunctionNameMap.entries()) {
      const functionCallRegex = new RegExp(`\\b${ctx.escapeRegex(originalName)}\\s*\\(`, 'g');
      nodeCode = nodeCode.replace(functionCallRegex, `${nodeSpecificName}(`);
    }
  }

  if (nodeSpec.id === 'generic-raymarcher') {
    const replacements = ctx.getGenericRaymarcherReplacements(
      node,
      graph,
      uniformNames,
      functionNameMap
    );
    nodeCode = nodeCode.replace(/\$sdf_call/g, replacements.sdfCall);
    nodeCode = nodeCode.replace(/\$displacement_at_p/g, replacements.displacementAtP);
  }

  code.push(nodeCode);
  return code.join('\n');
}
